# Phase 20 Plan — SARIF Source Line/Column Mapping

## Group 1 — Add the apidom dependencies to the action

1. Add `@speclynx/apidom-reference` and `@speclynx/apidom-json-pointer` (both `^4.11.1`) to `dependencies` in `action/package.json`. `@speclynx/apidom-reference` bundles the OpenAPI 2 / 3.0 / 3.1 parser adapters by default (confirmed: its default `options.parse.parsers` includes `openapi-yaml-3-0`, `openapi-yaml-3-1`, `openapi-json-3-1`, …), so **no separate parser-adapter package is required**.
2. Update the action's setup step in `action.yml` (the `npm install` that anchors on `action/package.json`) so the two apidom packages install alongside the CLI / formatter-html into `action/node_modules` in a fresh `source: "./"` checkout. Confirm the in-repo `.github/workflows/action-selftest.yml` path also resolves them (the self-test builds the workspace; apidom resolves from `action/node_modules`).

## Group 2 — Build the source locator in `action/postprocess.mjs`

3. Add top-of-file imports `import { parse } from '@speclynx/apidom-reference';`, `import { evaluate } from '@speclynx/apidom-json-pointer';`, and `import { resolve as resolvePath } from 'node:path';` (matching the existing helper's plain-ESM import style). `pathToFileURL` is already imported from `node:url` (line 21) — reuse it.
4. Add `async function createSourceLocator(input)`: return `null` immediately when `input` is empty or a URL (`/^https?:\/\//i`) — URL inputs do not exist in the checkout, so there is nothing to map. Otherwise resolve `input` to an **absolute** `file://` URI — `input` is a path relative to the consumer's checkout root, which is also the helper's cwd (the postprocess step in `action.yml` runs `node …/postprocess.mjs` with no `working-directory`, and the `score` step read the same relative path from the same cwd), so resolve with `pathToFileURL(resolvePath(process.cwd(), input))`, **not** a bare `pathToFileURL(input)` (which leaves a relative path relative and yields a wrong URI → silent line-1 fallback). Then `await parse(fileUri, { parse: { parserOpts: { sourceMap: true, strict: false } }, resolve: { resolverOpts: { fileAllowList: [/\.(ya?ml|json)$/i] } } })`. Wrap in `try/catch` — on any throw (unreadable / absent file, parse failure, disallowed extension) return `null`. On success return a closure `locate(pointer)`.
5. Implement the `locate(pointer)` closure with **strip-last-segment fallback**: split the RFC 6901 pointer string into segments; while segments remain, build the pointer and `evaluate(api, ptr)` inside a `try`; on success return `{ startLine: node.startLine + 1, startColumn: node.startCharacter + 1 }` (0-based apidom → 1-based SARIF; `startCharacter` is UTF-16, matching SARIF's default column kind); on throw, `pop()` the last segment and retry. Return `null` when segments are exhausted or the pointer was empty.

## Group 3 — Wire the locator into `addPhysicalLocations`

6. Make `addPhysicalLocations` `async` and add a `locate` parameter (the closure from `createSourceLocator`, or `null`). For each result, read its pointer from `result.locations?.[0]?.logicalLocations?.[0]?.fullyQualifiedName`; compute `region = (locate && pointer ? locate(pointer) : null) ?? { startLine: 1 }`. Keep `artifactLocation: { uri: artifactUri }` exactly as today. Results with no logical pointer (no `locations`, empty `fullyQualifiedName`) get the `{ startLine: 1 }` fallback unchanged.
7. In `main()`, create the locator once — `const locate = await createSourceLocator(env['INPUT']);` — before the `addPhysicalLocations` call, and `await` the now-async `addPhysicalLocations(fullSarif, artifactUri, locate)`. Parsing happens exactly once per run regardless of result count.

## Group 4 — Tests

8. Add a paired source fixture under `packages/cli/test/fixtures/`: a small local OpenAPI document **plus** a captured engine `report.json` whose diagnostic pointers resolve against that source. Capture it via a real `score` run (`docker run` / CLI) against the source file so pointers and lines are genuinely paired — no hand-authored shapes (per `.claude/rules/testing.md`, no mocking). The source must yield **both** an exactly-resolving pointer **and** an over-specified pointer (one whose leaf doesn't exist in the source) so the strip-fallback case in task 9 is genuinely exercised — pick the source for that property rather than defaulting to the existing `sample.yaml`, which may not produce deep-enough pointers. Document the capture command in a comment so the fixture is regeneratable.
9. Extend `packages/cli/test/action/postprocess.test.ts` (the existing black-box subprocess suite) with a `describe('SARIF source line mapping')` block driving the helper with `INPUT` pointing at the on-disk source fixture and the paired `report.json`:
   - a diagnostic whose pointer resolves exactly → its result's `physicalLocation.region.startLine` is the real source line (> 1), asserted against a known line in the fixture;
   - a diagnostic whose pointer over-specifies (a bundled pointer past a node that exists only shallowly in the source) → strip-fallback lands on the nearest ancestor's line (> 1), not line 1 and not a wrong line;
   - a diagnostic with an empty / absent pointer → `region.startLine === 1` (file-level fallback);
   - `artifactLocation.uri` is unchanged by the mapping (still the `sarifArtifactUri` value).
10. Add graceful-degradation cases (these must hold so the existing `INPUT: './openapi.yaml'`-with-no-file tests keep passing):
    - `INPUT` is a URL → every result keeps `startLine: 1` (no parse attempted);
    - `INPUT` names a non-existent / unreadable local file → every result keeps `startLine: 1`, helper exits 0 (no throw);
    - SARIF is still schema-valid (existing ajv gate) with real regions present.

## Group 5 — Docs and lifecycle

11. Update `docs/architecture.md` (the action SARIF section describing the line-1 stopgap and issue #191) to describe real pointer→source-line mapping for local-file inputs, the strip-fallback behavior, and that URL inputs keep the file-level fallback by design.
12. Update `.claude/CLAUDE.md` `action/` description: the helper now maps JSON Pointers to real source line/column via SpecLynx apidom (local-file inputs), replacing the line-1 stopgap; note the two new `action/` dependencies and that `sarif.ts` / `sarifArtifactUri` are untouched.
13. Append ` ✅` (a single space followed by the U+2705 checkmark) to the `## Phase 20 — SARIF Source Line/Column Mapping` heading in `specs/roadmap.md`, leaving the rest of the block untouched.

## Group 6 — Verify

14. `npm run lint -w @jentic/api-scorecard-cli` exits 0 (ESLint + Prettier clean on the touched `.ts` test file). Note: `action/postprocess.mjs` is **not** covered by this lint — `eslint.config.js` globally ignores `**/*.mjs` and the CLI lint script targets only `src test`. Match the existing helper's style by hand; do not assume lint will catch a `.mjs` regression.
15. `npm run build -w @jentic/api-scorecard-cli` exits 0 (the black-box suite imports the built workspace formatters).
16. `npm test -w @jentic/api-scorecard-cli` exits 0, including the new source-line-mapping and graceful-degradation cases and the existing `postprocess.test.ts` cases (which pass `INPUT: './openapi.yaml'` with no file present — must still produce line-1 SARIF).
17. End-to-end (manual): run the action helper against the paired source fixture and confirm `report.sarif` contains a result with `region.startLine > 1` matching the known fixture line, and that a URL input run still yields `startLine: 1`. Optionally drive the full action via `.github/workflows/action-selftest.yml` semantics — note the self-test's OAK input is a **URL**, so it exercises the line-1 (no-op) path; real-line mapping is exercised by the local-file fixture test in Group 4.
18. `grep -F "## Phase 20 — SARIF Source Line/Column Mapping ✅" specs/roadmap.md` exits 0 (lifecycle marker present with the load-bearing leading space).
