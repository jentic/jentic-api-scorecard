# Phase 6 Plan — JSON formatter (`--format json`)

## Group 1 — Format type module

1. Create `packages/cli/src/format.ts` mirroring `packages/cli/src/detail.ts`'s shape: export `Format = { PRETTY: 'pretty', JSON: 'json' } as const`, derived `type Format = (typeof Format)[keyof typeof Format]`, `FORMATS: readonly Format[] = [Format.PRETTY, Format.JSON]`, `DEFAULT_FORMAT: Format = Format.PRETTY`, and `isFormat(value: string): value is Format`.

## Group 2 — JSON formatter

2. Create `packages/cli/src/formatters/json.ts` exporting `formatJson(result: ScorecardResult): string`. Body returns `JSON.stringify(result, null, 2) + '\n'`. Imports `ScorecardResult` from `../result.ts` (with the `.ts` suffix per `.claude/rules/typescript-code-style.md`).

## Group 3 — Wire the flag

3. In `packages/cli/src/index.ts`, register `--format <fmt>` via `addOption(new Option('--format <fmt>', '<help text>').choices([...FORMATS]).default(DEFAULT_FORMAT))` immediately adjacent to the existing `-d, --detail` block. Import `Format`, `FORMATS`, `DEFAULT_FORMAT` from `./format.ts`.
4. Widen the action callback's typed `opts` in `index.ts` to include `format: Format`. Pass `opts.format` into `runScore`.
5. In `packages/cli/src/commands/score.ts`, extend `ScoreOptions` with `format?: Format`. After `filterByDetail(parsed, detail)` (the existing call at `score.ts:154`), branch on `options.format ?? DEFAULT_FORMAT`: `Format.PRETTY` calls `formatPretty(filtered, input, { detail })` (existing behavior); `Format.JSON` calls `formatJson(filtered)`. The single `process.stdout.write(output)` site is unchanged.

## Group 4 — Restore appendHint lines

6. In `packages/cli/src/formatters/pretty.ts` `appendHint()` (around line 303), reintroduce the three lines removed in commit `337b55e`. After the existing `Run with --detail dimensions for the dimension table.` line in the SUMMARY branch, append `  Full report: --format json --detail diagnostics`. After the existing `Run with --detail signals for signal breakdown.` line in the DIMENSIONS branch, append `  Full report: --format json --detail diagnostics`. After the existing `Run with --detail diagnostics for severity counts and a preview of findings.` line in the SIGNALS branch, append `  Full evidence: --format json --detail diagnostics`. All three wrapped in `chalk.dim(...)` consistent with surrounding lines.

## Group 5 — Tests

7. Create `packages/cli/test/formatters/json.test.ts`. Mirror the layout of `packages/cli/test/formatters/pretty.test.ts`: load the fixture from `packages/cli/test/fixtures/scorecard.sample.json` once at module level. `describe('formatJson')` with nested `describe` per detail level. Per level, call `formatJson(filterByDetail(fixture, level))` and assert: (a) `JSON.parse(output)` does not throw; (b) output ends with `\n`; (c) output contains `\n  ` (2-space indent); (d) parsed top-level keys match the per-level field map (`summary`: only `metadata`, `apiMetadata`, `summary` minus `summary.dimensions`; `dimensions`: as above with `summary.dimensions` intact; `signals`: adds `details`; `diagnostics`: adds `diagnostics`); (e) at least one verbatim value-passthrough check (e.g. `parsed.summary.score === 66.52`, `parsed.metadata.engine.version === '0.4.1+jairf.1.0.0'`). Add a small "shape robustness" describe block constructing a minimal `ScorecardResult` (only `summary`) and asserting `formatJson` produces parseable JSON.
8. In `packages/cli/test/formatters/pretty.test.ts`, extend the existing per-detail-level describe blocks. Inside `describe('default detail (dimensions)')`, `describe('detail = summary')`, and `describe('detail = signals')`, add `it('hints at --format json --detail diagnostics')` asserting `output.includes('--format json --detail diagnostics')`. The DIAGNOSTICS branch unchanged (no hint).
9. In `packages/cli/test/e2e/score.e2e.test.ts`, add a new `describe('--format json')` block after the existing `--detail summary` block. Reuse the existing `CLI_BIN`, `SAMPLE_SPEC`, and `E2E_TIMEOUT_MS` constants. Cover four cases: (a) `score <sample> --format json` exits 0, stdout is parseable JSON, parsed has `summary.score` (number) and `summary.dimensions` (length 6), no `details`/`diagnostics` at top level. (b) `--format json --detail summary` exits 0, parsed has `summary.score` but no `summary.dimensions`, no `details`/`diagnostics`. (c) `--format json --detail diagnostics` exits 0, parsed has both `details` and `diagnostics` arrays. (d) `--format invalid` exits non-zero with stderr containing `--format` and `invalid`.

## Group 6 — Docs, roadmap completion, Verify

10. Update `docs/architecture.md`: in §5's `--format <fmt>` row at line 163, replace the TTY-aware default language with "Default: `pretty` (unconditional). Values: `pretty`, `json`. `markdown` and `html` are reserved for later phases." Mark `--json` (line 164) as "(deferred — not in Phase 6)". Audit §11 verification recipes (lines 696-703) and remove the `--format json -o report.json` line if present, since `-o` is Phase 8 (or annotate as Phase 8). Leave §7 (lines 527-630) untouched — its engine-verbatim contract is exactly what Phase 6 ships.
11. Update `.claude/CLAUDE.md`: replace "`--format json --detail diagnostics` will surface it once Phase 6 lands" with "`--format json --detail diagnostics` surfaces the full evidence bundle". In the same paragraph, remove Phase 6 from the "ship in Phases 6 / 8 / 9 / 7" trailer so it reads "ship in Phases 8 / 9 / 7 respectively".
12. Update `specs/tech-stack.md`: in the "Roadmap, not yet built" section (line 107 area), refresh the "Output formats and CLI surface" bullet so `--format` (pretty + json) is listed as shipped and the rest (`-o`, `--quiet`, `--verbose`, markdown/html formatters) remains deferred.
13. Update `README.md`: add a short "Machine-readable output" subsection between "Control output depth" and the LLM section, with `npx @jentic/api-scorecard-cli score ./openapi.yaml --format json | jq .summary.score` and `… --format json --detail diagnostics > report.json` as the two canonical recipes.
14. Append ` ✅` (single space + U+2705) to the Phase 6 heading in `specs/roadmap.md` so it reads `## Phase 6 — JSON formatter (\`--format json\`) ✅`. Leave the rest of the Phase 6 block untouched.

## Group 7 — Verify

15. `npm run lint -w @jentic/api-scorecard-cli` exits 0.
16. `npm run typescript:check-types -w @jentic/api-scorecard-cli` exits 0.
17. `npm run build:typescript -w @jentic/api-scorecard-cli` exits 0.
18. `npm test -w @jentic/api-scorecard-cli` exits 0; the new `json.test.ts`, the extended `pretty.test.ts` hints assertions, and the existing `detail.test.ts` / `exit-codes.test.ts` all pass.
19. `npm run test:e2e` exits 0; the new `--format json` e2e block plus the existing e2e blocks all pass against the locally-built docker image at the matching CLI tag.
20. `cd docker && uv run poe lint` exits 0 and `cd docker && uv run poe test` exits 0 (regression guard — Phase 6 does not touch Python, but the CI workflow runs both).
21. Smoke: `JENTIC_API_KEY=mvp-preview node packages/cli/bin/jentic-api-scorecard.mjs score docker/.build/sample.yaml --format json | jq .summary.score` prints a number and exits 0.
22. Smoke: `JENTIC_API_KEY=mvp-preview node packages/cli/bin/jentic-api-scorecard.mjs score docker/.build/sample.yaml --format json --detail diagnostics | jq '.diagnostics | length'` prints an integer ≥ 1 and exits 0.
23. Smoke: `JENTIC_API_KEY=mvp-preview node packages/cli/bin/jentic-api-scorecard.mjs score docker/.build/sample.yaml --format invalid` exits non-zero with stderr containing `--format` and `invalid`.
24. Smoke (default unchanged): `JENTIC_API_KEY=mvp-preview node packages/cli/bin/jentic-api-scorecard.mjs score docker/.build/sample.yaml` produces pretty-formatted output containing `Full report: --format json --detail diagnostics` in the footer hints.
25. `grep -F "## Phase 6 — JSON formatter (\`--format json\`) ✅" specs/roadmap.md` exits 0.
26. `grep -F "format json" README.md` exits 0.
