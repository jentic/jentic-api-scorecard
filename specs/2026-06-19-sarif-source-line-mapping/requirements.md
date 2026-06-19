# Phase 20 Requirements — SARIF Source Line/Column Mapping

## Scope

The Phase 19 GitHub Action uploads SARIF findings to the repository Security tab. GitHub code-scanning rejects a result that has no `physicalLocation` (`locationFromSarifResult: expected a physical location`), so the action's helper (`action/postprocess.mjs`, `addPhysicalLocations`) attaches a stopgap `physicalLocation` pointing at the scored document at `startLine: 1`. Findings ingest and link to the file, but **every finding points at line 1**.

This phase replaces the line-1 stopgap with a real mapping: for a **local-file** input, parse the source with [SpecLynx apidom](https://github.com/speclynx/apidom), walk each diagnostic's JSON Pointer to the corresponding source node, and stamp its real `startLine` / `startColumn` into the SARIF `region`. A pointer that does not resolve against the source falls back to the nearest existing ancestor (and, failing that, to file-level line 1) so `$ref`-heavy / multi-file specs are never silently mislocated. The change is confined to `action/postprocess.mjs`; the CLI's `packages/cli/src/formatters/sarif.ts` and the `sarifArtifactUri` logic (issues #200 / #208) are untouched.

## Out of Scope

- **URL inputs.** A URL'd spec does not exist in the consumer's repository checkout, so code-scanning has no file to anchor a line against — a computed line would point into a phantom file. URL inputs keep the `startLine: 1` fallback; mapping them would be a no-op for the Security tab.
- **Changing `artifactLocation.uri`.** The repo-relative artifact URI (`sarifArtifactUri`, issues #200 / #208) is correct and stays exactly as-is. This phase only fills in the `region`.
- **Moving the logic into the CLI's `sarif.ts` or adding a CLI `--format sarif` source-aware mode.** The pointer→line mapping lives in the action helper (option A — the simplest path). `formatSarif` stays a pure, sync, source-agnostic projection that emits logical locations only. If a second consumer ever needs source mapping, it gets extracted then (YAGNI).
- **`endLine` / `endColumn` regions and inline PR-diff annotations.** This phase stamps the start position only. apidom exposes `endLine`/`endCharacter`, but a start position is sufficient for code-scanning to place a finding; end ranges are a later refinement.
- **Mapping pointers against the *bundled* document.** The engine's pointers index the Redocly-bundled spec the container builds and discards. We map against the user's *source* entry document instead (what the `artifactLocation.uri` actually names), using strip-fallback to reconcile the two — see Decisions.

## Decisions

### Implement entirely in `action/postprocess.mjs` `addPhysicalLocations` (option A)

The whole mapping lives in the action helper, made `async` so it can parse the source once before stamping results. The alternatives were considered and rejected: putting the resolver in the CLI's `sarif.ts` (forces `formatSarif` async or adds a second export, and `formatSarif` has no source to map against — it is a pure projection of the captured result); or parsing in `action.yml` and passing nodes in (relocates the async *and* smears the apidom logic across the boundary). Keeping it in `addPhysicalLocations` is the smallest, most surgical change — `sarif.ts`, the `./formatters/sarif` export contract, and the existing CLI tests are all untouched. The trade-off accepted: the resolver lives in a `.mjs` helper, so it is covered by the existing black-box subprocess test suite (`packages/cli/test/action/postprocess.test.ts`) rather than a pure-unit suite — consistent with how every other `addPhysicalLocations` / gate / filter behavior in that file is already tested.

### Map against the source entry document, with strip-last-segment fallback

The engine's diagnostic pointers (`data.path` / `data.paths[]`, surfaced into each SARIF result as `logicalLocations[0].fullyQualifiedName`) are valid against the *bundled* spec, not necessarily the user's source. A bundled pointer that dives into a node that lives behind a `$ref` in the source will not resolve against the source document. So the resolver walks the pointer with `evaluate`, and on a resolution failure **pops the last segment and retries**, repeating until a node resolves — landing on the nearest existing ancestor (e.g. the operation that owns a `$ref`'d response). This is the issue's "do not silently mislocate" requirement: the finding lands on a real, honest location in the source, never on a fabricated line. A pointer that resolves to nothing even at its root, or an empty pointer, keeps the file-level (line 1) fallback.

We parse with `parse` (resolve refs **off**), not `dereference`. The pointer is meant to be located in the *entry* document the consumer committed; dereferencing would inline external files and change line numbers to nodes that do not exist in the source the `artifactLocation.uri` names.

### SpecLynx apidom with `sourceMap` and a `fileAllowList`

Source positions come from `@speclynx/apidom-reference`'s `parse()` with `parse.parserOpts.sourceMap: true`, then `@speclynx/apidom-json-pointer`'s `evaluate()`, which returns an ApiDOM node exposing 0-based `startLine` / `startCharacter`. Two apidom specifics are load-bearing:

- **`fileAllowList` is mandatory for local files.** apidom's `FileResolver` rejects *every* local-file read unless a `fileAllowList` (globs or regexes) is supplied — without it, `parse('file://…/openapi.yaml')` throws `UnmatchedResolverError`. We pass `resolve.resolverOpts.fileAllowList` matching the spec extensions (`.yaml` / `.yml` / `.json`). This is a deliberate apidom security default, not a bug.
- **0-based → 1-based.** apidom positions are 0-based; SARIF `region.startLine` / `startColumn` are 1-based, so the resolver adds 1. `startCharacter` is a UTF-16 code-unit offset, which matches SARIF's default `utf-16` column kind — no transcoding needed.

### Graceful degradation is the contract, not an edge case

The resolver must never make the action worse than the line-1 stopgap. Any failure — input is a URL, the file is unreadable or absent, apidom throws, the pointer resolves to nothing, `sourceMap` data is missing — falls back to `startLine: 1` for that result (or all results). The existing black-box tests already pass `INPUT: './openapi.yaml'` with no such file on disk (today `addPhysicalLocations` uses the value only as the `artifactLocation.uri` string); after this change those inputs must still produce line-1 SARIF without throwing. Parse the source **once** at the top of `addPhysicalLocations`; if that parse fails, every result takes the line-1 fallback and the action proceeds.

## Constraints

- **Score once, format many** (`docs/architecture.md`; `specs/roadmap.md` Phase 19). The mapping must not trigger a second `score` / `docker run`. Reading and parsing the already-on-disk source file is not a re-score — the single captured `report.json` remains the only engine pass.
- **`artifactLocation.uri` (#200 / #208) is correct and frozen.** `sarifArtifactUri` and the repo-relative URI it produces are not touched; this phase only fills `region`.
- **`formatSarif` stays a pure, source-agnostic projection** (`specs/tech-stack.md`; `docs/architecture.md` §7 — formatters are read-only projections of the engine result). Source mapping is an action-helper concern, not a formatter concern.
- **The action's `npm install` anchor (`action/package.json`) is load-bearing** (`.claude/CLAUDE.md`, `action/` notes). New apidom dependencies are added to `action/package.json` and the action's install step so they resolve in a fresh `source: "./"` checkout, not only in the workspace self-test.
- **TypeScript / JS style** (`.claude/rules/typescript-code-style.md`): the test additions are `.ts` with `.ts` import suffixes and no mocking; `postprocess.mjs` matches the existing helper's plain-ESM style.
- **CLI surface is unchanged**, so no `README` `## CLI reference` / `SKILL.md` flag-table sync is required (`.claude/rules/cli-readme-sync.md`); the action's documented behavior is what changes.

## Context

This closes issue #191, the known limitation Phase 19 shipped with: SARIF findings ingest and link to the right file but all point at line 1. The fix sharpens an already-working feature — findings in the Security tab land on the line that actually triggered the diagnostic. It serves the **CI integrators** and **OpenAPI spec authors** personas in `specs/mission.md`: an author reviewing a PR sees each JAIRF finding annotated on the offending line, not stacked on line 1.

SpecLynx apidom is already in the engine's orbit (the `speclynx-validator` is one of the diagnostic sources, and the engine spawns Speclynx via `npx`), so adopting its parser for source-position mapping is consistent with the stack. The approach was validated against a live apidom prototype (parse with `sourceMap` + `fileAllowList` → `evaluate` with strip-fallback) before this spec.

`docs/architecture.md` (the action's SARIF section) and `.claude/CLAUDE.md` (the `action/` description) both describe the line-1 stopgap and reference issue #191; both are updated to describe real line mapping when this ships.

## Stakeholder Notes

- **OpenAPI spec authors** — want each finding annotated on the line that caused it when reviewing a PR's Security tab, not all findings collapsed onto line 1. Satisfied by the pointer→source-line mapping with honest ancestor fallback.
- **CI integrators** — want the action's Security-tab output to be trustworthy enough to triage from. Satisfied without any new action input or configuration — the improvement is automatic for local-file inputs.
