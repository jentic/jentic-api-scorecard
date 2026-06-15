# Phase 17 Plan — SARIF formatter (`--format sarif`)

## Group 1 — Register the format

1. Add `SARIF: 'sarif'` to the `Format` `as const` record in `packages/cli/src/format.ts` and append `Format.SARIF` to the `FORMATS` array. The `-f, --format` choices in `index.ts` extend automatically from `FORMATS`.
2. Generalize the TTY-refuse guard in `packages/cli/src/validate.ts` so it covers `sarif` as well as `html` (both write machine output that must not dump into an interactive terminal). Keep the message format-specific (name the actual `--format` value), require `-o` or a redirected stdout.

## Group 2 — Implement the encoder

3. Create `packages/cli/src/formatters/sarif.ts` exporting `formatSarif(result: ScorecardResult): string`. Return a SARIF 2.1.0 document (`version: '2.1.0'`, `$schema: 'https://json.schemastore.org/sarif-2.1.0.json'` — the schemastore URI GitHub code-scanning explicitly recognizes) ending with a trailing newline, matching `formatJson`'s pretty-printed style.
4. Read `result.diagnostics` defensively (may be absent → emit a document with an empty/zero-result run set, never crash). Group diagnostics by `source`; emit one `runs[]` entry per source with `tool.driver.name = <source>`.
5. Map each diagnostic to a SARIF `result`: `ruleId = code`, `message.text = message`, `level` from `severity` via a `severityToLevel` helper (1→error, 2→warning, 3→note, 4→note, unknown→note). Build `locations[]` from the diagnostic's pointers with explicit precedence and empty-array handling (note: in the fixture both `data.path` and `data.paths` are often present, and either may be `[]` meaning "no pointer"): if `data.paths` is a **non-empty** array, emit one `logicalLocation` per pointer; else if `data.path` is a **non-empty** array, emit one location; else emit **no `locations` key**. Keying off non-emptiness (not key presence) is load-bearing — `path: []` must not produce a bogus location.
6. Encode each pointer (an array of segments) into `logicalLocation.fullyQualifiedName` as an **RFC 6901 JSON Pointer**: leading `/`, segments joined by `/`, with `~`→`~0` and `/`→`~1` escaped *within* each segment. This is unambiguous when a segment itself contains a slash (the fixture has `'/health'` and `'application/json'` segments); a naïve `/`-join would corrupt them. Add a small `toJsonPointer(segments: (string | number)[]): string` helper.

## Group 3 — Wire into dispatch

7. In `packages/cli/src/commands/score.ts`, extend the format-dispatch (around the `format === Format.HTML ? … : …` chain) to call `formatSarif` when `format === Format.SARIF`.
8. Force full diagnostics for SARIF: when `format === Format.SARIF`, bypass `--detail` filtering and feed the unfiltered `parsed` result to `formatSarif` (the other formatters still consume `filterByDetail(parsed, detail)`).
9. Emit a one-line stderr warning when `format === Format.SARIF` and `--detail` was set explicitly to a non-`diagnostics` level. Emit it in `index.ts` up-front — in the same pre-flight slot as `validateScoreOptions`, before `runScore` starts — so no ora spinner is active when it writes to stderr (the spinner also writes to stderr; writing the warning mid-scoring would garble the spinner line). Detect "explicit" via Commander `getOptionValueSource('detail') === 'cli'`; the default `dimensions` must not warn. Keep the warning non-fatal (inform and proceed) — distinct from `validateScoreOptions`, which returns an error and exits.
10. Confirm `-o` file output works for SARIF: `writeReport` already passes non-pretty content through verbatim (no chalk strip), so `--format sarif -o out.sarif` writes the document unmodified. Add no special-casing unless a gap is found.

## Group 4 — Tests

11. Add `ajv` (and the SARIF 2.1.0 JSON Schema, committed under `packages/cli/test/fixtures/`) as a CLI devDependency in `packages/cli/package.json`. Mind the draft mismatch: the SARIF 2.1.0 schema declares an older JSON Schema draft (draft-07, or draft-04 on some mirrors) while ajv v8 defaults to draft-2020-12 and will throw at compile time otherwise. Pin a known-good schema revision and configure ajv for its draft (draft-07 is built into ajv core; draft-04 needs the `ajv-draft-04` entry point) so `ajv.compile(schema)` succeeds.
12. Create `packages/cli/test/formatters/sarif.test.ts` asserting against `packages/cli/test/fixtures/scorecard.sample.json` (34 diagnostics; severities 1/2/3; all 5 sources; treating empty arrays as no-pointer: 12 single-location, 8 plural-location, 14 location-less): the output validates against the SARIF schema via ajv; `version === '2.1.0'`; one run per distinct source; result count equals diagnostic count; severity→level mapping (a severity-1 diagnostic emits `level: 'error'`, severity-2 → `'warning'`, severity-3 → `'note'`). Assert the emitted `level` string only — do not assert what severity 1 *means* semantically; only severities 2 and 3 are empirically confirmed (warning / info), and collapsing critical/error into `error` is correct regardless. Location assertions must key off **non-empty** pointers and cover the messy fixture shapes: a diagnostic with a non-empty `data.path` (and empty/absent `data.paths`) → exactly one `logicalLocation`; a diagnostic with non-empty `data.paths` → one location per pointer; a diagnostic with **both** `data.path: []` and non-empty `data.paths` → locations come from `paths` (precedence), not an empty `path`; a diagnostic with both arrays empty (or `paths` absent and `path: []`) → result with **no** `locations` key.
12a. Add a unit test for the `toJsonPointer` helper proving RFC 6901 escaping: `['paths', '/health', 'get']` → `/paths/~1health/get` and a segment containing `~` escapes to `~0`. This guards the slash-in-segment case the fixture exercises (`'/health'`, `'application/json'`).
13. Add a shape-robustness case: a minimal `ScorecardResult` with no `diagnostics` key produces a schema-valid SARIF document without throwing.
14. Extend `packages/cli/test/validate.test.ts` to cover `--format sarif`: refused to a TTY without `-o`; allowed when piped; allowed to a TTY with `-o`. Note: the explicit-`--detail` warning trigger lives in `index.ts` (it reads Commander's `getOptionValueSource`), so it is not unit-tested here — only `validateScoreOptions` is. The trigger is exercised by the manual end-to-end check in `validation.md` §5, matching how the existing TTY-validation split is covered.

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
