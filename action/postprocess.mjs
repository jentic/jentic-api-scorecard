// Phase 19 GitHub Action post-processor. The composite action scores once
// (`score … --format json --detail diagnostics -o report.json`, one engine
// pass) and this helper derives every output — SARIF, HTML, Markdown — from that
// single captured JSON, because each formatter is a pure function of the engine
// result. Re-running `score --format sarif|markdown|html` would be a second
// `docker run`, breaking score-once.
//
// Library access: the three formatters are resolved by dynamic import of the
// installed packages — `@jentic/api-scorecard-cli/sarif` and `/markdown` plus
// `@jentic/api-scorecard-formatter-html`. A composite action has no node_modules
// of its own, so action.yml runs `npm install @jentic/api-scorecard-cli@<ver>`
// (which pulls formatter-html transitively) into the action dir first, unless the
// packages already resolve — which is the case in this repo's own self-test,
// where the workspace is built and the local checkout carries the new subpath
// exports that the published version does not yet have. Pre-bundling the helper
// with its deps (esbuild/ncc) is NOT viable: the HTML format() reads a sibling
// dist/app/index.html template via import.meta.url at runtime, which a flat
// bundle would not carry.

import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';

// SARIF levels, ranked. The CLI's sarif formatter maps engine severity 1→error,
// 2→warning, everything else→note; the `severity` input names the minimum level
// to keep in the SARIF output (findings below it are dropped).
const LEVEL_RANK = { error: 3, warning: 2, note: 1 };

export function parseLevel(value, fallback = 'warning') {
  const level = String(value ?? '')
    .trim()
    .toLowerCase();
  return level in LEVEL_RANK ? level : fallback;
}

// Inputs arrive as strings via env; an empty / unset value means "no gate". A
// non-numeric value is treated as unset rather than NaN so a typo never silently
// fails (gate) or zeroes (cap) the build.
export function parseOptionalNumber(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Gate reads the FULL captured diagnostics, never the severity-filtered SARIF —
// raising `severity` hides findings from the Security tab but must not weaken the
// build gate. Severity 1 = error, 2 = warning (engine scale).
export function computeGate(result, { minScore, maxErrors, maxWarnings }) {
  const diagnostics = Array.isArray(result?.diagnostics) ? result.diagnostics : [];
  const errorCount = diagnostics.filter((d) => d.severity === 1).length;
  const warningCount = diagnostics.filter((d) => d.severity === 2).length;
  const score = result?.summary?.score;

  const reasons = [];
  // Strict `<`: a score exactly equal to min-score passes.
  if (minScore !== null && typeof score === 'number' && score < minScore) {
    reasons.push(`score ${score} is below min-score ${minScore}`);
  }
  if (maxErrors !== null && errorCount > maxErrors) {
    reasons.push(`${errorCount} error-severity findings exceed max-errors ${maxErrors}`);
  }
  if (maxWarnings !== null && warningCount > maxWarnings) {
    reasons.push(`${warningCount} warning-severity findings exceed max-warnings ${maxWarnings}`);
  }

  return { passed: reasons.length === 0, reasons, errorCount, warningCount, score };
}

// Drop SARIF results below the minimum level, preserving run/tool structure
// (an emptied run still records that the validator ran).
export function filterSarifBySeverity(doc, minLevel) {
  const threshold = LEVEL_RANK[minLevel] ?? LEVEL_RANK.warning;
  const runs = (doc.runs ?? []).map((run) => ({
    ...run,
    results: (run.results ?? []).filter((r) => (LEVEL_RANK[r.level] ?? 0) >= threshold),
  }));
  return { ...doc, runs };
}

function countResults(doc) {
  return (doc.runs ?? []).reduce((sum, run) => sum + (run.results ?? []).length, 0);
}

// GitHub caps SARIF at 5000 results / 10MB. When over `maxFindings`, drop
// lowest-severity-first (note before warning before error) until at the cap,
// returning the dropped count for logging. Within a level, later results are
// dropped first (stable: earlier findings of the same level are retained).
export function capFindings(doc, maxFindings) {
  const total = countResults(doc);
  if (maxFindings === null || total <= maxFindings) {
    return { doc, dropped: 0 };
  }

  let toDrop = total - maxFindings;
  // Walk levels low→high; within each, drop from the tail.
  const dropOrder = ['note', 'warning', 'error'];
  const runs = (doc.runs ?? []).map((run) => ({ ...run, results: [...(run.results ?? [])] }));

  for (const level of dropOrder) {
    if (toDrop <= 0) break;
    // Iterate runs in reverse and results in reverse so the tail goes first.
    for (let i = runs.length - 1; i >= 0 && toDrop > 0; i--) {
      const results = runs[i].results;
      for (let j = results.length - 1; j >= 0 && toDrop > 0; j--) {
        if (results[j].level === level) {
          results.splice(j, 1);
          toDrop--;
        }
      }
    }
  }

  return { doc: { ...doc, runs }, dropped: total - maxFindings };
}

async function loadFormatters() {
  const [{ formatSarif }, { formatMarkdown }, { format: formatHtml }] = await Promise.all([
    import('@jentic/api-scorecard-cli/sarif'),
    import('@jentic/api-scorecard-cli/markdown'),
    import('@jentic/api-scorecard-formatter-html'),
  ]);
  return { formatSarif, formatMarkdown, formatHtml };
}

function ghNotice(message) {
  // GitHub workflow command: surfaces as an annotation on the run.
  process.stdout.write(`::notice::${message}\n`);
}

async function main() {
  const env = process.env;
  const reportPath = env['REPORT_JSON'] ?? 'report.json';
  const sarifPath = env['SARIF_PATH'] ?? 'report.sarif';
  const htmlPath = env['HTML_PATH'] ?? 'scorecard.html';

  const markdownPath = env['MARKDOWN_PATH'] ?? 'scorecard.md';

  const result = JSON.parse(readFileSync(reportPath, 'utf8'));

  const minScore = parseOptionalNumber(env['MIN_SCORE']);
  const maxErrors = parseOptionalNumber(env['MAX_ERRORS']);
  const maxWarnings = parseOptionalNumber(env['MAX_WARNINGS']);
  const maxFindings = parseOptionalNumber(env['MAX_FINDINGS']) ?? 5000;
  const severity = parseLevel(env['SEVERITY']);
  const summaryDetail = env['SUMMARY_DETAIL'] ?? 'dimensions';

  const { formatSarif, formatMarkdown, formatHtml } = await loadFormatters();

  // SARIF: full doc first, then severity filter, then findings cap.
  const fullSarif = JSON.parse(formatSarif(result));
  const filtered = filterSarifBySeverity(fullSarif, severity);
  const { doc: cappedSarif, dropped } = capFindings(filtered, maxFindings);
  if (dropped > 0) {
    ghNotice(`SARIF capped at max-findings ${maxFindings}; dropped ${dropped} lowest-severity findings.`);
  }
  writeFileSync(sarifPath, JSON.stringify(cappedSarif, null, 2) + '\n');

  // HTML artifact + Markdown run summary, both from the same captured result.
  writeFileSync(htmlPath, formatHtml(result));

  const markdown = formatMarkdown(result, { detail: summaryDetail });
  // Write Markdown to a real file as well as the run summary. $GITHUB_STEP_SUMMARY
  // is a per-step file, so a later step (or the self-test) can't read what this
  // step appended — the file is the cross-step / artifact-friendly copy.
  writeFileSync(markdownPath, markdown + '\n');
  const stepSummary = env['GITHUB_STEP_SUMMARY'];
  if (stepSummary) {
    appendFileSync(stepSummary, markdown + '\n');
  }

  // Gate decision against the FULL diagnostics. The helper never fails the build
  // itself — it writes the verdict to GITHUB_OUTPUT and a final action.yml step
  // does the failing exit, ordered AFTER the publish steps so SARIF, the HTML
  // artifact, and the summary all land even when the gate fails.
  const gate = computeGate(result, { minScore, maxErrors, maxWarnings });
  if (gate.passed) {
    ghNotice(`Scorecard gate passed (score ${gate.score}).`);
  } else {
    for (const reason of gate.reasons) {
      process.stdout.write(`::error::Scorecard gate failed: ${reason}\n`);
    }
  }

  const outputFile = env['GITHUB_OUTPUT'];
  if (outputFile) {
    appendFileSync(outputFile, `gate-passed=${gate.passed}\n`);
    appendFileSync(outputFile, `gate-reasons=${gate.reasons.join('; ')}\n`);
  }
}

// Only run the I/O driver when executed directly; the pure exports above are
// imported by the unit tests with no side effects.
if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
