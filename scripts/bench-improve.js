#!/usr/bin/env node
/**
 * bench-improve.js
 *
 * Benchmark the token usage and cost of running the `jentic-api-improve` skill
 * across a matrix of coding-agent models × input OpenAPI specs. A skill run
 * spends LLM budget on two independent surfaces, measured separately:
 *   - agent:  the coding agent's own reasoning, driving the standard 2-iteration
 *             loop, captured from Claude Code headless `claude -p --output-format json`
 *             (session `usage` + `total_cost_usd`).
 *   - engine: the scoring engine's `--with-llm` analysis, read from the
 *             `token-usage.json` the skill writes when the run explicitly requests
 *             engine token usage (the harness's claude -p prompt asks for it, so
 *             the skill scores with `--report-token-usage` and emits the file).
 *
 * The skill's output is STOCHASTIC — the same model against the same spec varies
 * by a few score points run to run. To report an honest number, each matrix cell
 * is driven `--samples N` times (default 3); the doc reports the MEDIAN score with
 * a min–max range, and the MEAN of the token/cost surfaces, over the cell's VALID
 * samples only. A sample is non-comparable (excluded, never counted as a valid
 * measurement) when it ran without `--with-llm`, when the shipped spec regressed
 * vs its baseline, or when the skill emitted a malformed/absent benchmark-summary.
 * Median for the quality axis (robust to a one-off broken pass), mean for the cost
 * axis (expected spend); this asymmetry is stated in the rendered doc.
 *
 * See specs/2026-07-05-benchmark-improve-cost/ for the full design.
 *
 * The real measurement is a MANUAL run — it spends real scorecard quota and real
 * LLM budget and its outputs are stochastic. The deterministic modes below
 * (`--dry-run`, `--render-only`) spend nothing and are the merge gates.
 *
 * Runs are driven concurrently (`--concurrency N`, default 3): each `claude -p`
 * gets its own isolated cwd, so the skill's cwd-relative `./.jentic-improve-work`
 * never clashes between concurrent runs. The cap bounds concurrent Docker engine
 * containers / Bedrock callers / scorecard-quota bursts — it does not change the
 * total work or the deterministic output order. `--concurrency 1` is sequential.
 *
 * Usage:
 *   node scripts/bench-improve.js --dry-run [--samples N] [--concurrency N]
 *       Print the planned model × spec matrix (× N samples, N at a time) and the
 *       per-cell plumbing; make no claude -p / model / score call. Exits 0.
 *
 *   node scripts/bench-improve.js --render-only --data <file> [--output-dir <dir>]
 *       Render docs/improve-cost-benchmark.md from an existing results data file.
 *       Pure function of the data file (aggregates recomputed from each cell's
 *       samples[]); no measurement. `--samples`/`--concurrency` have no effect here.
 *
 *   node scripts/bench-improve.js [--samples N] [--concurrency N] [--keep-work] \
 *       [--output <file>] [--run-date <YYYY-MM-DD>]
 *       Perform the real measurement run (manual, SPENDS MONEY): drive the skill
 *       N times per cell via `claude -p` (which scores `--with-llm`), up to
 *       `--concurrency` runs at once, record each sample's agent surface from
 *       claude's JSON and its engine surface + run outcome from the skill's
 *       token-usage.json / benchmark-summary.json, write the results data file
 *       (default scripts/bench-improve.data.json), then render the doc. Records
 *       per-sample + total wall-clock. `--keep-work` retains the temp work root
 *       (default: removed after render). Cost scales with N × models × specs.
 *
 * Prerequisites for a real run:
 *   - Docker daemon running (the scorecard CLI spawns the engine container).
 *   - JENTIC_API_KEY exported (the improve loop's in-loop re-scores run on a local
 *     working copy, which always costs one scorecard quota unit and needs a key).
 *   - `claude` CLI installed and authenticated (drives the skill headlessly).
 *   - `--with-llm` LLM provider credentials in the environment (cloud provider keys
 *     or a local OpenAI-compatible endpoint) — the engine surface is only populated
 *     when the skill can run `--with-llm`; the CLI forwards detected creds.
 *   Budget at least three scorecard quota units per matrix cell.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const renderOnly = args.includes('--render-only');

function argValue(flag, fallback) {
  const idx = args.indexOf(flag);
  if (idx < 0) return fallback;
  if (!args[idx + 1]) {
    console.error(`❌  Missing value for ${flag}`);
    process.exit(1);
  }
  return args[idx + 1];
}

// How many times each matrix cell is driven (the stochasticity control). Only
// affects the real run and its dry-run reflection — `--render-only` is a pure
// function of the data file's samples[], whatever length that is.
const SAMPLES = Number(argValue('--samples', '3'));
if (!Number.isInteger(SAMPLES) || SAMPLES < 1) {
  console.error(`❌  --samples must be a positive integer (got ${argValue('--samples', '3')})`);
  process.exit(1);
}

// How many `claude -p` runs execute at once. Each run gets its own isolated cwd
// (so the skill's cwd-relative `./.jentic-improve-work` cannot clash), so the cap
// is really a bound on concurrent Docker engine containers, Bedrock callers, and
// scorecard-quota bursts — not a correctness knob. `--concurrency 1` reproduces
// the strictly-sequential behaviour. Only affects the real run + its dry-run
// reflection; `--render-only` is unaffected.
const CONCURRENCY = Number(argValue('--concurrency', '3'));
if (!Number.isInteger(CONCURRENCY) || CONCURRENCY < 1) {
  console.error(
    `❌  --concurrency must be a positive integer (got ${argValue('--concurrency', '3')})`,
  );
  process.exit(1);
}

// Keep the per-run temp work root after a real run (for debugging); default is to
// remove it once the doc has rendered.
const keepWork = args.includes('--keep-work');

// The doc always lands here (relative to repo root); --output-dir redirects the
// base so the render can be diff-checked into a temp dir without touching the repo.
const DOC_RELPATH = path.join('docs', 'improve-cost-benchmark.md');

// ── Config ────────────────────────────────────────────────────────────────
// The coding-agent model axis. `fable` is a Claude Code agent-model alias; it
// varies the agent surface only. The engine `--with-llm` model is chosen by the
// engine (Bedrock-fixed) and reported in each run's token-usage.json.
const AGENT_MODELS = ['haiku', 'sonnet', 'opus', 'fable'];

// The opt-in artifacts the skill writes when benchmark metrics are requested:
// engine token usage, and the run outcome (scores before/after + iterations).
const TOKEN_USAGE_FILE = 'token-usage.json';
const SUMMARY_FILE = 'benchmark-summary.json';

// The input-spec axis: OAK specs (raw githubusercontent.com URLs under the gate
// allowlist). Scoring these by URL is quota-free; the improve loop's in-loop
// re-scores run on the local working copy and do cost quota. The per-run
// before/after scores come from benchmark-summary.json, not from here. The
// anchor spec is the repo's known-good petstore; pin more spanning size/quality.
const OAK_BASE =
  'https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi';
const INPUT_SPECS = [
  {
    id: 'petstore',
    url: `${OAK_BASE}/swagger-api/petstore/1.0.27/openapi.json`,
  },
];

/** Build the full model × spec matrix as an array of planned cells. */
function buildMatrix() {
  const cells = [];
  for (const model of AGENT_MODELS) {
    for (const spec of INPUT_SPECS) {
      cells.push({ model, spec });
    }
  }
  return cells;
}

/**
 * Assemble the `claude -p` argv that drives the skill headlessly for one cell.
 * The prompt scores `--with-llm` and explicitly requests engine token usage, so
 * the skill opts in (adds `--report-token-usage` to every score and writes
 * token-usage.json — the engine surface this benchmark reads). Kept as an array
 * so it is never shell-interpolated.
 */
function claudeArgv(model, spec, outDir) {
  return [
    '-p',
    `Use the jentic-api-improve skill to improve the OpenAPI document at ${spec.url}, ` +
      `writing outputs into ${outDir}. Score with \`--with-llm\` and report benchmark ` +
      `metrics (emit token-usage.json and benchmark-summary.json). Run the standard loop and then stop.`,
    '--model',
    model,
    '--output-format',
    'json',
    '--permission-mode',
    'bypassPermissions',
  ];
}

/**
 * Read the engine token-usage surface for one sample from the `token-usage.json`
 * the skill wrote into its output dir. Token fields are null when the file is
 * absent/unparseable or the run recorded `withLlm: false` — a gap is never read
 * as zero cost. `withLlm` is preserved (as `false`/`null`, not collapsed into the
 * anonymous null gap) so the sample validator can tell "ran without --with-llm"
 * (an operator error) apart from a genuine token-reporting gap.
 */
function readEngineUsage(outDir) {
  const file = path.join(outDir, TOKEN_USAGE_FILE);
  const empty = {
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    llmCalls: null,
    model: null,
    provider: null,
    withLlm: null,
  };
  if (!fs.existsSync(file)) return empty;
  let usage;
  try {
    usage = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return empty;
  }
  if (!usage) return empty;
  if (usage.withLlm === false) return { ...empty, withLlm: false };
  return {
    inputTokens: usage.inputTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    totalTokens: usage.totalTokens ?? null,
    llmCalls: usage.llmCalls ?? null,
    model: usage.model ?? null,
    provider: usage.provider ?? null,
    withLlm: usage.withLlm ?? null,
  };
}

/**
 * Read the run outcome for one cell from the `benchmark-summary.json` the skill
 * writes into its output dir. Returns nulls when the file is absent or
 * unparseable so a gap renders `—`, never fabricated.
 */
function readBenchmarkSummary(outDir) {
  const file = path.join(outDir, SUMMARY_FILE);
  const empty = { scoreBefore: null, scoreAfter: null, iterationsRun: null };
  if (!fs.existsSync(file)) return empty;
  let summary;
  try {
    summary = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return empty;
  }
  if (!summary) return empty;
  return {
    scoreBefore: summary.scoreBefore ?? null,
    scoreAfter: summary.scoreAfter ?? null,
    iterationsRun: summary.iterationsRun ?? null,
  };
}

/**
 * Extract the agent surface's token usage + cost from a `claude -p
 * --output-format json` result object. Input tokens include cache-creation and
 * cache-read (the agent really consumed them). Returns nulls when the shape is
 * absent so a parse gap is never read as zero cost.
 */
function parseAgentUsage(result) {
  const u = result && typeof result === 'object' ? result.usage : null;
  if (!u || typeof u !== 'object') {
    return { inputTokens: null, outputTokens: null, costUsd: null };
  }
  const input =
    (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  return {
    inputTokens: typeof u.input_tokens === 'number' ? input : null,
    outputTokens: typeof u.output_tokens === 'number' ? u.output_tokens : null,
    costUsd: typeof result.total_cost_usd === 'number' ? result.total_cost_usd : null,
  };
}

// ── Sample validation + aggregation (pure, no deps) ───────────────────────────

/** Median of the numeric values; [] (or no numbers) → null. */
function median(nums) {
  const sorted = nums.filter((n) => typeof n === 'number').sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Arithmetic mean of the numeric values; [] (or no numbers) → null. */
function mean(nums) {
  const vals = nums.filter((n) => typeof n === 'number');
  if (vals.length === 0) return null;
  return vals.reduce((sum, n) => sum + n, 0) / vals.length;
}

/** {min, max} of the numeric values; [] (or no numbers) → {min: null, max: null}. */
function minMax(nums) {
  const vals = nums.filter((n) => typeof n === 'number');
  if (vals.length === 0) return { min: null, max: null };
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

/**
 * Classify one COMPLETED sample as comparable or not. Returns a human-facing
 * reason string when the sample must not count as a valid measurement, else null.
 * A hard `error` (claude crashed) is handled upstream and is not re-checked here.
 * Order matters — the first failing condition wins so the reason is specific.
 */
function validateSample(sample) {
  const engine = sample.engine ?? {};
  const before = sample.scoreBefore;
  const after = sample.scoreAfter;
  if (typeof before !== 'number' || typeof after !== 'number') {
    return 'malformed benchmark-summary.json (scoreBefore/scoreAfter missing)';
  }
  if (engine.withLlm === false) {
    return 'ran without --with-llm (engine surface not comparable)';
  }
  if (engine.inputTokens == null) {
    return 'engine token usage missing under --with-llm';
  }
  if (after < before) {
    return `regression: scoreAfter ${after} < scoreBefore ${before}`;
  }
  return null;
}

/**
 * The reason a sample does not count: its hard `error`, else its `invalid`
 * verdict (a stored one, or computed via validateSample), else null (valid).
 */
function sampleReason(sample) {
  if (sample.error) return sample.error;
  return sample.invalid ?? validateSample(sample);
}

/** The samples of a cell that count as a valid, comparable measurement. */
function validSamples(cell) {
  return (cell.samples ?? []).filter((s) => sampleReason(s) == null);
}

/**
 * Derive a cell's render-time aggregate from its VALID samples only: median
 * score (robust to a one-off broken pass) with a min–max range, mean of the
 * token/cost surfaces (expected spend), and how many of N samples were valid.
 * All fields are null when no sample is valid — never fabricated as zero.
 */
function aggregateCell(cell) {
  const samples = cell.samples ?? [];
  const valid = validSamples(cell);
  const scoreAfters = valid.map((s) => s.scoreAfter);
  const range = minMax(scoreAfters);
  return {
    sampleCount: samples.length,
    validCount: valid.length,
    scoreBefore: median(valid.map((s) => s.scoreBefore)),
    scoreAfterMedian: median(scoreAfters),
    scoreAfterMin: range.min,
    scoreAfterMax: range.max,
    iterationsRun: median(valid.map((s) => s.iterationsRun)),
    // Token means rounded to whole tokens (a fractional token is meaningless);
    // cost keeps its cents via usd().
    agentInput: roundOrNull(mean(valid.map((s) => s.agent?.inputTokens))),
    agentOutput: roundOrNull(mean(valid.map((s) => s.agent?.outputTokens))),
    agentCost: mean(valid.map((s) => s.agent?.costUsd)),
    engineInput: roundOrNull(mean(valid.map((s) => s.engine?.inputTokens))),
    engineOutput: roundOrNull(mean(valid.map((s) => s.engine?.outputTokens))),
  };
}

/** Round a number to the nearest integer; pass null/non-numbers through. */
function roundOrNull(n) {
  return typeof n === 'number' ? Math.round(n) : null;
}

/** Distinct non-comparable reasons across a cell's samples, with counts. */
function excludedReasons(cell) {
  const counts = new Map();
  for (const sample of cell.samples ?? []) {
    const reason = sampleReason(sample);
    if (reason == null) continue;
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()].map(([reason, count]) => ({ reason, count }));
}

/**
 * Exercise the matrix and per-cell plumbing without spending anything: for each
 * cell assemble (and print) the real `claude -p` argv and the token-usage.json
 * path the engine surface will be read from. No `claude` / model / score call.
 */
function runDryRun() {
  const cells = buildMatrix();
  const runs = cells.length * SAMPLES;
  const waves = Math.ceil(runs / CONCURRENCY);
  console.log(
    `Benchmark matrix — ${SAMPLES} samples × ${AGENT_MODELS.length} models × ` +
      `${INPUT_SPECS.length} specs = ${runs} planned runs (${cells.length} cells), ` +
      `${CONCURRENCY} at a time (~${waves} wave${waves === 1 ? '' : 's'})`,
  );
  console.log('');

  for (const { model, spec } of cells) {
    const argv = claudeArgv(model, spec, `<out-dir>/${model}-${spec.id}-s<i>`);
    console.log(`▸ agent=${model}  spec=${spec.id}  (${SAMPLES} samples)`);
    console.log(`    input: ${spec.url}`);
    console.log(`    drive: claude ${argv.join(' ')}`);
    console.log(
      `    cwd: <work-root>/${model}-${spec.id}-s<i>-cwd (isolated ./.jentic-improve-work per run)`,
    );
    console.log(
      `    metrics: per sample, read from <out-dir>/${model}-${spec.id}-s<i>/` +
        `${TOKEN_USAGE_FILE} + ${SUMMARY_FILE}; aggregate median score + range over valid samples`,
    );
    console.log('    (dry-run — no claude / model / score call made)');
  }
  console.log('');
  console.log(
    `✅  dry-run complete: ${cells.length} cells × ${SAMPLES} samples = ${runs} planned runs, ` +
      `concurrency=${CONCURRENCY}, 0 LLM calls, 0 quota consumed`,
  );
}

/** Format a millisecond duration as `Hh MMm SSs` / `MMm SSs` / `SSs`. */
function msToClock(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// ── Doc rendering (pure function of a results data file) ──────────────────────
function num(n) {
  return typeof n === 'number' ? n.toLocaleString('en-US') : '—';
}

/** A score rounded to two decimals for the table; non-numbers render `—`. */
function score(n) {
  return typeof n === 'number' ? n.toFixed(2) : '—';
}

function usd(n) {
  return typeof n === 'number' ? `$${n.toFixed(3)}` : '—';
}

/** A min–max range string; `—` when there is no spread to show (≤1 valid point). */
function range(agg) {
  if (typeof agg.scoreAfterMin !== 'number' || agg.validCount <= 1) return '—';
  return `${agg.scoreAfterMin.toFixed(2)}–${agg.scoreAfterMax.toFixed(2)}`;
}

/**
 * A cell counts as measured once at least one of its samples is a valid,
 * comparable measurement. A cell with `samples: []` (never run) or whose every
 * sample errored / was non-comparable is NOT measured.
 */
function isMeasured(cell) {
  return validSamples(cell).length > 0;
}

/** Render the benchmark markdown doc from a parsed results data object. */
function renderDoc(data) {
  const cells = Array.isArray(data.cells) ? data.cells : [];
  const anyMeasured = cells.some(isMeasured);
  const out = [];

  out.push('<!-- Generated by scripts/bench-improve.js --render-only. Do not edit manually. -->');
  out.push('');
  out.push('# jentic-api-improve — token usage and cost benchmark');
  out.push('');
  if (!anyMeasured) {
    out.push(
      '> **Not yet measured.** This benchmark has not been run against live models. The matrix, ' +
        'input specs, and table shape below are in place; the number cells are placeholders (`—`). ' +
        'Run `npm run bench:improve` with the prerequisites in `scripts/bench-improve.js`, then ' +
        'regenerate this doc with `--render-only`. No numbers here are fabricated.',
    );
    out.push('');
  }
  const engineModel =
    cells.flatMap((c) => (c.samples ?? []).map((s) => s.engine?.model)).find(Boolean) ?? null;
  // Sample count for the prose is derived from `data` only (never the CLI SAMPLES
  // global) so --render-only stays a pure function of the data file: prefer the
  // stamped `data.samples`, else the widest per-cell samples[] actually present.
  const sampleCount =
    data.samples ?? cells.reduce((max, c) => Math.max(max, (c.samples ?? []).length), 0);
  out.push(
    `Target: \`@jentic/api-scorecard-cli\` **${data.cliVersion ?? 'unknown'}**` +
      `${anyMeasured ? `, measured on **${data.runDate ?? 'unknown'}**` : ''}. ` +
      `The engine \`--with-llm\` model is chosen by the engine${engineModel ? ` (\`${engineModel}\`)` : ''} and is ` +
      'the same across every cell, so differences reflect the coding-agent model, not the engine.',
  );
  out.push('');
  out.push(
    `Each cell drives the skill through its standard 2-iteration loop ${sampleCount} ` +
      'times (the skill’s output is stochastic). **Score after** is the median and **Range** the ' +
      'min–max over the cell’s valid samples; token and cost columns are the mean over the same ' +
      'samples (median for the quality axis, mean for the cost axis). **Valid** shows how many of ' +
      'N samples were comparable — non-comparable samples (ran without `--with-llm`, regressed vs ' +
      'baseline, or emitted a malformed summary) are excluded and listed below the table. Cost ' +
      'splits across two surfaces: the coding **agent**’s own reasoning (from `claude -p`) and the ' +
      'scoring **engine**’s `--with-llm` analysis (from each run’s `token-usage.json`). See ' +
      '[`docs/llm-signals.md`](./llm-signals.md) for the engine LLM recipe.',
  );
  out.push('');

  out.push('## Results');
  out.push('');
  out.push(
    '| Agent model | Spec | Valid | Score before | Score after (median) | Range | Iters | ' +
      'Agent in | Agent out | Agent $ | Engine in | Engine out |',
  );
  out.push('|---|---|:--:|---:|---:|:--:|---:|---:|---:|---:|---:|---:|');
  const excluded = [];
  for (const c of cells) {
    const spec = c.spec ?? {};
    const samples = c.samples ?? [];
    const agg = aggregateCell(c);
    for (const { reason, count } of excludedReasons(c)) {
      excluded.push(`- \`${c.model}\` / ${spec.id ?? '—'}: ${reason} (${count})`);
    }
    if (samples.length === 0) {
      // Never run → all-`—` placeholder row (distinct from "ran and all failed").
      out.push(`| \`${c.model}\` | ${spec.id ?? '—'} | — | — | — | — | — | — | — | — | — | — |`);
      continue;
    }
    if (agg.validCount === 0) {
      // Ran, but no comparable sample → error row carrying the aggregated reason.
      const reasons =
        excludedReasons(c)
          .map(({ reason, count }) => `${reason} (${count})`)
          .join('; ') || 'no valid sample';
      out.push(
        `| \`${c.model}\` | ${spec.id ?? '—'} | 0/${agg.sampleCount} | — | ${reasons} | — | — | — | — | — | — | — |`,
      );
      continue;
    }
    out.push(
      `| \`${c.model}\` | ${spec.id ?? '—'} | ${agg.validCount}/${agg.sampleCount} | ` +
        `${score(agg.scoreBefore)} | ${score(agg.scoreAfterMedian)} | ${range(agg)} | ${num(agg.iterationsRun)} | ` +
        `${num(agg.agentInput)} | ${num(agg.agentOutput)} | ${usd(agg.agentCost)} | ` +
        `${num(agg.engineInput)} | ${num(agg.engineOutput)} |`,
    );
  }
  out.push('');

  if (excluded.length > 0) {
    out.push('### Excluded samples');
    out.push('');
    out.push('Samples that did not count toward the aggregates above, and why:');
    out.push('');
    out.push(...excluded);
    out.push('');
  }

  out.push('## Input specs');
  out.push('');
  out.push('| Spec | Source |');
  out.push('|---|---|');
  const seen = new Set();
  for (const c of cells) {
    const spec = c.spec ?? {};
    if (!spec.id || seen.has(spec.id)) continue;
    seen.add(spec.id);
    out.push(`| ${spec.id} | ${spec.url ?? '—'} |`);
  }
  out.push('');

  out.push('## Model-selection guidance');
  out.push('');
  out.push(
    anyMeasured
      ? '_Guidance is written from the measured run above. Re-generate this doc after any re-measurement._'
      : '_Guidance will be written from the first measured run. Nothing to recommend until then._',
  );
  out.push('');

  return out.join('\n') + '\n';
}

/** Render `data` to the benchmark doc, honoring an optional --output-dir base. */
function renderToFile(data) {
  const content = renderDoc(data);
  const outputDir = argValue('--output-dir', null);
  const outPath = outputDir
    ? path.resolve(ROOT, outputDir, DOC_RELPATH)
    : path.join(ROOT, DOC_RELPATH);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`✅  rendered ${DOC_RELPATH} (${content.split('\n').length} lines) → ${outPath}`);
}

function runRenderOnly() {
  const dataPath = argValue('--data', null);
  if (!dataPath) {
    console.error('❌  --render-only requires --data <results.json>');
    process.exit(1);
  }
  const resolvedData = path.resolve(ROOT, dataPath);
  if (!fs.existsSync(resolvedData)) {
    console.error(`❌  Data file not found: ${resolvedData}`);
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(resolvedData, 'utf8'));
  } catch (err) {
    console.error(`❌  Data file is not valid JSON: ${err.message}`);
    process.exit(1);
  }
  renderToFile(data);
}

/**
 * Spawn `claude` with the given argv in `cwd`; resolve the parsed JSON result.
 * `cwd` isolates the skill's cwd-relative `./.jentic-improve-work` so concurrent
 * runs never clash. stdout is captured per-call (closure), so concurrent
 * invocations do not cross-contaminate the parsed JSON.
 */
function runClaude(argv, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', argv, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`claude exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(new Error(`could not parse claude --output-format json output: ${err.message}`));
      }
    });
  });
}

/**
 * Run zero-arg async thunks with at most `limit` in flight, returning their
 * results in the SAME ORDER as `tasks` (indexed, not completion order). Never
 * rejects: each thunk is expected to catch its own errors and resolve to a value
 * (the honesty invariant — a crashed run becomes an error *sample*, not a pool
 * rejection); a thunk that throws anyway settles its slot defensively so one bad
 * task cannot abort the batch. Exactly `min(limit, tasks.length)` workers start;
 * each pulls the next unclaimed index until the queue drains (`next++` is atomic
 * — single-threaded JS, no await between the read and the increment).
 */
async function runPool(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(limit, tasks.length));
  async function worker() {
    for (let i = next++; i < tasks.length; i = next++) {
      try {
        results[i] = await tasks[i]();
      } catch (err) {
        results[i] = { __poolError: err };
      }
    }
  }
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

/**
 * Drive the skill once for one sample: run `claude -p` (which scores `--with-llm`)
 * in an ISOLATED cwd so the skill's cwd-relative `./.jentic-improve-work` cannot
 * clash with a concurrent run, then record the agent surface (from claude's JSON),
 * the engine surface + run outcome (from the files the skill wrote into `outDir`),
 * per-sample timing, and a validity verdict. Writes the result into `samplesArr[i]`
 * by index so the persisted order is deterministic regardless of completion order.
 * Catches its own error into `sample.error` (never fabricated).
 */
async function runSample(cell, i, samplesArr, workRoot) {
  const { model, spec } = cell;
  const base = `${model}-${spec.id}-s${i}`;
  const outDir = path.join(workRoot, base);
  const cwdDir = path.join(workRoot, `${base}-cwd`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(cwdDir, { recursive: true });

  const sample = {
    agent: { inputTokens: null, outputTokens: null, costUsd: null },
    engine: {
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      llmCalls: null,
      model: null,
      provider: null,
      withLlm: null,
    },
    iterationsRun: null,
    scoreBefore: null,
    scoreAfter: null,
    error: null,
    invalid: null,
    startedAt: null,
    endedAt: null,
    durationMs: null,
  };

  const start = Date.now();
  sample.startedAt = new Date(start).toISOString();
  try {
    const argv = claudeArgv(model, spec, outDir);
    const result = await runClaude(argv, cwdDir);
    sample.agent = parseAgentUsage(result);
    sample.engine = readEngineUsage(outDir);
    const summary = readBenchmarkSummary(outDir);
    sample.scoreBefore = summary.scoreBefore;
    sample.scoreAfter = summary.scoreAfter;
    sample.iterationsRun = summary.iterationsRun;
    sample.invalid = validateSample(sample);
    if (sample.invalid) console.error(`  ⚠ ${model}/${spec.id} sample ${i}: ${sample.invalid}`);
  } catch (err) {
    sample.error = err.message;
    console.error(`  ✗ ${model}/${spec.id} sample ${i}: ${err.message}`);
  }
  const end = Date.now();
  sample.endedAt = new Date(end).toISOString();
  sample.durationMs = end - start;
  const status = sample.error ? 'error' : sample.invalid ? 'invalid' : 'ok';
  console.error(
    `  ✓ ${model}/${spec.id} sample ${i} done in ${msToClock(sample.durationMs)} (${status})`,
  );
  samplesArr[i] = sample;
}

/**
 * Perform the real measurement run. For each cell, drive the skill headlessly
 * via `claude -p` (which scores `--with-llm`) `SAMPLES` times into per-sample
 * output dirs; each sample records the agent surface (from claude's JSON), the
 * engine surface (from its token-usage.json), the run outcome (from its
 * benchmark-summary.json), and a validity verdict. A sample that crashes carries
 * an `error`; a sample that completes but is non-comparable carries an `invalid`
 * reason. Writes a results data file (cells → samples[]) and renders the doc; the
 * aggregates are derived from samples[] at render time, never persisted here.
 */
async function runReal() {
  if (!process.env['JENTIC_API_KEY']) {
    console.error(
      '❌  JENTIC_API_KEY must be set (the improve loop re-scores a local working copy).',
    );
    process.exit(1);
  }

  const cells = buildMatrix();
  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-improve-'));

  // Pre-allocate the result structure in buildMatrix() order; every sample lands
  // at results[c].samples[i] by index, so the persisted order is deterministic
  // regardless of the order the pool completes runs in.
  const results = cells.map(({ model, spec }) => ({
    model,
    spec: { id: spec.id, url: spec.url },
    samples: new Array(SAMPLES),
  }));

  // One flat task list; each thunk knows exactly which sample slot to fill.
  const tasks = [];
  for (let c = 0; c < cells.length; c++) {
    for (let i = 0; i < SAMPLES; i++) {
      tasks.push(() => runSample(cells[c], i, results[c].samples, workRoot));
    }
  }

  console.log(
    `▸ measuring ${tasks.length} runs (${cells.length} cells × ${SAMPLES} samples) ` +
      `at concurrency ${CONCURRENCY} …`,
  );
  const runStart = Date.now();
  await runPool(tasks, CONCURRENCY);
  const totalDurationMs = Date.now() - runStart;

  const data = {
    cliVersion: JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/cli/package.json'), 'utf8'))
      .version,
    runDate: argValue('--run-date', new Date().toISOString().slice(0, 10)),
    samples: SAMPLES,
    concurrency: CONCURRENCY,
    totalDurationMs,
    cells: results,
  };

  const dataOut = argValue('--output', path.join('scripts', 'bench-improve.data.json'));
  const dataPath = path.resolve(ROOT, dataOut);
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`✅  wrote results → ${dataPath}`);
  renderToFile(data);

  // Wall-clock summary: total vs the sequential-equivalent (sum of per-sample
  // durations), and the speedup the concurrency bought.
  const sequentialMs = results
    .flatMap((cell) => cell.samples)
    .reduce((sum, sample) => sum + (sample?.durationMs ?? 0), 0);
  const speedup = totalDurationMs > 0 ? (sequentialMs / totalDurationMs).toFixed(2) : '—';
  console.log(
    `⏱  total ${msToClock(totalDurationMs)} at concurrency ${CONCURRENCY} ` +
      `(sequential-equivalent ${msToClock(sequentialMs)}, ${speedup}× speedup)`,
  );

  // The per-run temp root (outDirs + isolated cwds) is otherwise leaked every run.
  if (keepWork) {
    console.log(`ℹ  kept work root ${workRoot} (--keep-work)`);
  } else {
    fs.rmSync(workRoot, { recursive: true, force: true });
  }
}

// ── Dispatch ────────────────────────────────────────────────────────────────
if (renderOnly) {
  runRenderOnly();
} else if (dryRun) {
  runDryRun();
} else {
  await runReal();
}
