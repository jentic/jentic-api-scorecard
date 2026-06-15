# Phase 19 Requirements — GitHub Action for CI Scoring

## Scope

Add a Marketplace-listable composite GitHub Action at the repository root (`action.yml`) that scores an OpenAPI spec in CI via the published CLI, gates the build on the resulting score, and publishes the results across three GitHub surfaces: SARIF findings to the Security tab, the HTML scorecard as a downloadable artifact, and a Markdown summary rendered inline on the run page.

The action is a thin composite wrapper over `npx @jentic/api-scorecard-cli` — no backend service in the loop, consistent with the project's no-service architecture. It scores **once** (`score <input> --format json --detail diagnostics -o report.json`) and derives SARIF, HTML, and Markdown from that single captured `report.json` via a small bundled Node helper, because every formatter is a pure function of the engine result JSON. The helper also computes the gate decision (min-score, max-errors, max-warnings), applies the SARIF severity filter and findings cap, and writes the step summary.

## Out of Scope

- Re-scoring per output format. Scoring is the expensive step; the action scores once and formats many.
- `--min-score` as a CLI flag (a separate Later-Phases item). Gating here lives in the action wrapper, reading `summary.score` from the captured JSON — no new CLI exit code.
- `physicalLocation` / inline PR-diff annotations on SARIF findings (Phase 17 emits logical locations only).
- Publishing the action to the Marketplace (a manual, post-merge release step). This phase makes it *listable* (root `action.yml`) but does not perform the listing.
- Any change to the scoring engine, the gate, or the container contract.

## Decisions

### Composite action at the repo root

`action.yml` sits at the repository root (not a subdirectory) because GitHub Marketplace listing requires the action manifest at the repo root. Consumers reference it as `jentic/jentic-api-scorecard@<version>`. The root already hosts the npm-workspaces files; a root `action.yml` coexists with them. The action `runs.using: composite` and shells out to `npx @jentic/api-scorecard-cli@<action-version>` plus a bundled Node helper.

### Marketplace docs = root README, addressed via a TOC entry

The Marketplace listing renders the repository-root `README.md` verbatim as the action's documentation; `action.yml` has no field to point at a different file, and splitting the action into its own repo would break the single-tag CLI-version=action-version invariant. The root README is intentionally CLI-first (it also serves as the npm package readme), so rather than restructure it, this phase adds a dedicated `## GitHub Action` section plus a `## Table of contents` entry — giving Marketplace visitors a one-click jump to the action docs without burying the CLI audience's quick start. A separate `docs/github-action.md` was rejected: the Marketplace renders the README inline regardless, so a linked file would not become the listing body.

### Score once, format many — via a bundled Node helper

The action runs one `score … --format json --detail diagnostics -o report.json` (a full engine pass), then a small in-repo Node script (`action/postprocess.mjs` or similar) parses `report.json` and derives every output **from that captured JSON without invoking `score` again** — re-running `score --format markdown` (or `--format sarif`/`--format html`) would be a second engine pass and break score-once. Concretely the helper: computes the gate decision; derives SARIF via the CLI's new `./sarif` subpath export; derives HTML via `@jentic/api-scorecard-formatter-html`'s `format()`; derives Markdown by importing the CLI's Markdown formatter the same way (Phase 18 ships it inside the CLI; this phase imports it, e.g. via the same subpath-export mechanism as `./sarif` — see the library-resolution decision below); applies the severity filter then the findings cap; and writes `$GITHUB_STEP_SUMMARY`. A Node helper is chosen over bash + `jq` because the gate math, severity filtering, and cap logic are unit-testable in isolation and far less brittle than shell.

### CLI `./sarif` and `./markdown` subpath exports are added here

Phases 17 and 18 ship SARIF and Markdown as CLI-internal formatters. This phase adds `"./sarif"` and `"./markdown"` entries to `packages/cli/package.json` `exports` (pointing at the built `dist/formatters/{sarif,markdown}.js`) so the helper imports `formatSarif(result)` and `formatMarkdown(result)` and runs them over the captured `report.json` without re-scoring — mirroring how the CLI already consumes the published HTML `format()`. Both are load-bearing for score-once: without them the only way to produce SARIF/Markdown would be a second `score` pass. The CLI's `files` array already includes `dist/`, so no packaging change is needed beyond the `exports` entries.

### Helper's library access deferred to implementation

The Node helper imports three formatters at action runtime — `formatSarif` and `formatMarkdown` (CLI `./sarif` / `./markdown` subpaths) and the HTML `format()` (`@jentic/api-scorecard-formatter-html`) — but a composite action has no `node_modules` for them on a consumer's runner (the CLI itself runs via `npx`, which doesn't expose its library exports to the helper). Two resolutions are viable: an explicit `npm install` of the packages (pinned to the action version) in a setup step, or pre-bundling the helper with its deps via a bundler (esbuild/ncc) and committing the artifact. Both preserve score-once. The choice is **deferred to `plan.md`/implementation** rather than locked here; the requirement is only that the helper reliably resolves all three formatters at runtime, pinned to the action's CLI version.

### Inputs and gate semantics

Inputs: `input` (file/URL), `api-key`, `min-score`, `max-errors`, `max-warnings`, `severity` (default `warning`), `max-findings` (default `5000`), `with-llm`, `summary-detail` (controls only the Markdown summary depth — the capture is always `--detail diagnostics`). The gate fails the build when `summary.score < min-score` (strictly less — a score **equal to** `min-score` passes; the implementation must not use `<=`), or when severity-1 (error) counts exceed `max-errors`, or severity-2 (warning) counts exceed `max-warnings`. **Gates read the full captured result, not the filtered SARIF** — a finding hidden by the `severity` filter still counts toward `max-errors`/`max-warnings`, so raising `severity` never silently weakens the gate.

### Filter-then-cap; upload on failure

SARIF post-processing applies the `severity` filter first (drop findings below the minimum level), then the `max-findings` cap (truncate lowest-severity-first, logging the dropped count) — both are size levers for GitHub's 5000-result / 10MB SARIF limits. SARIF, the HTML artifact, and the Markdown summary are all published **even when a gate fails** (`if: always()` on the publish steps) — a failed build is exactly when the findings are most wanted.

### Self-test workflow as the acceptance gate

A workflow under `.github/workflows/` invokes the composite action (`uses: ./`) against a known fixture spec and asserts the end-to-end behavior (gate fails below threshold, SARIF uploads, HTML artifact present, summary rendered), plus unit tests on the Node helper's pure logic (gate decision, severity filter, cap). An action is otherwise hard to test; exercising the real composite action in CI is the only faithful signal.

## Constraints

- **No backend service in the scoring loop** (`specs/tech-stack.md` "What We Are Not Using"; `docs/architecture.md` §1). The action wraps the CLI, which orchestrates the container; it introduces no service.
- **CLI version = image tag invariant** (`docs/architecture.md` §2/§8). The action pins `npx @jentic/api-scorecard-cli@<action-version>`, and the action's released version tracks that CLI version so the engine the action runs is reproducible.
- **Result JSON is engine-verbatim; formatters are pure projections** (`docs/architecture.md` §7). The helper derives all outputs from one captured `report.json` without mutating it.
- **Exit codes are public CLI contract** (`specs/tech-stack.md`). The action's gate is a wrapper-level pass/fail (a non-zero step exit), not a new CLI exit code — the CLI contract is untouched.
- **`api-key` is a secret** — forwarded to the CLI as `JENTIC_API_KEY`; never echoed to logs, the step summary, or the artifact. Anonymous (jentic-public-apis allowlist) inputs work without it.
- **SARIF upload needs `security-events: write`** — `github/codeql-action/upload-sarif` requires the consuming job to grant `permissions: security-events: write`, and on pull requests from forks the `GITHUB_TOKEN` is read-only so the upload cannot run. The README example must show the permission block, and the action must degrade gracefully (skip the upload with a clear notice, not hard-fail) when the token lacks the scope — common in fork PRs.
- **CLI surface / docs sync** (`.claude/rules/cli-readme-sync.md`) — the `./sarif` export and the action are public surface; README documents the action and an example workflow in the same change.

## Context

This is the headline CI-integrator deliverable and the reason Phases 17 (SARIF) and 18 (Markdown formatter) were built. It serves the **CI integrators** persona in `specs/mission.md`: gate merges on a JAIRF score, see actionable findings in the Security tab, and read an at-a-glance scorecard on the run — the same value proposition as comparable OpenAPI-quality actions, plus a richer summary than a public report URL.

It depends on Phase 17 and Phase 18, which are specced but **not yet implemented** (their formatters do not exist on disk yet). Implementation of this phase must therefore wait until 17 and 18 ship; the build order is 17 → 18 → 19. The `plan.md` calls this out as a precondition. See `docs/architecture.md` §5–§7 for the CLI surface this wraps.

## Stakeholder Notes

- **CI integrators** — want a drop-in action that gates PRs on API readiness and surfaces findings without bespoke glue. Satisfied by the composite action + gate inputs + SARIF/Security-tab integration.
- **OpenAPI spec authors** — see the scorecard (Markdown summary inline, HTML artifact to download) on every PR. Satisfied by the publish steps.
- **Jentic (Marketplace listing)** — wants the action discoverable on the GitHub Marketplace. Satisfied by the root `action.yml` (listing itself is a post-merge manual step).
