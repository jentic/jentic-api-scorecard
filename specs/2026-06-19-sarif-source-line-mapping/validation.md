# Phase 20 Validation — SARIF Source Line/Column Mapping

## Definition of Done

All of the following must be true before this branch is merged.

### 1. Lint is clean

```
npm run lint -w @jentic/api-scorecard-cli
```

Exits 0. ESLint + Prettier pass on the extended `packages/cli/test/action/postprocess.test.ts`. This lint does **not** cover `action/postprocess.mjs` — `eslint.config.js` globally ignores `**/*.mjs` and the CLI lint script targets only `src test` — so the helper's style is matched by hand, not enforced here.

### 2. Build is clean

```
npm run build -w @jentic/api-scorecard-cli
```

Exits 0. The black-box test suite imports the built workspace formatters, so the build must precede the test run (as CI does).

### 3. Dependencies declared on the action

`action/package.json` lists `@speclynx/apidom-reference` and `@speclynx/apidom-json-pointer` under `dependencies`. `action.yml`'s install step installs them into `action/node_modules` (verifiable by reasoning from the install command + the `action/package.json` anchor). No separate apidom parser-adapter package is added (the reference package bundles the OpenAPI adapters).

### 4. Real source lines are mapped

```
npm test -w @jentic/api-scorecard-cli
```

Exits 0, including the new `SARIF source line mapping` cases in `postprocess.test.ts`:
- a diagnostic whose pointer resolves exactly → its result's `physicalLocation.region.startLine` equals the known source line in the paired fixture and is **> 1**;
- a diagnostic whose pointer over-specifies past the source → strip-fallback lands on the nearest existing ancestor's line (**> 1**, and the asserted ancestor line — not a wrong line);
- `physicalLocation.region.startColumn` is present and 1-based for a mapped result.

### 5. Fallback is honest

In the same suite:
- a diagnostic with an empty / absent pointer → `region.startLine === 1`;
- the emitted SARIF still validates against the SARIF 2.1.0 schema (the existing ajv gate) with real regions present.

### 6. Graceful degradation — never worse than the stopgap

In the same suite, the helper exits 0 and every result keeps `region.startLine === 1` (no throw) when:
- `INPUT` is a URL (e.g. the OAK petstore URL) — no parse attempted, mapping is a deliberate no-op;
- `INPUT` names a non-existent / unreadable local file (the existing `INPUT: './openapi.yaml'`-with-no-file cases must keep passing unchanged).

### 7. `artifactLocation.uri` unchanged

The existing `SARIF artifact URI` cases in `postprocess.test.ts` pass unchanged — the mapping fills `region` only and does not alter the repo-relative artifact URI (issues #200 / #208).

### 8. Score-once preserved

The helper performs **no** `score` / `docker run` invocation; it reads and parses the already-on-disk source file. Verifiable from the helper source (no child-process score) and from the action self-test log (one `score` invocation).

### 9. Docs updated

`docs/architecture.md` (action SARIF section) and `.claude/CLAUDE.md` (`action/` description) describe real pointer→source-line mapping for local-file inputs, the strip-fallback behavior, the two new `action/` dependencies, and that URL inputs keep the file-level fallback — replacing the line-1 stopgap language and the open issue #191 reference.

### 10. Roadmap lifecycle marker

```
grep -F "## Phase 20 — SARIF Source Line/Column Mapping ✅" specs/roadmap.md
```

Exits 0. The Phase 20 heading carries the ` ✅` suffix (space + U+2705) and the rest of the block is unchanged.

## Not Required

- Mapping URL inputs to real lines — out of scope by design (the URL'd file is absent from the checkout; code-scanning has nothing to anchor against).
- `endLine` / `endColumn` regions and inline PR-diff annotations — start position only this phase.
- Any change to `packages/cli/src/formatters/sarif.ts`, `formatSarif`, the `./formatters/sarif` export, or the CLI's `--format sarif` surface — the mapping is action-helper-only.
- Changes to `sarifArtifactUri` or `artifactLocation.uri` (issues #200 / #208) — frozen.
- README `## CLI reference` / `SKILL.md` flag-table sync — no CLI surface change.
- Python / `docker/` changes — no engine or container change, so `docker/tests/` need not run.
