# Phase 22 Plan — Benchmark jentic-api-improve Token Usage and Cost

All new code lives under `scripts/` (Node ESM, zero-dependency, matching `scripts/extract-docs.js`). Nothing under `packages/`, `docker/`, or the CLI/container changes. Groups are ordered risky-bits-first: the two net-new pieces (the token-counting proxy, then the matrix harness) come before the deterministic data→doc rendering, so the uncertain parts are proven early.

## Group 1 — Token-counting OpenAI-compatible proxy

1. Create `scripts/token-proxy.mjs`: a Node `http.createServer` endpoint exposing `POST /v1/chat/completions` (OpenAI-compatible) that forwards each request to a real upstream provider (base URL + key from env, e.g. `PROXY_UPSTREAM_URL` / `PROXY_UPSTREAM_KEY`), returns the upstream response verbatim, and accumulates `usage.prompt_tokens` / `usage.completion_tokens` per request. Expose the running tally via an in-process accessor (the harness imports the proxy as a module) and/or a `GET /__usage` endpoint for out-of-process reads. Match `extract-docs.js` style: `#!/usr/bin/env node` shebang, ESM imports, `process.argv` for `--port`, `❌`/`✅`/`process.exit(1)` conventions.
2. Handle streaming vs non-streaming responses (the engine may request either); tally tokens from the final `usage` block, and if the upstream omits `usage` on a streamed response, record that cell's engine tokens as `null` (unknown) rather than 0, so a missing count is never silently read as free.
3. Add a self-check path exercised by `--dry-run` (Group 5 / Verify): the proxy can start, accept a canned request against a stub upstream, tally a known token count, and shut down — no real upstream call. Keep this stub inside the harness's dry-run wiring, not shipped as the default upstream.

## Group 2 — Benchmark harness: matrix driver

4. Create `scripts/bench-improve.js` (the harness entry): read a pinned config (models × spec set) — either inline or from a sibling `scripts/bench-improve.config.json` — where each spec records its OAK raw-`githubusercontent.com` URL and baseline JAIRF score. Seed the config with the confirmed anchor spec (`.../apis/openapi/swagger-api/petstore/1.0.27/openapi.json`) plus 2–3 more OAK specs selected during implementation to span low/mid/high baseline score; record each URL + baseline score in the config.
5. For each matrix cell (agent-model × spec): start the token-counting proxy (Group 1) on a free port; set the engine `--with-llm` env to the local-provider recipe pointed at the proxy (`LLM_PROVIDER=OPENAI`, `LIGHT_LLM_PROVIDER=OPENAI`, `OPENAI_API_URL=http://localhost:<port>/v1/chat/completions`, `OPENAI_API_KEY=<non-empty>`, `LLM_LIGHT_MODEL=<fixed engine model>`) held fixed across all cells; and invoke the skill headlessly via `claude -p "<invoke the jentic-api-improve skill on <specURL> <outDir>>" --model <agent-model> --output-format json` (use `--permission-mode bypassPermissions` for unattended runs per the skill's autonomy note). Ensure `JENTIC_API_KEY` is present for the in-loop re-scores on the local working copy.
6. After each cell: read the coding agent's own `usage` + `total_cost_usd` from the `claude -p` JSON output; read the engine token tally from the proxy; read the skill's own output artifacts (the improved spec's changelog / score before-after) for the score delta and iterations run. Handle the skill's terminal exit conditions defensively — treat both exit 1 (host-side "no LLM provider") and exit 8 (in-container LLM failure) as a recorded cell error, and stop-and-record on quota (7), Docker (4), and auth (2/3) rather than silently producing a zero-cost cell.
7. Add a `--dry-run` flag: iterate the full matrix and exercise all plumbing (proxy start/stop, env assembly, command construction) against the stub upstream from task 3, printing each planned cell, without invoking `claude -p` or any real model or `score` call; exit 0.

## Group 3 — Results data file

8. Define and emit a machine-readable per-cell results data file (JSON, e.g. `scripts/bench-improve.results.json` or a `--output` path): one record per cell with `{ model, spec: {url, baseline_score}, agent: {input_tokens, output_tokens, cost_usd}, engine: {input_tokens, output_tokens}, iterations_run, score_before, score_after, cli_version, run_date, error? }`. Split token counts by surface (engine vs agent) explicitly. Stamp `cli_version` (read from `packages/cli/package.json`) and `run_date` into the file header/metadata.
9. Commit a small **sample** results data file (`scripts/bench-improve.sample.json`) with representative but clearly-labelled illustrative numbers, so the deterministic doc-render check (Group 4 / Verify) has a fixture to run against without any measurement.

## Group 4 — Deterministic data→doc generator

10. Add a `--render-only --data <file>` mode to `scripts/bench-improve.js` (or a sibling pure function it calls) that reads a results data file and produces `docs/improve-cost-benchmark.md`: a results table across models × specs with token and cost totals broken down by surface (engine vs agent), the pinned spec set (URL + baseline score), model-selection guidance/takeaways, and a header stamping the measured `cli_version` + run date. This step performs no measurement and calls no model — it is a pure function of the data file.
11. Ensure `--render-only` can target a temp `--output-dir` (like `extract-docs.js`'s preview mode) so the generated doc can be diffed against the committed one without writing into the repo.

## Group 5 — Manual measurement run + committed doc

12. Document the manual run recipe in a comment header in `scripts/bench-improve.js` and briefly in the doc: prerequisites (Docker running, `JENTIC_API_KEY`, `claude` CLI authenticated, `PROXY_UPSTREAM_*` set), the `bench:improve` invocation, and the ~3-quota-units-per-cell budget warning.
13. Perform one real measurement run across the pinned matrix (manual; spends real quota + LLM budget), write the real results data file, and generate the committed `docs/improve-cost-benchmark.md` from it via the Group 4 renderer. If a full matrix run is impractical at implementation time, record a documented partial run and clearly mark unmeasured cells — never fabricate numbers.

## Group 6 — Wiring, docs, and roadmap lifecycle

14. Add a `bench:improve` script entry to the root `package.json` `scripts` block, beside the existing `docs:*` entries (e.g. `"bench:improve": "node scripts/bench-improve.js"`); add a `bench:improve:dry-run` if a distinct dry-run entry is useful.
15. Cross-reference the new benchmark from `docs/llm-signals.md` (the existing `--with-llm` provider/recipe doc) if a natural pointer fits; do not restructure that doc. Confirm no README `## CLI reference` sync is needed (CLI surface unchanged, per `.claude/rules/cli-readme-sync.md`) and no `specs/tech-stack.md` update is triggered (no new load-bearing dependency, per `.claude/rules/update-tech-stack-on-deps.md`).
16. Append ` ✅` (a single space followed by the U+2705 checkmark) to the `## Phase 22 — Benchmark jentic-api-improve Token Usage and Cost` heading in `specs/roadmap.md`, leaving the rest of the block untouched.

## Group 7 — Verify

17. `npx eslint scripts/bench-improve.js scripts/token-proxy.mjs` and `npx prettier --check scripts/bench-improve.js scripts/token-proxy.mjs` both exit 0 (explicit — `npm run lint` does NOT cover `scripts/*.js`; `eslint.config.js` ignores `**/*.js`).
18. `node -e "JSON.parse(require('fs').readFileSync('scripts/bench-improve.sample.json','utf8'))"` exits 0 (sample data file is valid JSON); same check passes for the real results data file if committed.
19. Deterministic doc render matches the committed doc: `node scripts/bench-improve.js --render-only --data scripts/bench-improve.sample.json --output-dir /tmp/bench-check` produces a markdown file whose content matches what the committed `docs/improve-cost-benchmark.md` would be for that data (diff-clean against a render of the *same* data file) — proving the generator is a pure, reproducible function of its input.
20. `node scripts/bench-improve.js --dry-run` exits 0, prints every planned model×spec cell, and makes no real `claude -p`, model, or `score` call (verifiable: no network to a real provider, no scorecard quota consumed).
21. `docs/improve-cost-benchmark.md` exists and contains a results table with per-surface (engine vs agent) token/cost columns and the pinned spec set with baseline scores.
22. `grep -F "## Phase 22 — Benchmark jentic-api-improve Token Usage and Cost ✅" specs/roadmap.md` exits 0 (lifecycle marker present with the load-bearing leading space).
