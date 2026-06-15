# Phase 17 Plan — SARIF formatter (`--format sarif`)

## Group 1 — Register the format

1. Add `SARIF: 'sarif'` to the `Format` `as const` record in `packages/cli/src/format.ts` and append `Format.SARIF` to the `FORMATS` array. The `-f, --format` choices in `index.ts` extend automatically from `FORMATS`.
2. Generalize the TTY-refuse guard in `packages/cli/src/validate.ts` so it covers `sarif` as well as `html` (both write machine output that must not dump into an interactive terminal). Keep the message format-specific (name the actual `--format` value), require `-o` or a redirected stdout.

## Group 2 — Implement the encoder

3. Create `packages/cli/src/formatters/sarif.ts` exporting `formatSarif(result: ScorecardResult): string`. Return a SARIF 2.1.0 document (`version: '2.1.0'`, `$schema` set to the OASIS SARIF 2.1.0 schema URI) ending with a trailing newline, matching `formatJson`'s pretty-printed style.
4. Read `result.diagnostics` defensively (may be absent → emit a document with an empty/zero-result run set, never crash). Group diagnostics by `source`; emit one `runs[]` entry per source with `tool.driver.name = <source>`.
5. Map each diagnostic to a SARIF `result`: `ruleId = code`, `message.text = message`, `level` from `severity` via a `severityToLevel` helper (1→error, 2→warning, 3→note, 4→note, unknown→note). Build `locations[]` from `data.path` (single pointer) or `data.paths` (one location per pointer) as `logicalLocation.fullyQualifiedName`; emit no `locations` key when neither is present.
6. Encode each JSON-Pointer path array as a single `fullyQualifiedName` string (join with `/`, matching the engine's `[path: …]` convention) so the Security tab shows a readable location.

## Group 3 — Wire into dispatch

7. In `packages/cli/src/commands/score.ts`, extend the format-dispatch (around the `format === Format.HTML ? … : …` chain) to call `formatSarif` when `format === Format.SARIF`.
8. Force full diagnostics for SARIF: when `format === Format.SARIF`, bypass `--detail` filtering and feed the unfiltered `parsed` result to `formatSarif` (the other formatters still consume `filterByDetail(parsed, detail)`).
9. Emit a one-line stderr warning when `format === Format.SARIF` and `--detail` was set explicitly to a non-`diagnostics` level. Emit it in `index.ts` up-front — in the same pre-flight slot as `validateScoreOptions`, before `runScore` starts — so no ora spinner is active when it writes to stderr (the spinner also writes to stderr; writing the warning mid-scoring would garble the spinner line). Detect "explicit" via Commander `getOptionValueSource('detail') === 'cli'`; the default `dimensions` must not warn. Keep the warning non-fatal (inform and proceed) — distinct from `validateScoreOptions`, which returns an error and exits.
10. Confirm `-o` file output works for SARIF: `writeReport` already passes non-pretty content through verbatim (no chalk strip), so `--format sarif -o out.sarif` writes the document unmodified. Add no special-casing unless a gap is found.

## Group 4 — Tests

11. Add `ajv` (and the SARIF 2.1.0 JSON Schema, committed under `packages/cli/test/fixtures/`) as a CLI devDependency in `packages/cli/package.json`.
12. Create `packages/cli/test/formatters/sarif.test.ts` asserting against `packages/cli/test/fixtures/scorecard.sample.json` (34 diagnostics; severities 1/2/3; all 5 sources; 12 single-path, 8 plural-paths, 14 no-pointer): the output validates against the SARIF schema via ajv; `version === '2.1.0'`; one run per distinct source; result count equals diagnostic count; severity→level mapping (1→error, 2→warning, 3→note); single-pointer → one logical location; plural-paths → one location per pointer; no-pointer → result with no `locations`.
13. Add a shape-robustness case: a minimal `ScorecardResult` with no `diagnostics` key produces a schema-valid SARIF document without throwing.
14. Extend `packages/cli/test/validate.test.ts` to cover `--format sarif`: refused to a TTY without `-o`; allowed when piped; allowed to a TTY with `-o`.

## Group 5 — Docs and lifecycle

15. Update `README.md` `## CLI reference`: add `sarif` to the `--format` choices, document the diagnostics-only projection, the forced-full-diagnostics behavior (+ the explicit-`--detail` warning), and the logical-location-only limitation (no inline PR-diff annotations yet).
16. Update `skills/jentic-api-scorecard/SKILL.md` flag table to list `sarif` as a `--format` value with the same notes, per `.claude/rules/cli-readme-sync.md`.
17. Append ` ✅` (a single space followed by the U+2705 checkmark) to the `## Phase 17 — SARIF formatter (`--format sarif`)` heading in `specs/roadmap.md`, leaving the rest of the block untouched.

## Group 6 — Verify

18. `npm run lint -w @jentic/api-scorecard-cli` exits 0 (ESLint + Prettier clean on touched `.ts` files).
19. `npm run build:typescript -w @jentic/api-scorecard-cli` exits 0 (`tsc` type-checks the new formatter and dispatch changes).
20. `npm test -w @jentic/api-scorecard-cli` exits 0, including the new `sarif.test.ts` (schema-valid SARIF, severity mapping, location cases) and the extended `validate.test.ts`.
21. `node packages/cli/bin/jentic-api-scorecard.mjs score https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/swagger-api/petstore/1.0.27/openapi.json --format sarif -o /tmp/out.sarif` exits 0 and `/tmp/out.sarif` parses as JSON with `.version === '2.1.0'` and a non-empty `.runs[0].results` array. (Requires the local image at the matching tag — `npm run build:image` if absent.)
22. `node packages/cli/bin/jentic-api-scorecard.mjs score <allowlisted-url> --format sarif --detail summary -o /tmp/out.sarif` prints the explicit-`--detail` warning on stderr and still writes a full-diagnostics SARIF document.
23. `grep -F "## Phase 17 — SARIF formatter (\`--format sarif\`) ✅" specs/roadmap.md` exits 0 (lifecycle marker present with the load-bearing leading space).
