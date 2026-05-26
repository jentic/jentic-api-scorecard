## Phase 6 Retrospective Draft — JSON formatter (`--format json`)

> **DRAFT** — written by `/sdd-implement-spec` from tracked implementation deviations. Promote to `retrospective.md` (edit + rename) or delete before merge if nothing here is worth capturing.

## Deviations from the spec

- **Branch name collision.** Per the slug-derivation rule the natural branch name was `feature/json-formatter`, but that branch already existed locally and on origin from the spec-scaffolding PR (#50, since squash-merged). Implementation cut `feature/json-formatter-impl` instead. `requirements.md` and `plan.md` did not name a branch; this is process drift, not a spec miss.
- **User-requested test outside `plan.md`.** Mid-Phase-7 the user asked for an automated test that locks in the `score … --format json > out.json` redirect contract. `plan.md` task 9 enumerated four e2e cases (a–d); the spinner-stays-on-stderr assertion is a fifth, added inside the existing `default detail` describe to share the same docker spawn. The new test enforces `requirements.md:51`'s stdout/stderr-discipline constraint more directly, so it is spec-aligned even though it is not spec-listed.
- **`-o` recipe in §11 of `docs/architecture.md`.** Plan task 10 said "remove the `--format json -o report.json` line if present, since `-o` is Phase 8 (or annotate as Phase 8)." The first pass annotated; the post-review fix-up removed it. The disjunctive instruction in `plan.md` made both resolutions defensible — a stricter spec would have picked one.
- **JSON-parse fallback escalation.** `requirements.md` did not address the existing "warning + raw passthrough + exit 0" path in `score.ts:142-150` for the case where engine stdout is non-JSON. The pre-push review flagged that under `--format json` this produces an unparseable file with exit 0 — silently broken machine output. A fix-up commit escalated this branch to `ExitCode.ENGINE_FAILURE` (6) when `format === Format.JSON`. The branch has no automated coverage; tracked separately as issue #51.
- **Commit-scope granularity.** All four `feat` commits used scope `cli`. Reviewers noted that finer scopes (`feat(format)`, `feat(score)`, `feat(pretty)`) would read more usefully in the per-commit log. Left as-is — the squash-merge commit is what reaches `main` and is rewritten at merge time, so per-commit scope only matters for branch-archaeology.

## Root cause

[ONE_OR_TWO_SHORT_PARAGRAPHS — why the spec missed this. Typical causes: missing repo context during scaffolding; an adjacent change landed after the spec was written; an assumption in the roadmap phase turned out to be wrong; a load-bearing constraint was not surfaced in `tech-stack.md`.]

## Lesson for future specs

[LESSON_1 — actionable guidance for `/sdd-new-spec` and `/sdd-new-phase`, specific enough to apply (not generic advice). Example: "when a phase touches the gate allowlist, the spec must remind the implementer that local files always require a key, regardless of URL form".]

## Promotion candidate

no — update if this lesson names a load-bearing invariant for `specs/tech-stack.md`.
