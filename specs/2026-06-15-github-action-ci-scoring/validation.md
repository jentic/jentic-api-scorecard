# Phase 19 Validation — GitHub Action for CI Scoring

## Definition of Done

All of the following must be true before this branch is merged. (Precondition: Phases 17 and 18 are merged — see `plan.md`.)

### 1. Lint is clean

```
npm run lint -w @jentic/api-scorecard-cli
```

Exits 0. ESLint + Prettier pass on the `package.json` `exports` change, the Node helper, and any touched `.ts` files.

### 2. CLI subpath export resolves and type-checks

```
npm run build:typescript -w @jentic/api-scorecard-cli
node -e "import('@jentic/api-scorecard-cli/sarif').then(m => console.log(typeof m.formatSarif))"
node -e "import('@jentic/api-scorecard-cli/markdown').then(m => console.log(typeof m.formatMarkdown))"
```

`build:typescript` exits 0; both `node -e` lines print `function`. `dist/formatters/sarif.{js,d.ts}` and `dist/formatters/markdown.{js,d.ts}` exist, and the `"./sarif"` / `"./markdown"` exports point at them.

### 3. Unit tests pass — subpath import + helper logic

```
npm test -w @jentic/api-scorecard-cli
```

Exits 0, including:
- the subpath-import test: `@jentic/api-scorecard-cli/sarif`'s `formatSarif(fixture)` returns schema-valid SARIF and `@jentic/api-scorecard-cli/markdown`'s `formatMarkdown(fixture)` returns Markdown — both without invoking the `score` command;
- the helper tests: gate decision at the boundary — score **just below** `min-score` fails, score **equal to** `min-score` passes (guards against a `<=` off-by-one), score above passes; `max-errors`/`max-warnings` counted against the **full** diagnostics (not the severity-filtered set); `severity` filter drops below-threshold findings; `max-findings` cap truncates lowest-severity-first and reports the dropped count.

### 4. Action self-test workflow passes both ways

`.github/workflows/action-selftest.yml` runs on the PR and is green:
- the high-`min-score` invocation **fails the action step** (score below threshold) yet still produces `report.sarif` (non-empty) and the HTML artifact;
- the low-`min-score` invocation **passes**;
- `$GITHUB_STEP_SUMMARY` is written (non-empty) in both runs.

### 5. SARIF is uploaded even on gate failure

In the failing self-test run (job granted `permissions: security-events: write`), the `github/codeql-action/upload-sarif` step executes (guarded by `if: always()`) and the HTML `actions/upload-artifact` step produces a downloadable `scorecard.html`. A gate failure does not skip the publish steps.

### 5a. Missing `security-events: write` degrades gracefully

When the action runs without the `security-events: write` scope (e.g. a fork PR's read-only token), the SARIF upload is skipped with a clear notice and the action does **not** hard-fail on that account — the gate decision and the other outputs (HTML artifact, Markdown summary) still run. Verifiable by a self-test job without the permission, or by reasoning from the guarded upload step.

### 6. End-to-end against a real spec (manual)

Running the action against a real OpenAPI spec (scratch workflow or repo): SARIF findings appear in the **Security tab**, `scorecard.html` is downloadable from the run's artifacts, and the Markdown scorecard renders in the run **Summary** page. `api-key` does not appear in any log, the summary, or the artifact.

### 7. Score-once confirmed

The action invokes `score …` exactly **once** per run (one engine pass); SARIF, HTML, and Markdown are all derived from the single captured `report.json`. Verifiable from the self-test run log (one `score` invocation, no repeated `docker run`).

### 8. README documents the action

`README.md` includes a `pull_request` example workflow with the required `permissions: security-events: write` block, the full input table (`input`, `api-key`, `min-score`, `max-errors`, `max-warnings`, `severity`, `max-findings`, `with-llm`, `summary-detail`), and the note that Marketplace listing requires the root `action.yml`. `skills/jentic-api-scorecard/SKILL.md` and `README.md` note the score-once behavior, the logical-location-only SARIF caveat, and that fork PRs skip the SARIF upload (read-only token).

### 9. Roadmap lifecycle marker

```
grep -F "## Phase 19 — GitHub Action for CI Scoring ✅" specs/roadmap.md
```

Exits 0. The Phase 19 heading carries the ` ✅` suffix (space + U+2705) and the rest of the block is unchanged.

## Not Required

- Publishing the action to the GitHub Marketplace — a manual, post-merge release step. This phase only makes it listable.
- `physicalLocation` / inline PR-diff annotations on SARIF findings — Phase 17 emits logical locations only.
- A `--min-score` CLI flag or any new CLI exit code — gating is wrapper-level (a failed action step).
- Multi-spec / portfolio scoring in one action run.
- Changes to the scoring engine, the gate, the container contract, or `docker/` — no Python changes, so `docker/tests/` need not run.
