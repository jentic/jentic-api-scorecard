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
 * See specs/2026-07-05-benchmark-improve-cost/ for the full design.
 *
 * The real measurement is a MANUAL run — it spends real scorecard quota and real
 * LLM budget and its outputs are stochastic. The deterministic modes below
 * (`--dry-run`, `--render-only`) spend nothing and are the merge gates.
 *
 * Usage:
 *   node scripts/bench-improve.js --dry-run
 *       Print the planned model × spec matrix and the per-cell plumbing; make no
 *       claude -p / model / score call. Exits 0.
 *
 *   node scripts/bench-improve.js --render-only --data <file> [--output-dir <dir>]
 *       Render docs/improve-cost-benchmark.md from an existing results data file.
 *       Pure function of the data file; no measurement.
 *
 *   node scripts/bench-improve.js [--output <file>] [--run-date <YYYY-MM-DD>]
 *       Perform the real measurement run (manual, SPENDS MONEY): drive the skill
 *       per cell via `claude -p` (which scores `--with-llm`), record the agent
 *       surface from claude's JSON and the engine surface + run outcome from the
 *       skill's token-usage.json / benchmark-summary.json, write the results data
 *       file (default
 *       scripts/bench-improve.data.json), then render the doc.
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
 * Read the engine token-usage surface for one cell from the `token-usage.json`
 * the skill wrote into its output dir. Returns nulls when the file is absent or
 * unparseable, or when the run recorded `withLlm: false` — a gap is never read
 * as zero cost.
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
  };
  if (!fs.existsSync(file)) return empty;
  let usage;
  try {
    usage = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return empty;
  }
  if (!usage || usage.withLlm === false) return empty;
  return {
    inputTokens: usage.inputTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    totalTokens: usage.totalTokens ?? null,
    llmCalls: usage.llmCalls ?? null,
    model: usage.model ?? null,
    provider: usage.provider ?? null,
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

/**
 * Exercise the matrix and per-cell plumbing without spending anything: for each
 * cell assemble (and print) the real `claude -p` argv and the token-usage.json
 * path the engine surface will be read from. No `claude` / model / score call.
 */
function runDryRun() {
  const cells = buildMatrix();
  console.log(
    `Benchmark matrix — ${AGENT_MODELS.length} models × ${INPUT_SPECS.length} specs = ${cells.length} cells`,
  );
  console.log('');

  for (const { model, spec } of cells) {
    const argv = claudeArgv(model, spec, '<out-dir>');
    console.log(`▸ agent=${model}  spec=${spec.id}`);
    console.log(`    input: ${spec.url}`);
    console.log(`    drive: claude ${argv.join(' ')}`);
    console.log(
      `    metrics: read from <out-dir>/${TOKEN_USAGE_FILE} + ${SUMMARY_FILE} after the run`,
    );
    console.log('    (dry-run — no claude / model / score call made)');
  }
  console.log('');
  console.log(`✅  dry-run complete: ${cells.length} cells planned, 0 LLM calls, 0 quota consumed`);
}

// ── Doc rendering (pure function of a results data file) ──────────────────────
function num(n) {
  return typeof n === 'number' ? n.toLocaleString('en-US') : '—';
}

function usd(n) {
  return typeof n === 'number' ? `$${n.toFixed(3)}` : '—';
}

/** A cell counts as measured once its agent input-token count is a real number. */
function isMeasured(cell) {
  return typeof cell?.agent?.inputTokens === 'number';
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
  const engineModel = cells.map((c) => c.engine?.model).find(Boolean) ?? null;
  out.push(
    `Target: \`@jentic/api-scorecard-cli\` **${data.cliVersion ?? 'unknown'}**` +
      `${anyMeasured ? `, measured on **${data.runDate ?? 'unknown'}**` : ''}. ` +
      `The engine \`--with-llm\` model is chosen by the engine${engineModel ? ` (\`${engineModel}\`)` : ''} and is ` +
      'the same across every cell, so differences reflect the coding-agent model, not the engine.',
  );
  out.push('');
  out.push(
    'Each run drives the skill through its standard 2-iteration loop. Cost splits across two ' +
      'surfaces: the coding **agent**’s own reasoning (from `claude -p`) and the scoring ' +
      '**engine**’s `--with-llm` analysis (from the run’s `token-usage.json`). See ' +
      '[`docs/llm-signals.md`](./llm-signals.md) for the engine LLM recipe.',
  );
  out.push('');

  out.push('## Results');
  out.push('');
  out.push(
    '| Agent model | Spec | Score before | Score after | Iters | Agent in | Agent out | Agent $ | Engine in | Engine out |',
  );
  out.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const c of cells) {
    const spec = c.spec ?? {};
    const agent = c.agent ?? {};
    const engine = c.engine ?? {};
    if (c.error) {
      out.push(
        `| \`${c.model}\` | ${spec.id ?? '—'} | ${num(c.scoreBefore)} | error | — | — | — | — | — | — |`,
      );
      continue;
    }
    out.push(
      `| \`${c.model}\` | ${spec.id ?? '—'} | ${num(c.scoreBefore)} | ${num(c.scoreAfter)} | ${num(c.iterationsRun)} | ` +
        `${num(agent.inputTokens)} | ${num(agent.outputTokens)} | ${usd(agent.costUsd)} | ${num(engine.inputTokens)} | ${num(engine.outputTokens)} |`,
    );
  }
  out.push('');

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

/** Spawn `claude` with the given argv; resolve the parsed JSON result. */
function runClaude(argv) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', argv, {
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
 * Perform the real measurement run. For each cell: drive the skill headlessly
 * via `claude -p` (which scores `--with-llm`), then record the agent surface
 * (from claude's JSON) and the engine surface (from the token-usage.json the
 * skill wrote into the cell's output dir). Writes a results data file and
 * renders the doc. Both surfaces are recorded as null on a gap — never fabricated.
 */
async function runReal() {
  if (!process.env['JENTIC_API_KEY']) {
    console.error(
      '❌  JENTIC_API_KEY must be set (the improve loop re-scores a local working copy).',
    );
    process.exit(1);
  }

  const cells = buildMatrix();
  const results = [];
  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-improve-'));

  for (const { model, spec } of cells) {
    console.log(`▸ measuring agent=${model} spec=${spec.id} …`);
    const outDir = path.join(workRoot, `${model}-${spec.id}`);
    fs.mkdirSync(outDir, { recursive: true });

    const cell = {
      model,
      spec: { id: spec.id, url: spec.url },
      agent: { inputTokens: null, outputTokens: null, costUsd: null },
      engine: {
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        llmCalls: null,
        model: null,
        provider: null,
      },
      iterationsRun: null,
      scoreBefore: null,
      scoreAfter: null,
      error: null,
    };

    try {
      const argv = claudeArgv(model, spec, outDir);
      const result = await runClaude(argv);
      cell.agent = parseAgentUsage(result);
      cell.engine = readEngineUsage(outDir);
      const summary = readBenchmarkSummary(outDir);
      cell.scoreBefore = summary.scoreBefore;
      cell.scoreAfter = summary.scoreAfter;
      cell.iterationsRun = summary.iterationsRun;
    } catch (err) {
      cell.error = err.message;
      console.error(`  ✗ ${model}/${spec.id}: ${err.message}`);
    }
    results.push(cell);
  }

  const data = {
    cliVersion: JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/cli/package.json'), 'utf8'))
      .version,
    runDate: argValue('--run-date', new Date().toISOString().slice(0, 10)),
    cells: results,
  };

  const dataOut = argValue('--output', path.join('scripts', 'bench-improve.data.json'));
  const dataPath = path.resolve(ROOT, dataOut);
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`✅  wrote results → ${dataPath}`);
  renderToFile(data);
}

// ── Dispatch ────────────────────────────────────────────────────────────────
if (renderOnly) {
  runRenderOnly();
} else if (dryRun) {
  runDryRun();
} else {
  await runReal();
}
