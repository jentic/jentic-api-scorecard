# Phase 19 Plan — GitHub Action for CI Scoring

**Precondition:** Phases 17 (SARIF formatter) and 18 (Markdown formatter) must be implemented and merged first — this phase imports `formatSarif` via a new CLI subpath export and invokes `--format markdown`, neither of which exists on disk until 17/18 ship. Build order is 17 → 18 → 19. If either is unmerged when implementation starts, stop and surface it rather than stubbing the missing formatter.

## Group 1 — CLI `./sarif` subpath export

1. Add a `"./sarif"` entry to `packages/cli/package.json` `exports` (`{ "types": "./dist/formatters/sarif.d.ts", "import": "./dist/formatters/sarif.js" }`), alongside the existing `"."` entry. `files` already includes `dist/`, so no packaging change beyond this.
2. Confirm `formatSarif` is a named export of `packages/cli/src/formatters/sarif.ts` (from Phase 17) and that `tsc` emits `dist/formatters/sarif.{js,d.ts}`; adjust the export if Phase 17 named it differently.
3. Add a CLI unit test that imports `@jentic/api-scorecard-cli/sarif` (or the built path) and asserts `formatSarif(fixture)` returns schema-valid SARIF — proving the subpath resolves and round-trips without the `score` command.

## Group 2 — Action manifest + Node helper

4. Add `action.yml` at the repo root: `name`, `description`, `branding`, `runs.using: composite`. Declare inputs `input`, `api-key`, `min-score`, `max-errors`, `max-warnings`, `severity` (default `warning`), `max-findings` (default `5000`), `with-llm`, `summary-detail`.
5. Composite step 1: run `npx @jentic/api-scorecard-cli@<action-version> score "${{ inputs.input }}" --format json --detail diagnostics -o report.json`, forwarding `api-key` as `JENTIC_API_KEY` and `--with-llm` when set. Pin the CLI version to the action's released version (CLI version = image tag invariant).
6. Create the Node helper `action/postprocess.mjs` (committed, bundled — no install step in the action): parse `report.json`; compute the gate decision; derive SARIF (import `formatSarif` from the `./sarif` export); apply the `severity` filter then the `max-findings` cap (lowest-severity-first, log dropped count); derive HTML via `@jentic/api-scorecard-formatter-html` `format()`; derive the Markdown summary; write `report.sarif`, `scorecard.html`, and `$GITHUB_STEP_SUMMARY`.
7. Implement gate logic in the helper: fail (process exit non-zero / set a failed output) when `summary.score < min-score`, or severity-1 count > `max-errors`, or severity-2 count > `max-warnings`. Gate reads the full captured diagnostics, not the severity-filtered SARIF. Skip a gate when its input is unset.
8. Composite step 2: `node $GITHUB_ACTION_PATH/action/postprocess.mjs` with inputs passed via env. Composite step 3: `github/codeql-action/upload-sarif` (with `if: always()`). Composite step 4: `actions/upload-artifact` for `scorecard.html` (with `if: always()`). Order the gate-failing exit after the publish steps so outputs land on failure.

## Group 3 — Helper unit tests + self-test workflow

9. Add unit tests for `action/postprocess.mjs` pure logic against the CLI fixture (`packages/cli/test/fixtures/scorecard.sample.json` or a copied fixture): gate decision at boundary scores (just-below / just-at `min-score`), `max-errors`/`max-warnings` counting against full diagnostics (not filtered), severity filter drops below-threshold findings, `max-findings` cap truncates lowest-severity-first and reports the dropped count.
10. Add `.github/workflows/action-selftest.yml` that runs the composite action (`uses: ./`) against a committed fixture spec with a high `min-score`, and asserts: the action step fails (score below threshold), `report.sarif` exists and is non-empty, the HTML artifact step ran, and `$GITHUB_STEP_SUMMARY` was written. Add a second invocation with a low `min-score` asserting the step passes.

## Group 4 — Docs and lifecycle

11. Add an action section to `README.md`: a `pull_request`-triggered example workflow (`uses: jentic/jentic-api-scorecard@v<major>` with `input`, `api-key`, `min-score`), the full input table, and a note that Marketplace listing requires the root `action.yml`.
12. Note in the README/SKILL that the action scores once and derives SARIF/HTML/Markdown locally (no per-format re-scoring), and that SARIF carries logical locations only (no inline PR-diff annotations yet).
13. Add a verification note (and, where feasible, a test) confirming the engine emits severity-1 diagnostics on an error-bearing spec, so `max-errors: 0` is a gate that can actually trip rather than a no-op.
14. Append ` ✅` (a single space followed by the U+2705 checkmark) to the `## Phase 19 — GitHub Action for CI Scoring` heading in `specs/roadmap.md`, leaving the rest of the block untouched.

## Group 5 — Verify

15. `npm run lint -w @jentic/api-scorecard-cli` exits 0 and any linters covering the action/helper pass.
16. `npm run build:typescript -w @jentic/api-scorecard-cli` exits 0 (the `./sarif` export resolves and `dist/formatters/sarif.{js,d.ts}` exist).
17. `npm test -w @jentic/api-scorecard-cli` exits 0, including the subpath-import test (task 3) and the helper unit tests (task 9).
18. `node -e "import('@jentic/api-scorecard-cli/sarif').then(m => console.log(typeof m.formatSarif))"` prints `function` (subpath export resolves at runtime).
19. The self-test workflow (`.github/workflows/action-selftest.yml`) passes on the PR: the high-`min-score` invocation fails the gate, the low-`min-score` invocation passes, SARIF and the HTML artifact are produced in both.
20. Manual end-to-end: in a scratch repo or workflow run, the action against a real spec uploads SARIF to the Security tab, attaches `scorecard.html` as a downloadable artifact, and renders the Markdown scorecard in the run summary.
21. `grep -F "## Phase 19 — GitHub Action for CI Scoring ✅" specs/roadmap.md` exits 0 (lifecycle marker present with the load-bearing leading space).
