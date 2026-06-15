# Phase 18 Plan — Markdown formatter (`--format markdown`)

## Group 1 — Register the format

1. Add `MARKDOWN: 'markdown'` to the `Format` `as const` record in `packages/cli/src/format.ts` and append `Format.MARKDOWN` to the `FORMATS` array. The `-f, --format` choices in `index.ts` extend automatically from `FORMATS`.
2. Confirm no `validateScoreOptions` change is needed: Markdown is plain text, safe to a TTY (the formatter never refuses stdout). Leave `validate.ts` untouched.

## Group 2 — Implement the formatter

3. Create `packages/cli/src/formatters/markdown.ts` exporting `formatMarkdown(result: ScorecardResult, options: { detail?: DetailLevel } = {}): string`, mirroring `formatPretty`'s signature and `--detail` gating but emitting GFM (no `chalk` import, no ANSI).
4. Render the headline: an H1 title, then score (rounded integer `/ 100`), level (upper-cased), and grade — e.g. `Score **66** / 100 — AI-AWARE (B)`. Include the engine/framework version line and `apiMetadata.name`/version when present, as `pretty` does.
5. Render the dimension table at `--detail dimensions` and above: a GFM pipe table with columns Kind / Name / Score / Grade from `summary.dimensions[]` (rounded integer scores). Omit the table when `summary.dimensions` is absent/empty.
6. Render the API-stats line (operations / schemas / tags / security schemes) from `apiMetadata` when present, as a short bullet or inline list.
7. Render the signals section at `--detail signals` and above: per dimension (from `details[].dimensions[].signals[]`), a sub-heading and a table of signal Name / Score (as `%`, since signal scores are `[0,1]`) / Description. Skip dimensions with no signals.
8. Render the diagnostics section at `--detail diagnostics`: a severity tally then a table (or grouped lists) of findings — code, severity label, message. Escape literal `|` in messages (`\|`) so cells don't break the table. Tolerate zero diagnostics (render a "0 diagnostics" line).
9. Add a small `escapeCell(s: string): string` helper for table cells: escape literal `|` to `\|`, and collapse any literal newline (`\n`/`\r`) to a space so a multi-line message can't break the GFM row.

## Group 3 — Wire into dispatch

10. In `packages/cli/src/commands/score.ts`, import `formatMarkdown` and extend the format-dispatch chain so `format === Format.MARKDOWN` calls `formatMarkdown(filtered, { detail })` (Markdown consumes the `--detail`-filtered result, exactly like `pretty`).
11. Confirm `-o` output works for Markdown: `writeReport` strips ANSI only for `pretty`; Markdown carries no ANSI, so it passes through verbatim. Add no special-casing.

## Group 4 — Tests

12. Create `packages/cli/test/formatters/markdown.test.ts` asserting against `packages/cli/test/fixtures/scorecard.sample.json` (mirror `pretty.test.ts` / `json.test.ts` structure): headline contains the rounded score, upper-cased level, and grade; the dimension table has a GFM header row plus one row per `summary.dimensions[]` entry (6 in the fixture) with the expected kinds (`FC`, `DXJ`, `ARAX`, `AU`, `SEC`, `AID`).
13. Add `--detail` projection cases: `summary` → headline only, no dimension table; `dimensions` → dimension table present, no signals/diagnostics sections; `signals` → signals section present; `diagnostics` → diagnostics section present. Feed each through `filterByDetail(fixture, level)` as the sibling formatter tests do.
14. Add a robustness case: a minimal `ScorecardResult` (only `summary.{score,level,grade}`) renders a headline without throwing and emits no empty tables.
15. Add a cell-escaping case: build a small inline `ScorecardResult` whose diagnostic message contains both a literal `|` and a `\n` (no fixture diagnostic contains a pipe, so the input must be constructed), and assert the rendered cell shows `\|` and a space (no raw pipe, no row break).

## Group 5 — Docs and lifecycle

16. Update `README.md`: add `markdown` to the `## CLI reference` `--format` choices and add a short `--format markdown` subsection (sibling to the existing `--format json` / `--format html` subsections) showing a `$GITHUB_STEP_SUMMARY` / PR-comment usage example.
17. Update `skills/jentic-api-scorecard/SKILL.md`: add `markdown` to the `-f, --format <fmt>` row's allowed values (currently `pretty`, `json`, `html`), per `.claude/rules/cli-readme-sync.md`.
18. Append ` ✅` (a single space followed by the U+2705 checkmark) to the `## Phase 18 — Markdown formatter (\`--format markdown\`)` heading in `specs/roadmap.md`, leaving the rest of the block untouched.

## Group 6 — Verify

19. `npm run lint -w @jentic/api-scorecard-cli` exits 0 (ESLint + Prettier clean on `markdown.ts` and touched files).
20. `npm run build:typescript -w @jentic/api-scorecard-cli` exits 0 (`tsc` type-checks the new formatter and the dispatch/format-record changes).
21. `npm test -w @jentic/api-scorecard-cli` exits 0, including the new `markdown.test.ts` (headline, dimension table, `--detail` projection, robustness, pipe-escaping).
22. `node packages/cli/bin/jentic-api-scorecard.mjs score https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/swagger-api/petstore/1.0.27/openapi.json --format markdown` exits 0 and prints valid GFM (an H1 headline and a `|`-delimited dimension table). (Requires the local image at the matching tag — `npm run build:image` if absent.)
23. Spot-check the rendered Markdown: paste the §22 output (or `--detail diagnostics` output) into a GitHub Markdown preview (or a `$GITHUB_STEP_SUMMARY` in a scratch workflow) and confirm the table and headings render — no raw `|` pipes leaking, no broken rows.
24. `grep -F "## Phase 18 — Markdown formatter (\`--format markdown\`) ✅" specs/roadmap.md` exits 0 (lifecycle marker present with the load-bearing leading space).
