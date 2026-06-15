# Phase 19 Plan — GitHub Action for CI Scoring

**Precondition:** Phases 17 (SARIF formatter) and 18 (Markdown formatter) must be implemented and merged first — this phase imports `formatSarif` via a new CLI subpath export and invokes `--format markdown`, neither of which exists on disk until 17/18 ship. Build order is 17 → 18 → 19. If either is unmerged when implementation starts, stop and surface it rather than stubbing the missing formatter.

## Group 1 — CLI subpath exports (`./sarif`, `./markdown`)

1. Add `"./sarif"` and `"./markdown"` entries to `packages/cli/package.json` `exports` (each `{ "types": "./dist/formatters/<name>.d.ts", "import": "./dist/formatters/<name>.js" }`), alongside the existing `"."` entry. `files` already includes `dist/`, so no packaging change beyond this. Both let the action helper render from captured JSON without a second `score` pass.
2. Confirm `formatSarif` (Phase 17) and `formatMarkdown` (Phase 18) are named exports of their respective `packages/cli/src/formatters/*.ts` and that `tsc` emits `dist/formatters/{sarif,markdown}.{js,d.ts}`; adjust the export targets if Phase 17/18 named them differently.
3. Add a CLI unit test that imports `@jentic/api-scorecard-cli/sarif` and `@jentic/api-scorecard-cli/markdown` (or the built paths) and asserts each formatter runs over the fixture — proving the subpaths resolve and round-trip without the `score` command.

## Group 2 — Action manifest + Node helper

4. Add `action.yml` at the repo root: `name`, `description`, `branding`, `runs.using: composite`. Declare inputs `input`, `api-key`, `min-score`, `max-errors`, `max-warnings`, `severity` (default `warning`), `max-findings` (default `5000`), `with-llm`, `summary-detail`.
5. Composite step 1: run `npx @jentic/api-scorecard-cli@<action-version> score "${{ inputs.input }}" --format json --detail diagnostics -o report.json`, forwarding `api-key` as `JENTIC_API_KEY` and `--with-llm` when set. Pin the CLI version to the action's released version (CLI version = image tag invariant).
6. Resolve how the helper accesses its libraries at action runtime — `formatSarif` and `formatMarkdown` (CLI `./sarif` / `./markdown` subpaths) and the HTML `format()` (`@jentic/api-scorecard-formatter-html`). A composite action has no `node_modules` for them, so pick one: (a) an explicit setup step that `npm install`s the packages pinned to the action version, or (b) pre-bundle `postprocess.mjs` with its deps (esbuild/ncc) and commit the artifact. Document the choice in this plan once made; whichever is chosen, the resolved versions must match the action's pinned CLI version.
7. Create the Node helper `action/postprocess.mjs`: parse `report.json` and derive every output from it **without calling `score` again** (no second engine pass); compute the gate decision; derive SARIF (import `formatSarif`); apply the `severity` filter then the `max-findings` cap (lowest-severity-first, log dropped count, keep ≤ `max-findings`); derive HTML via `format()`; derive the Markdown summary via the imported `formatMarkdown`; write `report.sarif`, `scorecard.html`, and `$GITHUB_STEP_SUMMARY`.
8. Implement gate logic in the helper: fail (process exit non-zero / set a failed output) when `summary.score < min-score`, or severity-1 count > `max-errors`, or severity-2 count > `max-warnings`. Gate reads the full captured diagnostics, not the severity-filtered SARIF. Skip a gate when its input is unset.
9. Composite step 2: `node $GITHUB_ACTION_PATH/action/postprocess.mjs` with inputs passed via env. Composite step 3: `github/codeql-action/upload-sarif` (with `if: always()`); guard it so a missing `security-events: write` scope (e.g. a fork PR's read-only token) skips the upload with a clear notice instead of hard-failing the action. Composite step 4: `actions/upload-artifact` for `scorecard.html` (with `if: always()`). Order the gate-failing exit after the publish steps so outputs land on failure.

## Group 3 — Helper unit tests + self-test workflow

10. Add unit tests for `action/postprocess.mjs` pure logic against the CLI fixture (`packages/cli/test/fixtures/scorecard.sample.json` or a copied fixture): gate decision at boundary scores (just-below / just-at `min-score`), `max-errors`/`max-warnings` counting against full diagnostics (not filtered), severity filter drops below-threshold findings, `max-findings` cap truncates lowest-severity-first and reports the dropped count.
11. Add `.github/workflows/action-selftest.yml` (with job `permissions: security-events: write`) that runs the composite action (`uses: ./`) against a committed fixture spec with a high `min-score`, and asserts: the action step fails (score below threshold), `report.sarif` exists and is non-empty, the HTML artifact step ran, and `$GITHUB_STEP_SUMMARY` was written. Add a second invocation with a low `min-score` asserting the step passes.

## Group 4 — Docs and lifecycle

12. Add a `## GitHub Action` section to `README.md` **and a matching entry in the existing `## Table of contents`**: a `pull_request`-triggered example workflow (`uses: jentic/jentic-api-scorecard@v<major>` with `input`, `api-key`, `min-score`) that includes the required `permissions: security-events: write` block, the full input table, and a note that Marketplace listing requires the root `action.yml`. The root README *is* the Marketplace listing body (the listing renders it verbatim; `action.yml` cannot redirect to a different file), so the README stays CLI-first but the TOC entry gives Marketplace visitors a one-click jump to the action docs.
13. Note in `README.md` and `skills/jentic-api-scorecard/SKILL.md` that the action scores once and derives SARIF/HTML/Markdown locally (no per-format re-scoring), that SARIF carries logical locations only (no inline PR-diff annotations yet), and that fork PRs cannot upload SARIF (read-only token) so the upload is skipped there.
14. Add a verification note (and, where feasible, a test) confirming the engine emits severity-1 diagnostics on an error-bearing spec, so `max-errors: 0` is a gate that can actually trip rather than a no-op.
15. Append ` ✅` (a single space followed by the U+2705 checkmark) to the `## Phase 19 — GitHub Action for CI Scoring` heading in `specs/roadmap.md`, leaving the rest of the block untouched.

## Group 5 — Verify

16. `npm run lint -w @jentic/api-scorecard-cli` exits 0 and any linters covering the action/helper pass.
17. `npm run build:typescript -w @jentic/api-scorecard-cli` exits 0 (the `./sarif` and `./markdown` exports resolve and `dist/formatters/{sarif,markdown}.{js,d.ts}` exist).
18. `npm test -w @jentic/api-scorecard-cli` exits 0, including the subpath-import test (task 3) and the helper unit tests (task 10).
19. `node -e "import('@jentic/api-scorecard-cli/sarif').then(m => console.log(typeof m.formatSarif))"` and the equivalent for `@jentic/api-scorecard-cli/markdown` (`formatMarkdown`) each print `function` (both subpath exports resolve at runtime).
20. The self-test workflow (`.github/workflows/action-selftest.yml`) passes on the PR: the high-`min-score` invocation fails the gate, the low-`min-score` invocation passes, SARIF and the HTML artifact are produced in both.
21. Manual end-to-end: in a scratch repo or workflow run, the action against a real spec uploads SARIF to the Security tab, attaches `scorecard.html` as a downloadable artifact, and renders the Markdown scorecard in the run summary.
22. `grep -F "## Phase 19 — GitHub Action for CI Scoring ✅" specs/roadmap.md` exits 0 (lifecycle marker present with the load-bearing leading space).
