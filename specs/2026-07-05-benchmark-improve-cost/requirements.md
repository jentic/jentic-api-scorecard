# Phase 22 Requirements — Benchmark jentic-api-improve Token Usage and Cost

## Scope

Add a reproducible, developer-run benchmark that measures how many tokens — and how much money — a full run of the `jentic-api-improve` skill consumes, so a prospective user can pick a model and anticipate cost before adopting the skill. A run of the skill spends LLM budget on two independent surfaces: the coding agent's own reasoning as it drives the standard two-iteration improvement loop, and the scoring engine's `--with-llm` semantic analysis on each `score` call (one baseline plus up to two in-loop re-scores). The benchmark measures both, separately, across a matrix of coding-agent models × input OpenAPI specs of varying size and starting quality.

Concretely this phase delivers: a Node ESM harness under `scripts/` (matching `scripts/extract-docs.js` conventions) that drives the skill end-to-end per matrix cell and records per-surface token counts and cost; a small net-new local token-counting OpenAI-compatible proxy the scoring engine is pointed at (the only way to capture engine-side tokens — see Decisions); a machine-readable per-cell results data file; and a generated `docs/improve-cost-benchmark.md` with a results table broken down by surface plus model-selection guidance. The real measurement is a manual, non-CI-gated run (it spends real scorecard quota and real LLM budget, and LLM outputs are stochastic); the deterministic parts — the harness's lint cleanliness, the data file's JSON validity, and the data-file→doc rendering — are verifiable without any spend.

## Out of Scope

- **CI gating of the real measurement.** No CI job runs the model×spec matrix — it costs real money and quota and its outputs are stochastic, so it cannot be a deterministic gate. Only the deterministic surfaces (lint, JSON validity, doc rendering, dry-run plumbing) are checkable.
- **Any change to the CLI, the container, the runner, or the scoring engine.** The harness only *drives* the already-shipped `@jentic/api-scorecard-cli` and the `jentic-api-improve` skill; it adds no measurement instrumentation to the product itself (that would violate the no-telemetry stance — see Constraints).
- **A new dependency solely to parse args or run the proxy.** The harness matches `extract-docs.js`'s zero-dependency style (manual `process.argv` parsing, Node's built-in `http`/`fetch`). If a genuinely load-bearing library becomes necessary, that is a decision to surface, not a default.
- **Benchmarking the scoring CLI on its own** (without the improve skill) or portfolio/multi-spec scoring — those are separate concerns.
- **Making `fable` an engine `--with-llm` option.** `fable` is a Claude Code coding-agent model alias; it belongs only on the agent axis, never on the fixed engine provider (see Decisions).

## Decisions

### Measure two surfaces separately, with distinct signals
A skill run's LLM cost splits into the coding agent's own reasoning tokens and the scoring engine's `--with-llm` tokens; the benchmark reports them as separate columns because they scale differently (the engine batches operations and caps its work regardless of spec size, while the agent's reasoning grows with the loop and the model). The agent surface is captured first-party from Claude Code headless mode (`claude -p … --output-format json`), reading the session's `usage` and `total_cost_usd` fields — authoritative, no estimation. The engine surface is captured by the proxy described next.

### The scoring engine's tokens require a local token-counting proxy (the scorecard JSON does not expose them)
Research confirmed the scorecard result JSON has no `usage`/`token`/`cost` field anywhere (top-level keys are `metadata`, `apiMetadata`, `summary`, `details`, `diagnostics`; the only `cost`-named field is a JAIRF scoring weight, unrelated to tokens). So the roadmap's open question — "does the scorecard output already surface usage?" — resolves to **no**. The engine surface is therefore measured by pointing the engine's `--with-llm` provider at a small net-new local OpenAI-compatible endpoint (the skill's documented local-provider recipe) that forwards each request to a real upstream and tallies `usage.prompt_tokens` / `usage.completion_tokens`. Loopback endpoints are auto-rewritten to `host.docker.internal` with `--network host` by the CLI's docker layer, so a `localhost` proxy is reachable from inside the container transparently. This is a *forwarding measurement* proxy against a real upstream, not a mock, so it stays faithful to the no-mocking spirit.

### Hold the engine `--with-llm` provider fixed across the model axis
The matrix varies the **coding-agent** model (haiku / sonnet / opus / fable). The engine's `--with-llm` provider is held to a single fixed configuration across every cell, so the agent-model comparison is not confounded by also varying the engine model. `fable` exists only on the agent axis — it is a Claude Code model alias with no engine-provider meaning.

### Pin the input-spec set (OAK URLs + recorded baseline score)
The input axis is a small, explicitly pinned set of OpenAPI specs from `jentic-public-apis` (OAK), chosen to span size/complexity and starting quality (low / mid / high baseline JAIRF score). Each spec is recorded by its raw `githubusercontent.com` OAK URL plus its baseline score. The confirmed anchor spec is the swagger-api petstore already used across the repo's tests (`.../apis/openapi/swagger-api/petstore/1.0.27/openapi.json`); the remaining specs are selected from the live OAK catalog during implementation and pinned in the harness config with their URLs and baseline scores. Baseline `score` calls on OAK URLs are quota-free (the gate allowlist bypasses the validator), but the improve loop's in-loop re-scores run against the edited **local working copy**, which is not an OAK URL and therefore costs one scorecard quota unit each and requires `JENTIC_API_KEY` — budget at least three units per cell.

### Split expensive measurement from cheap deterministic rendering
Following the `extract-docs.js` precedent, the harness separates the expensive, stochastic measurement (which writes a machine-readable data file) from a pure data-file→markdown rendering step. The rendering step is a deterministic function of a committed data file, so `docs/improve-cost-benchmark.md` can be regenerated and diff-checked without any LLM spend, and a `--dry-run` mode exercises the matrix plumbing without calling any model. This is what makes the phase verifiable at all despite the measurement being manual.

## Constraints

Load-bearing invariants this phase must preserve:

- **No telemetry / metrics / analytics in the product** (`specs/tech-stack.md` "Observability"; "What We Are Not Using"). The benchmark is a *dev-time* measurement that writes numbers to a repo data file and doc — it must not add any always-on measurement, logging, or phone-home to the CLI or container. Pointing the engine at a local proxy during a manual benchmark run does not instrument the shipped product.
- **Outbound calls to Jentic stay capped at the per-invocation key-check** (`specs/tech-stack.md` "Outbound calls to Jentic"; `specs/mission.md`). The harness introduces no new Jentic endpoint; it only runs the shipped CLI, which already makes exactly that one call.
- **`--with-llm` sends only targeted spec context, not the full spec** (`specs/mission.md`; `skills/jentic-api-improve/SKILL.md`). Using a local proxy keeps the engine's spec context on-host and gives free, exact token counts — the sanctioned privacy-preserving path.
- **Reproducibility = pin CLI version → image tag → engine pair** (`specs/mission.md`; `specs/tech-stack.md`; `docs/architecture.md` §8). The doc stamps the exact CLI/image version measured (currently `@jentic/api-scorecard-cli` 1.9.3, read from `packages/cli/package.json`) and the run date, so a result is always attributable to a specific engine release.
- **No mocking in the three test suites** (`.claude/rules/testing.md`). The harness is not one of those suites and lives under `scripts/`, so it is exempt; the token-counting proxy forwards to a real upstream (not a fake), and the harness stays out of `docker/tests/` and `packages/*/test/` and out of `ci.yml`.
- **`scripts/*.js` is not covered by `npm run lint`** (`eslint.config.js` globally ignores `**/*.js`; the lint script targets only `packages/*` `src test`). So the harness's lint cleanliness must be asserted with an explicit `npx eslint` / `npx prettier --check` invocation, not assumed from the repo-wide lint.

## Context

This phase exists because Phase 21 has shipped the `jentic-api-improve` skill, and `--with-llm` cost is the first question a prospective adopter asks — the skill runs a coding agent through a multi-iteration loop *and* triggers LLM-backed engine analysis on every score, so the total spend is non-obvious and model-dependent. A measured, published cost table turns "how expensive is this?" into a concrete answer and gives model-selection guidance grounded in real numbers rather than guesses.

It is deliberately the repo's first benchmarking work and the first use of Claude Code headless mode (`claude -p`) as a measurement harness, so the plan builds the net-new, riskiest pieces first (the token-counting proxy, then the matrix driver) before the deterministic data→doc rendering. The deliverable `docs/improve-cost-benchmark.md` sits alongside `docs/llm-signals.md`, which already documents the engine's `--with-llm` provider matrix and the local-provider recipe the proxy relies on; the benchmark cross-references it. The harness follows the `scripts/extract-docs.js` model closely: Node ESM, zero dependencies, a `--dry-run` mode, and a root `package.json` `bench:*` script entry beside the existing `docs:*` entries.

## Stakeholder Notes

- **OpenAPI spec authors / prospective skill adopters** — want to know what running the improve skill will cost before committing to it, and which model gives the best cost/quality trade-off. Satisfied by the per-surface cost table and model-selection guidance in `docs/improve-cost-benchmark.md`.
- **Jentic maintainers** — want a repeatable way to re-measure cost when the engine or skill changes, and a version-stamped record of each measurement. Satisfied by the pinned-version harness and the regeneratable data-file→doc pipeline.
