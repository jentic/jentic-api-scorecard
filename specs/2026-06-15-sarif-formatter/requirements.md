# Phase 17 Requirements — SARIF formatter (`--format sarif`)

## Scope

Add `sarif` as a fourth value to the CLI's `-f, --format` flag, alongside `pretty`, `json`, and `html`. When selected, the CLI encodes the engine's `diagnostics[]` array as a schema-valid [SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) document — the format GitHub code-scanning ingests to populate the repository Security tab. Each diagnostic becomes one SARIF `result`; each distinct validator `source` becomes one SARIF run with its own `tool.driver`. Diagnostic severities map to SARIF levels, and the engine's JSON-Pointer paths become SARIF logical locations.

SARIF is a findings format, so it projects `diagnostics[]` only. The scorecard's score, dimensions, and signals have no place in a SARIF document and are deliberately excluded — they reach CI through other channels (`--format json`, and a future GitHub Action that gates on the score). Because `diagnostics[]` lives at the deepest `--detail` level, `--format sarif` always emits the full diagnostics regardless of the `--detail` flag; a conflicting explicit `--detail` produces a one-line stderr warning rather than a silently-empty document.

## Out of Scope

- The GitHub Action itself (a separate later roadmap phase). This phase ships only the `--format sarif` encoder the Action will consume.
- `physicalLocation` / line-and-column regions and inline PR-diff annotations. The engine emits JSON-Pointer paths against the bundled spec, not source line numbers, so locations are logical-only for now.
- A `tool.driver.rules[]` catalog. Results carry `ruleId` only; the engine provides no rule descriptions to populate a rule catalog.
- Severity filtering, findings caps, or any truncation. The encoder is faithful and uncapped; filtering/capping is integrator (Action) policy, not the encoder's job.
- `--min-score` / score-threshold gating and the `max-errors` / `max-warnings` count gates — all Action-phase concerns.

## Decisions

### `sarif` is a CLI formatter, not a separate package

The encoder lives in `packages/cli/src/formatters/sarif.ts` next to `json.ts` / `pretty.ts`, not in a standalone package like `formatter-html`. SARIF output is plain JSON with no React/Vite/bundler weight, so it needs no toolchain encapsulation — the reason `formatter-html` is separate does not apply. This makes SARIF reusable by anyone running the CLI (not only the future Action), and keeps the dispatch in `commands/score.ts` uniform.

### Force full diagnostics, warn on explicit `--detail` mismatch

SARIF reads `diagnostics[]`, which only survives at `--detail diagnostics`. Respecting a lower `--detail` would emit an empty SARIF file — worse than useless — so `--format sarif` forces full diagnostics regardless of `--detail`. To avoid a silent override (the footgun of "I passed `--detail summary` and it did nothing"), an *explicit* `--detail` other than `diagnostics` triggers a one-line stderr warning. The default `dimensions` does not warn — Commander's `getOptionValueSource('detail') === 'cli'` distinguishes an explicit flag from the default. This differs from `--format html`, which tolerates lower detail by rendering less; SARIF cannot render less and stay useful.

The warning is emitted up-front in `index.ts` — before `runScore` starts and therefore before any ora spinner — not mid-scoring. The spinner writes to `process.stderr` (`spinner.ts`), so a warning written to stderr while the spinner is live would garble the line. Emitting the warning in the same pre-flight slot as `validateScoreOptions` (no spinner active yet) keeps stderr clean. The warning is non-fatal — it informs and proceeds, unlike `validateScoreOptions`, which returns an error and exits.

### Severity 1–4 → SARIF level (error/warning/note)

The engine declares a 1–4 severity scale (confirmed via the `lint_results` signal's `metadata.provenance.diagnostics.severity: [1,2,3,4]`). The mapping is 1=`error`, 2=`warning`, 3=`note`, 4=`note`. SARIF has only three levels (`error`/`warning`/`note`, ignoring `none`), so the engine's hint (4) collapses into `note` alongside info (3). The CLI fixture exercises severities 1, 2, and 3.

### JSON-Pointer → `logicalLocation`, no-pointer → location-less result

The engine carries pointers in two fields whose shapes are messier than "one vs. many," so the encoding rule is explicit:

- **`data.path`** is a single pointer (an array of segments) and **`data.paths`** is an array of such pointers. In the current fixture **both keys are frequently present on the same diagnostic**, and either may be an **empty array (`[]`) meaning "no pointer."** So presence of a key is not enough — the encoder keys off *non-emptiness*.
- **Precedence:** if `data.paths` is a non-empty array, use it (one `logicalLocation` per pointer). Else if `data.path` is a non-empty array, use it (one location). Else (both empty or absent) emit **no `locations` key** — a valid location-less, file-level result. This makes `path: []` + non-empty `paths` (8 fixture diagnostics) resolve to the `paths` locations, and `path: []` + `paths: []` (or `paths` absent) resolve to no location.
- **Pointer → string encoding:** build each `fullyQualifiedName` as an **RFC 6901 JSON Pointer** — join segments with `/`, prefix with a leading `/`, and escape `~`→`~0` and `/`→`~1` *within* each segment. This is unambiguous even when a segment itself contains a slash (the fixture has `'/health'` and `'application/json'` segments, which a naïve `/`-join would render as a confusing `//health` / `application/json`). RFC 6901 is the SARIF-idiomatic pointer encoding and round-trips cleanly.

Resulting fixture breakdown (empty arrays treated as no-pointer): 12 single-location diagnostics, 8 plural-location, 14 location-less. This is well-formed SARIF that GitHub ingests; it lists in the Security tab without inline diff annotations (those need `physicalLocation` regions the engine does not provide).

### ruleId-only; no rules catalog

Each result sets `ruleId` to the diagnostic's `code`. The encoder does not build a `tool.driver.rules[]` catalog because the engine supplies no rule descriptions or help text — id-only rule entries would add code for marginal value. GitHub renders findings correctly from `ruleId` alone.

### One SARIF run per validator `source`

Diagnostics are grouped by their `source` field (`default-validator`, `redocly-validator`, `spectral-validator`, `speclynx-validator`, `loader`); each group becomes one `runs[]` entry with a matching `tool.driver.name`. This preserves the provenance the engine records and matches how multi-tool SARIF is conventionally structured.

### Validate output against the official SARIF schema in tests

Tests validate the emitted document against the official SARIF 2.1.0 JSON Schema via `ajv` (a new devDependency, plus the schema committed to the repo). This is a stronger guarantee than structural assertions and protects against silently-malformed SARIF that GitHub would reject. Per-field assertions (level mapping, location counts, run grouping) sit on top of the schema-validity gate. The emitted document's `$schema` points at `https://json.schemastore.org/sarif-2.1.0.json` (the URI GitHub code-scanning recognizes). One implementation gotcha: the SARIF schema declares an older JSON Schema draft than ajv v8's default (2020-12), so ajv must be configured for the schema's draft or compilation throws — see `plan.md` task 11.

## Constraints

- **Result JSON is engine-verbatim; formatters are read-only projections** (`specs/tech-stack.md`, `docs/architecture.md` §7). The SARIF encoder reads engine fields (`code`, `message`, `severity`, `source`, `data.path`/`data.paths`) without renaming or mutating the source result; it produces a *new* SARIF document rather than altering the scorecard.
- **Tolerate unknown / missing keys** (`docs/architecture.md` §7; engine signals are alpha and may drift). The encoder must not crash on a diagnostic missing `data`, `path`, or an unexpected `severity` — unknown severities fall back to a safe level and missing pointers yield location-less results.
- **Exit codes are public CLI contract** (`specs/tech-stack.md`). This phase adds a formatter only; it introduces no new exit code and does not change existing ones.
- **CLI surface changes require README + SKILL sync** (`.claude/rules/cli-readme-sync.md`). Adding `sarif` to `--format` is a public-surface change, so `README.md` `## CLI reference` and `skills/jentic-api-scorecard/SKILL.md` update in the same commit.
- **TypeScript style** (`.claude/rules/typescript-code-style.md`): `.ts` import suffixes, `as const` over enums (extend the existing `Format` record), strict-mode types, no mocking in tests.

## Context

This phase exists now because SARIF is the load-bearing prerequisite for a GitHub Action — the next planned integration that lets CI surface JAIRF findings in the Security tab while gating merges on the score. Sequencing SARIF as its own CLI capability (rather than burying the transform inside the Action) means any integrator can produce SARIF, and the Action becomes a thin wrapper that passes `--format sarif` to `github/codeql-action/upload-sarif`.

It directly serves the **CI integrators** secondary persona named in `specs/mission.md`: stable, machine-readable output and exit codes that make merge-gating trivial. The diagnostics-only projection and the score/findings split are explained in the Phase 17 body of `specs/roadmap.md`.

## Stakeholder Notes

- **CI integrators** — want JAIRF findings in the GitHub Security tab without bespoke transform code. Satisfied by a faithful `--format sarif` they can pipe straight to `upload-sarif`.
- **OpenAPI spec authors** — see actionable, per-pointer findings in their PRs' Security tab rather than only a headline score. Satisfied by the diagnostic→result mapping with logical locations.
