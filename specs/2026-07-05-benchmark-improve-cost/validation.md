# Phase 22 Validation — Benchmark jentic-api-improve Token Usage and Cost

## Definition of Done

All of the following must be true before this branch is merged. Every check here is deterministic and spends no scorecard quota and no LLM budget — the real model×spec measurement is a manual step (see Not Required), not a merge gate.

### 1. Harness lints and formats clean (explicit)

```
npx eslint scripts/bench-improve.js scripts/token-proxy.mjs
npx prettier --check scripts/bench-improve.js scripts/token-proxy.mjs
```

Both exit 0. This must be run explicitly: `npm run lint` does **not** cover `scripts/*.js` (`eslint.config.js` globally ignores `**/*.js` and the lint script targets only `packages/*` `src test`), so a `scripts/`-only change is invisible to the repo-wide lint.

### 2. Data file is valid JSON

```
node -e "JSON.parse(require('fs').readFileSync('scripts/bench-improve.sample.json','utf8'))"
```

Exits 0. The committed sample results data file parses as JSON. If a real results data file is also committed, the same check passes against it.

### 3. Doc generation is a pure, reproducible function of the data file

```
node scripts/bench-improve.js --render-only --data scripts/bench-improve.sample.json --output-dir /tmp/bench-check
```

Exits 0 and writes a markdown file under `/tmp/bench-check` (never into the repo). Rendering the **same** data file twice produces byte-identical output, and rendering the committed real data file reproduces the committed `docs/improve-cost-benchmark.md` (diff-clean) — proving the generator performs no measurement and no LLM call, only a deterministic transform of its input.

### 4. Dry-run exercises the full matrix with no spend

```
node scripts/bench-improve.js --dry-run
```

Exits 0, prints every planned `model × spec` cell (all four agent models × each pinned spec), and makes **no** real `claude -p` invocation, no real model call, and no `score` call — so it consumes zero scorecard quota. Verifiable from the absence of any outbound provider request and no quota decrement.

### 5. Token-counting proxy tallies correctly against a stub upstream

The `scripts/token-proxy.mjs` self-check (exercised by the dry-run wiring) starts the proxy, sends a canned `POST /v1/chat/completions` whose stub response carries a known `usage` block, and confirms the proxy's running tally equals that known count, then shuts down cleanly — no real upstream contacted. A streamed response with no `usage` block records `null` (unknown), never `0`.

### 6. Data file records both surfaces and provenance

`scripts/bench-improve.sample.json` (and any committed real data file) has, per cell, token counts split into an `engine` surface and an `agent` surface (not a single merged total), the spec's OAK URL and baseline score, `iterations_run`, `score_before`/`score_after`, and a `cli_version` + `run_date` stamp. A cell that errored records the error rather than zero-cost numbers.

### 7. Published doc has the required shape

`docs/improve-cost-benchmark.md` exists and contains: a results table across models × specs with token and cost totals broken down by surface (engine vs agent), the pinned spec set listed with each spec's URL and baseline score, model-selection guidance, and a header stamping the measured `cli_version` and run date.

### 8. Roadmap lifecycle marker

```
grep -F "## Phase 22 — Benchmark jentic-api-improve Token Usage and Cost ✅" specs/roadmap.md
```

Exits 0 — the Phase 22 heading carries the ` ✅` suffix (space + U+2705), with the rest of the block unchanged.

## Not Required

- **Running the real model×spec measurement in CI.** It spends real scorecard quota and real LLM budget and its outputs are stochastic, so it cannot be a deterministic gate. The one real run that produces the committed data file and doc is a manual step performed once at implementation time; it is not re-run to merge.
- **The three test suites** (`docker/tests/` pytest, `packages/cli` and `packages/formatter-html` mocha). This phase changes only `scripts/`, `docs/`, `specs/`, and the root `package.json` `scripts` block — no code any suite covers, so per `.claude/rules/testing.md` "When to run" no suite is required. The harness is intentionally not one of those suites and is not added to `ci.yml`.
- **A README `## CLI reference` / `SKILL.md` flag-table sync.** The CLI surface is unchanged (`.claude/rules/cli-readme-sync.md` triggers only on `packages/cli/src/{index,detail,format,exit-codes}.ts`).
- **A `specs/tech-stack.md` update.** The harness adds no load-bearing dependency (Node stdlib + built-in `fetch`, matching `extract-docs.js`); per `.claude/rules/update-tech-stack-on-deps.md` a swappable dev helper does not warrant a constitution entry, and the existing `extract-docs.js` harness set the precedent (it appears in neither `tech-stack.md` nor the README).
- **Wiring the deterministic checks into CI.** Checks 1–5 could be CI-gated later, but no existing CI job touches `scripts/`; adding one is out of scope here — the checks are run manually / at review time for this phase.
