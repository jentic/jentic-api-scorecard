# Phase 26 Retrospective — Dark Mode Support for Formatter HTML

## Deviations from the spec

- **`plan.md` task 19 — `injectDarkMode` export**: plan described adding the function
  without specifying its visibility; it was initially exported, then un-exported in a
  fix-up commit after the pre-push review found no consumer use-case for a public API
  on the `"."` entry.

- **`plan.md` task 18 — signal component coverage gap**: four components were not
  fully covered by the explicit list in task 18: `SpecValidityMetadata` (border class),
  `LintResultsMetadata` (severity count spans), and the success boxes in
  `StructuralIntegrityMetadata` and `DescriptiveRichnessMetadata` retained hard-coded
  light-mode colour classes. Caught by the pre-push coverage reviewer.

- **`plan.md` task 19 — dark mode script robustness**: plan described the IIFE behaviour
  but did not specify error handling. `localStorage` calls gained try/catch guards
  (throws `SecurityError` in private browsing) and `matchMedia` got a `typeof` existence
  check after a robustness review during implementation.

- **`plan.md` task 22 — toggle button assertion**: spec said assert `id="dark-mode-toggle"`;
  the button is created dynamically via `btn.id = ...`, so the static HTML string
  `id="dark-mode-toggle"` never appears in the output. Assertion adjusted to
  `'dark-mode-toggle'` string presence.

- **`plan.md` task 23 — README variable table incomplete**: spec said document `--sc-*`
  variables; the `--score-color-*` variables (used by `CircularProgress`, `GradeBadge`,
  and signal border accents) were omitted. Added in the fix-up commit alongside Tailwind
  v4 `@custom-variant` guidance that the original README lacked.

## Root cause

1. Implicit scope assumptions in task wording

Task 18 said "apply CSS variable substitution and Jentic-aligned dark severity classes to the signal components" and listed 8 by name. The list was drawn from the components that had the most obvious surface-color usage. Three
components (SpecValidityMetadata, StructuralIntegrityMetadata, DescriptiveRichnessMetadata) had smaller, contextual colour uses — success boxes, a single border class — that weren't front-of-mind when the spec was scaffolded.
LintResultsMetadata's severity count spans were inline <span> elements rather than container backgrounds, a different pattern from everything else, so they weren't caught by the same mental sweep.

The root cause: the spec was written top-down from "what changes most visibly" rather than bottom-up from a full grep of hard-coded colour classes. A grep -r "text-gray\|bg-white\|border-gray" pass before writing task 18 would have
caught all of them.

2. Visibility decisions left implicit

The plan said "add injectDarkMode(html: string): string function" — it described the signature and behaviour, but said nothing about whether to export it. The default instinct when you write a named, well-typed function is to export it.
  The question of whether a consumer would ever call it directly wasn't asked during spec scaffolding, only during review.

3. Test assertion written against intent rather than implementation

The spec said assert id="dark-mode-toggle" — that's the intended DOM outcome. But the button is assembled in JavaScript (btn.id = 'dark-mode-toggle'), not rendered as static HTML. The spec author checked "does the toggle button exist"
conceptually, without asking "does id=... appear as a literal string in the HTML document the test receives." A quick look at the script during spec writing would have surfaced the distinction.


All three come from the same place: the spec was scaffolded before the implementation existed, so it described intended outcomes without tracing through how those outcomes would actually be produced. The closer a task gets to
implementation detail — exact class lists, function visibility, how a test assertion maps to output bytes — the more the spec needs to be grounded in the actual code, not just the goal.

## Lesson for future specs

- When a phase task says "apply dark mode to signal components", enumerate the full list
  of components explicitly in the plan rather than referencing a category. The coverage
  gap in this phase (four components partially missed) came from an implicit assumption
  that all components under `signals/` were covered when only the named subset was
  checked.

- When a plan task adds a new internal function, explicitly state whether it should be
  exported. The default instinct is to export for testability; the right answer depends
  on whether there is a genuine consumer use-case. Stating it in the plan avoids a
  fix-up commit.

- When speccing a `format.test.ts` assertion for dynamically-created DOM content, verify
  whether the content is static HTML (assertable as a string) or runtime JavaScript
  (assertable only as a script source substring). The two differ in what string to search
  for.

## Promotion candidate

No — these are empirical reminders for spec scaffolding, not load-bearing invariants for
`specs/tech-stack.md`.
