# Phase 19 Retrospective Draft — GitHub Action for CI Scoring

> **DRAFT** — written by `/sdd-implement-spec` from tracked implementation deviations. Promote to `retrospective.md` (edit + rename) or delete before merge if nothing here is worth capturing.

## Deviations from the spec

- `plan.md` Group 1 / `requirements.md` "CLI subpath exports" assumed the published CLI already (or would shortly) carry the `./sarif` and `./markdown` exports. In practice the published `1.7.0` CLI's `exports` map has only `"."` — the new subpaths ship *with this PR*, so the action's default `cli-version` had to be set to the not-yet-released `1.8.0` (the first release that will carry them), and the resolution becomes correct only after a post-merge release. A chicken-and-egg the spec did not surface.
- `plan.md` Group 2 listed nine action inputs. Implementation added two more: `cli-version` (load-bearing for the CLI-version=image-tag invariant and for pinning the exports-carrying release) and `artifact-name` (because `actions/upload-artifact@v4` rejects duplicate artifact names within a run, which the two-invocation self-test in validation.md §4 would otherwise hit).
- `plan.md` task 6 said "document the choice [of helper library access] in this plan once made," but `plan.md` is read-only during implementation. The decision (option (a): `npm install` adjacent to the helper; option (b) pre-bundling rejected because HTML `format()` reads a sibling `dist/app/index.html` at runtime) was recorded in `action.yml`/`action/postprocess.mjs` comments and `.claude/CLAUDE.md` instead.
- `plan.md` Group 2 implied the library install runs in the composite step's default cwd. The helper actually resolves imports from `$GITHUB_ACTION_PATH/action`, so the resolution check and `npm install` had to be moved into that directory or a real consumer's install would land where the helper does not look.
- The user redirected the `--bundle`-for-the-action question: rather than an issue (filed then closed as #189), it was recorded as a "Later Phases" bullet in `specs/roadmap.md`. Not a spec gap so much as a scope decision made during implementation.
- Pre-push review found a script-injection blocker not anticipated by the spec: `${{ inputs.input }}` and engine-derived `${{ ... gate-reasons }}` interpolated into `run:` bash. Fixed by routing all inputs through `env:`.

## Root cause

[ONE_OR_TWO_SHORT_PARAGRAPHS — why the spec missed this. Typical causes: missing repo context during scaffolding; an adjacent change landed after the spec was written; an assumption in the roadmap phase turned out to be wrong; a load-bearing constraint was not surfaced in `tech-stack.md`.]

## Lesson for future specs

[LESSON_1 — actionable guidance for `/sdd-new-spec` and `/sdd-new-phase`, specific enough to apply (not generic advice).]

## Promotion candidate

no — update if this lesson names a load-bearing invariant for `specs/tech-stack.md`.
