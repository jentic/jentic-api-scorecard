# Phase 6 Validation — JSON formatter (`--format json`)

## Definition of Done

All of the following must be true before this branch is merged.

### 1. CI: lint and type-check pass

```
npm run lint -w @jentic/api-scorecard-cli
npm run typescript:check-types -w @jentic/api-scorecard-cli
npm run build:typescript -w @jentic/api-scorecard-cli
```

All three exit 0. The `typescript-lint` and `typescript-build` jobs in `.github/workflows/ci.yml` go green on the PR.

### 2. CI: unit tests pass

```
npm test -w @jentic/api-scorecard-cli
```

Exits 0. `packages/cli/test/formatters/json.test.ts` (new), the extended `packages/cli/test/formatters/pretty.test.ts` (with `--format json --detail diagnostics` hint assertions across SUMMARY / DIMENSIONS / SIGNALS branches), and the unchanged `detail.test.ts` / `exit-codes.test.ts` all pass. The `typescript-test` job in `.github/workflows/ci.yml` goes green on the PR.

### 3. CI: e2e tests pass

```
npm run test:e2e
```

Exits 0. The new `describe('--format json')` block in `packages/cli/test/e2e/score.e2e.test.ts` covers: default-detail JSON (parseable, has `summary.dimensions` length 6, no `details`/`diagnostics`); `--detail summary` (parseable, no `summary.dimensions`); `--detail diagnostics` (parseable, has `details` and `diagnostics` arrays); `--format invalid` (exits non-zero, stderr mentions `--format` and `invalid`). The `test-e2e` job in `.github/workflows/ci.yml` goes green on the PR.

### 4. CI: Python regression guards pass

```
cd docker && uv run poe lint
cd docker && uv run poe test
```

Both exit 0. Phase 6 does not modify `docker/`, but `python-lint` and `python-test` jobs run unconditionally on PR per `.claude/rules/testing.md`.

### 5. Smoke: `--format json` emits parseable engine-verbatim JSON

```
JENTIC_API_KEY=mvp-preview node packages/cli/bin/jentic-api-scorecard.mjs \
  score docker/.build/sample.yaml --format json | jq .summary.score
```

Exits 0; stdout (after `jq`) is a number. Without the `jq` pipe, stdout is parseable JSON with top-level keys `metadata`, `apiMetadata`, `summary`, no `details`, no `diagnostics`, and `summary.dimensions` is an array of length 6.

### 6. Smoke: `--detail` filtering applies to JSON

```
JENTIC_API_KEY=mvp-preview node packages/cli/bin/jentic-api-scorecard.mjs \
  score docker/.build/sample.yaml --format json --detail diagnostics \
  | jq '.diagnostics | length'
```

Exits 0; output is an integer ≥ 1. With `--detail summary`, `jq '.summary | has("dimensions")'` returns `false` and `jq 'has("details") or has("diagnostics")'` returns `false`. With `--detail signals`, `jq 'has("details")'` returns `true` and `jq 'has("diagnostics")'` returns `false`.

### 7. Smoke: invalid format value rejected by commander

```
JENTIC_API_KEY=mvp-preview node packages/cli/bin/jentic-api-scorecard.mjs \
  score docker/.build/sample.yaml --format invalid
```

Exits non-zero. Stderr contains both `--format` and `invalid`. (Commander's `Option.choices()` rejection at parse time, no new exit code introduced.)

### 8. Pretty default unchanged; appendHint footer restored

```
JENTIC_API_KEY=mvp-preview node packages/cli/bin/jentic-api-scorecard.mjs \
  score docker/.build/sample.yaml
```

Exits 0; stdout contains the dimension table and the footer hint `Full report: --format json --detail diagnostics` (or `Full evidence: ...` when run with `--detail signals`). The footer hint is part of the formatted report payload — `appendHint()` pushes into the same `lines[]` array that `score.ts:156` writes to `process.stdout`; stderr carries only the spinner. Asserts the regression `337b55e` introduced is undone and the canonical sample at `docs/architecture.md:34` reads true.

### 9. Roadmap completion marker present

```
grep -F "## Phase 6 — JSON formatter (\`--format json\`) ✅" specs/roadmap.md
```

Exits 0. The leading space before ✅ is load-bearing per `specs/roadmap.md:19`. The em dash `—` (U+2014) and ✅ (U+2705) must be exact.

### 10. README updated with JSON recipe

```
grep -F "format json" README.md
```

Exits 0. The "Machine-readable output" subsection between "Control output depth" and the LLM section contains a `--format json` recipe.

### 11. Architecture doc updated to match shipped surface

`docs/architecture.md` §5's `--format <fmt>` row (line 163 area) reads "Default: `pretty` (unconditional). Values: `pretty`, `json`. `markdown` and `html` are reserved for later phases." The TTY-aware-default language is removed. The `--json` row is annotated "(deferred — not in Phase 6)".

### 12. CLAUDE.md and tech-stack.md updated

- `.claude/CLAUDE.md` no longer claims "`--format json --detail diagnostics` will surface it once Phase 6 lands"; the "ship in Phases 6 / 8 / 9 / 7" trailer no longer mentions Phase 6.
- `specs/tech-stack.md`'s "Roadmap, not yet built" entry for output formats lists `--format` (pretty + json) as shipped and keeps the rest deferred.

## Not Required

- **HTML formatter implementation.** Phase 14.
- **Markdown formatter.** Later Phases (`specs/roadmap.md:222`).
- **`--json` convenience alias.** Deferred; architecture doc updated to flag deferral.
- **`-f` short flag for `--format`.** Deferred; same rationale as `--json`.
- **`-o FILE` interaction tests.** Phase 8.
- **`--quiet` / `--verbose` interaction tests.** Phases 9 / 7.
- **TTY-aware default switching.** Out of scope per the roadmap-literal Decision.
- **`--min-score N` or new exit code.** Later Phases.
- **Container-side or Dockerfile changes.** Phase 6 is host-CLI-only.
- **Snapshot test of the entire JSON byte-stream.** Engine version drift would break it on every engine bump; tests assert shape and a small set of verbatim values instead.
- **JSON schema validation in the CLI.** `docs/architecture.md` §10 explicitly defers it.
- **Anonymous-allowlist negative test for `--format json`.** Already covered by `score.e2e.test.ts:82–93` in the existing e2e suite; redundant in this phase.
- **`package.json` version bumps.** Lerna fixed-version is bumped at alpha-release time (Phase 12 flow), not in implementation PRs.
