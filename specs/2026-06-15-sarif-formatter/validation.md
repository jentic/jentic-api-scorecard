# Phase 17 Validation — SARIF formatter (`--format sarif`)

## Definition of Done

All of the following must be true before this branch is merged.

### 1. Lint is clean

```
npm run lint -w @jentic/api-scorecard-cli
```

Exits 0. ESLint + Prettier pass on the new `formatters/sarif.ts` and every other touched `.ts` file.

### 2. TypeScript type-checks

```
npm run build:typescript -w @jentic/api-scorecard-cli
```

Exits 0. `tsc` compiles the new formatter, the extended `Format` record, the dispatch change in `commands/score.ts`, and the `validate.ts` change with no errors.

### 3. Unit tests pass, including the new SARIF suite

```
npm test -w @jentic/api-scorecard-cli
```

Exits 0. `test/formatters/sarif.test.ts` asserts, against `test/fixtures/scorecard.sample.json`:
- the emitted document validates against the committed SARIF 2.1.0 JSON Schema via `ajv`;
- `version === '2.1.0'`;
- one `runs[]` entry per distinct diagnostic `source` (5 in the fixture);
- total `results[]` count equals the diagnostic count (34);
- severity→level mapping holds, asserting the emitted `level` string (not severity semantics): a severity-1 diagnostic emits `level: 'error'`, severity-2 → `'warning'`, severity-3 → `'note'`;
- location handling keys off **non-empty** pointers (the fixture uses `[]` to mean "no pointer" and often carries both `data.path` and `data.paths` on one diagnostic): a non-empty `data.path` (with empty/absent `paths`) → exactly one `logicalLocation`; a non-empty `data.paths` → one location per pointer; a diagnostic with `data.path: []` + non-empty `data.paths` → locations from `paths` (precedence), proving an empty `path` produces no bogus location; both arrays empty/absent → result with no `locations` key;
- pointers are encoded as RFC 6901 (`toJsonPointer` helper): `['paths','/health','get']` → `/paths/~1health/get` (slash-in-segment escaped to `~1`, `~`→`~0`), verified by a dedicated helper test.

The extended `test/validate.test.ts` asserts `--format sarif` is never refused: allowed to a TTY without `-o`, allowed when piped, and allowed to a TTY with `-o` (SARIF is plain JSON text, TTY-safe like `json`).

### 4. SARIF output is valid end-to-end against a real score

```
node packages/cli/bin/jentic-api-scorecard.mjs score \
  https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/swagger-api/petstore/1.0.27/openapi.json \
  --format sarif -o /tmp/phase17.sarif
```

Exits 0. `/tmp/phase17.sarif` parses as JSON; `.version === '2.1.0'`; `.runs` is a non-empty array; `.runs[*].results[*].ruleId` and `.level` are populated. (Requires the local image at the matching `cli-version` tag; run `npm run build:image` first if it is absent.)

### 5. Forced full diagnostics + explicit-`--detail` warning

```
node packages/cli/bin/jentic-api-scorecard.mjs score \
  https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/swagger-api/petstore/1.0.27/openapi.json \
  --format sarif --detail summary -o /tmp/phase17-summary.sarif
```

stderr contains a one-line warning that `--detail` is ignored with `--format sarif`, printed cleanly (emitted before the spinner starts, so it is not interleaved with or overwritten by the spinner line). `/tmp/phase17-summary.sarif` still contains the full diagnostics (non-empty `results[]`), proving the detail filter was bypassed rather than honored. Re-running with `--quiet` (spinner suppressed) shows the identical warning text, confirming the warning is independent of the spinner.

### 6. README and SKILL reflect the new format

`README.md` `## CLI reference` lists `sarif` among the `--format` choices and documents the diagnostics-only projection, forced-full-diagnostics behavior, and logical-location-only limitation. `skills/jentic-api-scorecard/SKILL.md` flag table lists `sarif` with matching notes. Both updated in the same commit as the code, per `.claude/rules/cli-readme-sync.md`.

### 7. Roadmap lifecycle marker

```
grep -F "## Phase 17 — SARIF formatter (\`--format sarif\`) ✅" specs/roadmap.md
```

Exits 0. The Phase 17 heading carries the ` ✅` suffix (space + U+2705) and the rest of the block is unchanged.

## Not Required

- No GitHub Action, workflow file, or `upload-sarif` integration — that is a separate later phase.
- No `physicalLocation` regions, line/column data, or inline PR-diff annotations.
- No `tool.driver.rules[]` catalog.
- No severity filtering, findings cap, or `--min-score` gating.
- No Python (`docker/`) changes and no new exit codes — this is a host-side formatter only, so `docker/tests/` need not run.
- No e2e suite change required beyond the manual end-to-end checks above, unless the dispatch edit in `commands/score.ts` is found to affect an existing e2e assertion.
