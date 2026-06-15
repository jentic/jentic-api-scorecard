# Phase 18 Retrospective — Markdown formatter (`--format markdown`)

## Deviations from the spec

- `plan.md` Group 4 (tests) did not anticipate `packages/cli/test/format.test.ts`, an existing surface-lock test that pins the exact `Format` record and `FORMATS` members; registering `markdown` (Group 1) necessarily broke it, so the Group 4 commit also updated that test to include `markdown`.
- `plan.md` Group 5 task 16 prescribed a standalone `## Markdown report` README subsection (sibling to `## HTML report`); on maintainer steer during implementation the README change was reduced to a mention in the `-f, --format` choices table row only, with no standalone section or TOC entry. The SKILL.md one-line format note was kept. (Taste call, not a spec gap — no transferable lesson.)

## Root cause

The CLI represents fixed choice sets (`Format`, `DetailLevel`, `ExitCode`) as `as const` records, and each has a dedicated "surface-lock" test that `deep.equal`s the whole record and asserts `FORMATS` membership — a guard against a value being silently renamed or dropped. That guard is, by design, broken by *any* legitimate addition to the set. `plan.md` scaffolded the test group around the new formatter's own test file and didn't enumerate the existing locks the Group 1 change would trip, so the broken assertion only surfaced when the suite ran. It was trivial to fix (extend the expected set), but it's a predictable miss that recurs every time a phase extends one of these enums.

## Lesson for future specs

- When a phase adds a value to an `as const` choice set (`Format`, `DetailLevel`, `ExitCode`, …), `plan.md`'s test group must include an explicit task to update that set's surface-lock test (`test/format.test.ts` for `Format`, and the equivalents). Treat the lock update as part of the same group that registers the value, not a discovery during Verify. Phase 17 (SARIF) extends `Format` the same way and will hit the identical `format.test.ts` lock.

## Promotion candidate

yes — the surface-lock-test-per-`as const`-set pairing is a load-bearing testing invariant of `packages/cli/`; consider noting it in `specs/tech-stack.md` (Testing section) so the obligation to update the lock travels with every enum extension, not just this phase.
