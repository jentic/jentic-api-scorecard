# Phase 18 Retrospective Draft — Markdown formatter (`--format markdown`)

> **DRAFT** — written by `/sdd-implement-spec` from tracked implementation deviations. Promote to `retrospective.md` (edit + rename) or delete before merge if nothing here is worth capturing.

## Deviations from the spec

- `plan.md` Group 4 (tests) did not anticipate `packages/cli/test/format.test.ts`, an existing surface-lock test that pins the exact `Format` record and `FORMATS` members; registering `markdown` (Group 1) necessarily broke it, so the Group 4 commit also updated that test to include `markdown`.
- `plan.md` Group 5 task 16 prescribed a standalone `## Markdown report` README subsection (sibling to `## HTML report`); on maintainer steer during implementation the README change was reduced to a mention in the `-f, --format` choices table row only, with no standalone section or TOC entry. The SKILL.md one-line format note was kept.

## Root cause

[ONE_OR_TWO_SHORT_PARAGRAPHS — why the spec missed this. Typical causes: missing repo context during scaffolding; an adjacent change landed after the spec was written; an assumption in the roadmap phase turned out to be wrong; a load-bearing constraint was not surfaced in `tech-stack.md`.]

## Lesson for future specs

- [LESSON_1 — actionable guidance for `/sdd-new-spec` and `/sdd-new-phase`, specific enough to apply (not generic advice).]

## Promotion candidate

no — update if this lesson names a load-bearing invariant for `specs/tech-stack.md`.
