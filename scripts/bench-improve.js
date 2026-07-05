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
 *   - engine: the scoring engine's `--with-llm` analysis, captured by pointing the
 *             engine at scripts/token-proxy.mjs (the scorecard JSON does not expose
 *             token usage). The engine provider is held FIXED across the model axis.
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
 *       Pure function of the data file; no measurement. (Implemented in Group 4.)
 *
 *   node scripts/bench-improve.js [--output <file>]
 *       Perform the real measurement run (manual; needs Docker, JENTIC_API_KEY,
 *       an authenticated `claude` CLI, and PROXY_UPSTREAM_URL/KEY). Writes the
 *       results data file, then renders the doc. (Real run wired in Group 5.)
 *
 * Prerequisites for a real run:
 *   - Docker daemon running (the scorecard CLI spawns the engine container).
 *   - JENTIC_API_KEY exported (the improve loop's in-loop re-scores run on a local
 *     working copy, which always costs one scorecard quota unit and needs a key).
 *   - `claude` CLI installed and authenticated.
 *   - PROXY_UPSTREAM_URL / PROXY_UPSTREAM_KEY for the token-counting proxy upstream.
 *   Budget at least three scorecard quota units per matrix cell.
 */

import fs from 'fs';
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
// The coding-agent model axis. `fable` is a Claude Code agent-model alias; the
// engine `--with-llm` provider is a separate, fixed configuration (see below).
const AGENT_MODELS = ['haiku', 'sonnet', 'opus', 'fable'];

// The engine `--with-llm` provider, held fixed across every cell so the
// agent-model comparison isn't confounded. Pointed at the token-counting proxy
// at run time (Group 5); the model id here is the fixed engine light model.
const ENGINE_FIXED_MODEL = 'claude-haiku-4-5-20251001';

// The input-spec axis: OAK specs (raw githubusercontent.com URLs under the gate
// allowlist) with a recorded baseline JAIRF score. Scoring these by URL is
// quota-free; the improve loop's in-loop re-scores run on the local working copy
// and do cost quota. The anchor spec is the repo's known-good petstore; the
// remaining specs are pinned here spanning low / mid / high baseline score.
// baselineScore is recorded from a prior `score` of each URL; `null` = to be
// filled by the person running the real measurement.
const OAK_BASE =
  'https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi';
const INPUT_SPECS = [
  {
    id: 'petstore',
    url: `${OAK_BASE}/swagger-api/petstore/1.0.27/openapi.json`,
    baselineScore: null,
    note: 'anchor spec — used across the repo test suite',
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

/** Print the planned matrix and per-cell plumbing without spending anything. */
function runDryRun() {
  const cells = buildMatrix();
  console.log(
    `Benchmark matrix — ${AGENT_MODELS.length} models × ${INPUT_SPECS.length} specs = ${cells.length} cells`,
  );
  console.log(`Engine --with-llm model (fixed): ${ENGINE_FIXED_MODEL}`);
  console.log('');
  for (const { model, spec } of cells) {
    console.log(`▸ agent=${model}  spec=${spec.id}  baseline=${spec.baselineScore ?? 'TBD'}`);
    console.log(`    input: ${spec.url}`);
    console.log(
      `    plan: start token-proxy → set engine env (LLM_PROVIDER=OPENAI, OPENAI_API_URL=<proxy>, LLM_LIGHT_MODEL=${ENGINE_FIXED_MODEL})`,
    );
    console.log(
      `    drive: claude -p "<jentic-api-improve ${spec.id}>" --model ${model} --output-format json`,
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

/** Render the benchmark markdown doc from a parsed results data object. */
function renderDoc(data) {
  const cells = Array.isArray(data.cells) ? data.cells : [];
  const out = [];

  out.push('<!-- Generated by scripts/bench-improve.js --render-only. Do not edit manually. -->');
  out.push('');
  out.push('# jentic-api-improve — token usage and cost benchmark');
  out.push('');
  out.push(
    `Measured against \`@jentic/api-scorecard-cli\` **${data.cliVersion ?? 'unknown'}** on **${data.runDate ?? 'unknown'}**. ` +
      `The engine \`--with-llm\` model was held fixed at \`${data.engineFixedModel ?? 'unknown'}\` across every cell, ` +
      'so the differences below reflect the coding-agent model, not the engine.',
  );
  out.push('');
  out.push(
    'Each run drives the skill through its standard 2-iteration loop. Cost splits across two ' +
      'surfaces: the coding **agent**’s own reasoning and the scoring **engine**’s ' +
      '`--with-llm` analysis. See [`docs/llm-signals.md`](./llm-signals.md) for the engine LLM recipe.',
  );
  out.push('');

  out.push('## Results');
  out.push('');
  out.push(
    '| Agent model | Spec | Baseline | Score after | Iters | Agent in | Agent out | Agent $ | Engine in | Engine out |',
  );
  out.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const c of cells) {
    const spec = c.spec ?? {};
    const agent = c.agent ?? {};
    const engine = c.engine ?? {};
    if (c.error) {
      out.push(
        `| \`${c.model}\` | ${spec.id ?? '—'} | ${num(spec.baselineScore)} | error | — | — | — | — | — | — |`,
      );
      continue;
    }
    const engineIn = engine.unknown ? 'unknown' : num(engine.inputTokens);
    const engineOut = engine.unknown ? 'unknown' : num(engine.outputTokens);
    out.push(
      `| \`${c.model}\` | ${spec.id ?? '—'} | ${num(spec.baselineScore)} | ${num(c.scoreAfter)} | ${num(c.iterationsRun)} | ` +
        `${num(agent.inputTokens)} | ${num(agent.outputTokens)} | ${usd(agent.costUsd)} | ${engineIn} | ${engineOut} |`,
    );
  }
  out.push('');

  out.push('## Input specs');
  out.push('');
  out.push('| Spec | Baseline score | Source |');
  out.push('|---|---:|---|');
  const seen = new Set();
  for (const c of cells) {
    const spec = c.spec ?? {};
    if (!spec.id || seen.has(spec.id)) continue;
    seen.add(spec.id);
    out.push(`| ${spec.id} | ${num(spec.baselineScore)} | ${spec.url ?? '—'} |`);
  }
  out.push('');

  out.push('## Model-selection guidance');
  out.push('');
  out.push(
    '_Guidance is written from the measured run above. Re-generate this doc after any re-measurement._',
  );
  out.push('');

  return out.join('\n') + '\n';
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
  const content = renderDoc(data);
  const outputDir = argValue('--output-dir', null);
  const outPath = outputDir
    ? path.resolve(ROOT, outputDir, DOC_RELPATH)
    : path.join(ROOT, DOC_RELPATH);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`✅  rendered ${DOC_RELPATH} (${content.split('\n').length} lines) → ${outPath}`);
}

// ── Dispatch ────────────────────────────────────────────────────────────────
if (renderOnly) {
  runRenderOnly();
} else if (dryRun) {
  runDryRun();
} else {
  // The real measurement run is wired in Group 5.
  console.error(
    '❌  real measurement run is not yet wired; use --dry-run for the deterministic matrix preview',
  );
  process.exit(1);
}
