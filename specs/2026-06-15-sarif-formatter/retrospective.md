# Phase 17 Retrospective — SARIF formatter (`--format sarif`)

## Deviations from the spec

- `plan.md` task 2 + `validation.md` §3 mandated refusing SARIF to an interactive TTY (grouped with `--format html`); during implementation the decision was reversed to **allow** it, since SARIF is plain JSON text and is TTY-safe exactly like `--format json`. Both spec sections and the `validate.ts` guard were updated to allow SARIF to a TTY.
- `plan.md` task 11 predicted ajv would throw at compile time on a JSON Schema draft mismatch (draft-04/draft-07 vs ajv's 2020-12 default) and might need `ajv-draft-04`. The schemastore SARIF 2.1.0 schema actually declares draft-07, which ajv v8's default `Ajv` class supports natively, so only `strict: false` + `logger: false` were needed; the planned `ajv-formats` dependency proved unnecessary and was dropped.
- `plan.md` Group 2 (tasks 5–6) described each SARIF location carrying a singular `logicalLocation` object; the SARIF 2.1.0 schema requires a `logicalLocations` **array** on a location. The schema-validation test caught this, and the encoder was corrected (one location per pointer, each with a single-element `logicalLocations` array).
- `plan.md` task 1 was written before Phase 18 shipped, so it described the `--format` choices as `pretty|json|html|sarif`; the live code already had `markdown`, so SARIF became the fifth format (`pretty|json|html|markdown|sarif`).

## Root cause

The TTY-refusal deviation is the only one rooted in a spec design choice rather than an estimate. The spec grouped SARIF with `--format html` for TTY-refusal by reasoning from *intent* ("SARIF is a machine-ingestion artifact for CI, so don't dump it in a terminal") rather than from *output medium*. But the existing TTY guard exists to protect against a concrete failure — a full HTML document garbling or flooding an interactive terminal — and SARIF, being plain JSON text, shares no such failure mode with HTML; it shares one with `--format json`, which the codebase deliberately leaves TTY-printable. The spec author reached for "is this for humans or machines?" when the load-bearing question was "is this output safe to render in a terminal?"

The other three deviations are ordinary forecasting error: the schema-draft and `logicalLocation`-shape items were good-faith predictions made without compiling against the real ajv version or validating against the real SARIF schema (the schema-validation test the spec itself mandated is exactly what surfaced the array-shape bug — the safety net worked as designed), and the format-count drift is a stale reference from a spec written before an adjacent phase merged.

## Lesson for future specs

- When a spec adds a new `--format` value, decide its TTY-refusal behavior from the **output medium**, not the use case: refuse only formats that are unsafe to render in an interactive terminal (a full rendered document like HTML). Plain-text/JSON formats stay TTY-printable like `json` and `markdown`, even when their primary consumer is CI. State the medium-based rationale in the spec so the implementer doesn't re-derive it.
- A spec that pins a transitive devDependency's behavior (ajv draft handling, a schema's declared draft) should frame it as "verify X at implementation time" rather than asserting the exact failure mode and remedy — the prediction churns when it's wrong, and the schema-validation gate already catches real mismatches.

## Promotion candidate

no — the TTY-medium lesson is an empirical authoring reminder for `specs/lessons.md`, not a load-bearing invariant for `specs/tech-stack.md`.
