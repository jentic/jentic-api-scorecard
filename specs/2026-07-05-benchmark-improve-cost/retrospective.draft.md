# Phase 22 Retrospective Draft — Benchmark jentic-api-improve Token Usage and Cost

> **DRAFT** — written by `/sdd-implement-spec` from tracked implementation deviations. Promote to `retrospective.md` (edit + rename) or delete before merge if nothing here is worth capturing.

## Deviations from the spec

- **Core engine-measurement approach superseded (post-merge).** The whole spec (`requirements.md` Decisions, `plan.md` Group 1, `validation.md` check 5) was built around a net-new man-in-the-middle proxy (`scripts/token-proxy.mjs`) to capture the scoring engine's `--with-llm` tokens, precisely because "the scorecard JSON does not expose token usage" (`requirements.md:22-23`). After the spec merged (PR #285), `jentic-apitools` PR #253 added a native `tokenUsage` field to the scorecard for `--with-llm` score operations, resolving `specs/roadmap.md:339`'s open question ("confirm whether the scorecard output already surfaces usage") to **yes**. A follow-up change (PR #286) therefore bumped the engine to `1.0.0a25`, set `report_token_usage` on the runner's `OASProcessConfiguration`, had the improve skill write an aggregated `token-usage.json` output artifact, reworked the benchmark harness to read that field, and **deleted the proxy entirely** (`scripts/token-proxy.mjs` + its eslint scope). The merged `requirements.md`/`plan.md`/`validation.md` remain as the immutable record of what shipped in #285; this retrospective is the record of the reversal. Net effect: simpler design, no proxy, no `PROXY_UPSTREAM_*` setup — the engine tokens now come from the tool itself.
- `plan.md` (footprint) / `validation.md` check 1 — the spec scoped the change to `scripts/` + `docs/` + `package.json` + `specs/roadmap.md`, but the lint gate required editing `eslint.config.js`: the repo globally ignores `**/*.js` / `**/*.mjs`, so `npx eslint scripts/…` reported "file ignored" (a no-op) rather than linting. A scoped config block (un-ignoring exactly `scripts/bench-improve.js` + `scripts/token-proxy.mjs` and giving them Node globals) was added so the gate is real. Scoped to those two files so the pre-existing, never-linted `extract-docs.js` was not retroactively pulled in.
- `plan.md` Group 5 — the real model×spec measurement was **not** performed (it needs Docker, a `JENTIC_API_KEY`, an authenticated `claude` CLI, and upstream LLM credentials, and spends real quota + budget). Per Group 5's explicit permission ("record a documented partial run and clearly mark unmeasured cells — never fabricate numbers"), the committed `docs/improve-cost-benchmark.md` was generated from an all-`null` data file and carries a "Not yet measured" banner with `—` placeholder cells. The renderer gained an unmeasured-aware banner path to support this.
- `plan.md` task 4 / `requirements.md` (input-spec set) — the spec targeted "2–3 more" OAK specs beyond the petstore anchor spanning low/mid/high baseline; the implementation pinned only the confirmed anchor petstore. Consistent with the unmeasured partial-run state (no baseline scores recorded yet), but the matrix is narrower than the target and should be widened when the real measurement is run.
- `validation.md` check 5 / `plan.md` tasks 3, 7 (found in pre-push review, fixed on-branch) — the first cut of `--dry-run` only printed static strings, so it did not exercise the proxy self-check or assemble the real env / `claude -p` plumbing the spec's Definition of Done requires. A fix-up commit rewired `--dry-run` to run the canned-upstream proxy self-check (asserting the tally) and to assemble+print the real per-cell plumbing. The Verify pass had initially been reported green on the strength of testing the proxy directly rather than through the dry-run path the spec mandates.

## Root cause

[ONE_OR_TWO_SHORT_PARAGRAPHS — why the spec missed this. Do not speculate; the human fills this in.]

## Lesson for future specs

[LESSON_1 — actionable guidance for `/sdd-new-spec` and `/sdd-new-phase`. Do not speculate; the human fills this in.]

## Promotion candidate

no — update if this lesson names a load-bearing invariant for `specs/tech-stack.md`.
