# Phase 19 Retrospective Draft — GitHub Action for CI Scoring

> **DRAFT** — written by `/sdd-implement-spec` from tracked implementation deviations. Promote to `retrospective.md` (edit + rename) or delete before merge if nothing here is worth capturing.

## Deviations from the spec

- `plan.md` Group 1 / `requirements.md` "CLI subpath exports" assumed the published CLI already (or would shortly) carry the `./sarif` and `./markdown` exports. In practice the published `1.7.0` CLI's `exports` map has only `"."` — the new subpaths ship *with this PR*, so the action's resolved CLI version becomes correct only after a post-merge release publishes it. Rather than hardcode (and have to bump) a default version, `cli-version` is left blank and resolved at runtime from the action's own `packages/cli/package.json` (lerna-bumped every release), so it always matches the action ref the consumer pinned. A chicken-and-egg the spec did not surface.
- `plan.md` Group 2 listed nine action inputs. Implementation added three more: `cli-version` (load-bearing for the CLI-version=image-tag invariant; defaults to the version resolved from the action's own `packages/cli/package.json`), `artifact-name` (because `actions/upload-artifact@v4` rejects duplicate artifact names within a run, which the two-invocation self-test in validation.md §4 would otherwise hit), and `github-token` (defaults to the workflow token; lets advanced setups supply an App/PAT or a base-context `workflow_run` token to upload fork-PR findings the read-only default cannot).
- `plan.md` task 6 said "document the choice [of helper library access] in this plan once made," but `plan.md` is read-only during implementation. The decision (option (a): `npm install` adjacent to the helper; option (b) pre-bundling rejected because HTML `format()` reads a sibling `dist/app/index.html` at runtime) was recorded in `action.yml`/`action/postprocess.mjs` comments and `.claude/CLAUDE.md` instead.
- `plan.md` Group 2 implied the library install runs in the composite step's default cwd. The helper actually resolves imports from `$GITHUB_ACTION_PATH/action`, so the resolution check and `npm install` had to be moved into that directory or a real consumer's install would land where the helper does not look.
- The user redirected the `--bundle`-for-the-action question: rather than an issue (filed then closed as #189), it was recorded as a "Later Phases" bullet in `specs/roadmap.md`. Not a spec gap so much as a scope decision made during implementation.
- Pre-push review found a script-injection blocker not anticipated by the spec: `${{ inputs.input }}` and engine-derived `${{ ... gate-reasons }}` interpolated into `run:` bash. Fixed by routing all inputs through `env:`.
- The first PR CI run failed because the self-test asserted `$GITHUB_STEP_SUMMARY`, which is a *per-step* file — a later step cannot read what the action's postprocess step appended. The helper now also writes Markdown to a real `scorecard.md` file and the self-test asserts that. The spec's validation.md §4 ("`$GITHUB_STEP_SUMMARY` was written") implied a cross-step check that GitHub's model does not support.
- The spec's "logical locations only" assumption (`requirements.md` Out of Scope; Phase 17) was wrong about consequences: GitHub Code Scanning **rejects** logical-only SARIF (`expected a physical location`), so the Security-tab deliverable did not function at all — not merely "no inline annotations." The action helper now attaches a minimal file-level `physicalLocation` (line 1) so results ingest; precise pointer→line mapping is tracked in #191. This was caught only by the real upload in CI, not by local schema validation.
- The SARIF upload permission guard initially probed repo push access (`.permissions.push`), the wrong signal for the `GITHUB_TOKEN`'s `security-events` scope; it wrongly skipped the upload even when granted. Corrected to key off the fork-PR flag.
- `plan.md` task 12 specified the README example as `uses: jentic/jentic-api-scorecard@v<major>`, implying a rolling major tag. That defeats the project's reproducibility invariant: a new release can ship a new scoring engine that scores the same document differently, so a floating `@v1` would silently change a gated build's verdict with no spec change. The docs pin a concrete `vX.Y.Z` / SHA and explain why; there is intentionally no maintained major alias.

## Root cause

[ONE_OR_TWO_SHORT_PARAGRAPHS — why the spec missed this. Typical causes: missing repo context during scaffolding; an adjacent change landed after the spec was written; an assumption in the roadmap phase turned out to be wrong; a load-bearing constraint was not surfaced in `tech-stack.md`.]

## Lesson for future specs

[LESSON_1 — actionable guidance for `/sdd-new-spec` and `/sdd-new-phase`, specific enough to apply (not generic advice).]

## Promotion candidate

no — update if this lesson names a load-bearing invariant for `specs/tech-stack.md`.
