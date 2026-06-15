# Phase 17 Retrospective Draft — SARIF formatter (`--format sarif`)

> **DRAFT** — written by `/sdd-implement-spec` from tracked implementation deviations. Promote to `retrospective.md` (edit + rename) or delete before merge if nothing here is worth capturing.

## Deviations from the spec

- `plan.md` task 2 + `validation.md` §3 mandated refusing SARIF to an interactive TTY (grouped with `--format html`); during implementation the user directed allowing it, since SARIF is plain JSON text and is TTY-safe exactly like `--format json`. Both spec sections and the `validate.ts` guard were updated to allow SARIF to a TTY.
- `plan.md` task 11 predicted ajv would throw at compile time on a JSON Schema draft mismatch (draft-04/draft-07 vs ajv's 2020-12 default) and might need `ajv-draft-04`. The schemastore SARIF 2.1.0 schema actually declares draft-07, which ajv v8's default `Ajv` class supports natively, so only `strict: false` + `logger: false` were needed; the planned `ajv-formats` dependency proved unnecessary and was dropped.
- `plan.md` Group 2 (tasks 5–6) described each SARIF location carrying a singular `logicalLocation` object; the SARIF 2.1.0 schema requires a `logicalLocations` **array** on a location. The schema-validation test caught this, and the encoder was corrected (one location per pointer, each with a single-element `logicalLocations` array).
- `plan.md` task 1 was written before Phase 18 shipped, so it described the `--format` choices as `pretty|json|html|sarif`; the live code already had `markdown`, so SARIF became the fifth format (`pretty|json|html|markdown|sarif`).

## Root cause

[ONE_OR_TWO_SHORT_PARAGRAPHS — why the spec missed this. Typical causes: missing repo context during scaffolding; an adjacent change landed after the spec was written; an assumption in the roadmap phase turned out to be wrong; a load-bearing constraint was not surfaced in `tech-stack.md`.]

## Lesson for future specs

[LESSON_1 — actionable guidance for `/sdd-new-spec` and `/sdd-new-phase`, specific enough to apply (not generic advice).]

## Promotion candidate

no — update if this lesson names a load-bearing invariant for `specs/tech-stack.md`.
