# Phase 18 Validation — Markdown formatter (`--format markdown`)

## Definition of Done

All of the following must be true before this branch is merged.

### 1. Lint is clean

```
npm run lint -w @jentic/api-scorecard-cli
```

Exits 0. ESLint + Prettier pass on the new `formatters/markdown.ts` and every other touched `.ts` file.

### 2. TypeScript type-checks

```
npm run build:typescript -w @jentic/api-scorecard-cli
```

Exits 0. `tsc` compiles the new formatter, the extended `Format` record, and the dispatch change in `commands/score.ts` with no errors.

### 3. Unit tests pass, including the new Markdown suite

```
npm test -w @jentic/api-scorecard-cli
```

Exits 0. `test/formatters/markdown.test.ts` asserts, against `test/fixtures/scorecard.sample.json`:
- the headline contains the rounded overall score, the upper-cased level, and the grade;
- the dimension table has a GFM header row plus one row per `summary.dimensions[]` entry (6 rows), with kinds `FC`, `DXJ`, `ARAX`, `AU`, `SEC`, `AID`;
- `--detail` projection: `summary` → headline only (no dimension table); `dimensions` → dimension table, no signals/diagnostics sections; `signals` → signals section present; `diagnostics` → diagnostics section present;
- a minimal `ScorecardResult` (only `summary.{score,level,grade}`) renders a headline without throwing and emits no empty tables;
- an inline-constructed diagnostic message containing a literal `|` and a `\n` renders with `\|` and the newline collapsed to a space (no raw pipe, no broken row) — the fixture has no pipe-bearing message, so this case builds its own input.

### 4. Markdown output is valid GFM end-to-end against a real score

```
node packages/cli/bin/jentic-api-scorecard.mjs score \
  https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/swagger-api/petstore/1.0.27/openapi.json \
  --format markdown
```

Exits 0 and prints Markdown to stdout: an H1 headline line, a score/level/grade line, and a GFM pipe table for dimensions (header row, separator row, one row per dimension). No ANSI escape codes in the output. (Requires the local image at the matching `cli-version` tag; run `npm run build:image` first if it is absent.)

### 5. Rendered-Markdown spot check

Paste the §4 output (and a `--format markdown --detail diagnostics` run) into a GitHub Markdown preview — e.g. a draft PR comment, or echo it into `$GITHUB_STEP_SUMMARY` in a scratch workflow. The dimension table and any signal/diagnostic tables render as real tables (no leaking raw `|`, no broken rows), headings render as headings, and the document reads cleanly.

### 6. README and SKILL reflect the new format

`README.md` `## CLI reference` lists `markdown` among the `--format` choices and includes a short `--format markdown` usage subsection. `skills/jentic-api-scorecard/SKILL.md`'s `-f, --format <fmt>` row lists `markdown` alongside `pretty`, `json`, `html`. Both updated in the same commit as the code, per `.claude/rules/cli-readme-sync.md`.

### 7. Roadmap lifecycle marker

```
grep -F "## Phase 18 — Markdown formatter (\`--format markdown\`) ✅" specs/roadmap.md
```

Exits 0. The Phase 18 heading carries the ` ✅` suffix (space + U+2705) and the rest of the block is unchanged.

## Not Required

- No GitHub Action, workflow file, or `$GITHUB_STEP_SUMMARY` wiring — that is Phase 19.
- No `./markdown` subpath export from the CLI package — the Action invokes `--format markdown`; importable access is a non-breaking future follow-up.
- No emoji, shields.io badges, or collapsible `<details>` chrome — first cut is plain GFM.
- No Python (`docker/`) changes and no new exit codes — host-side formatter only, so `docker/tests/` need not run.
- No e2e suite change required beyond the manual end-to-end checks above, unless the dispatch edit in `commands/score.ts` is found to affect an existing e2e assertion.
