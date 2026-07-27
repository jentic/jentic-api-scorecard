# Phase 23 Requirements — jentic-api-improve Change-Scope Modes

## Scope

This phase adds a change-scope `mode` selector to the already-shipped `jentic-api-improve` skill (and its companion subagent) so a user can bound how far the skill is allowed to alter an OpenAPI document. Three modes ship: `summary-description` (apply only the LLM-sourced `summary`/`description` suggestions the scorecard surfaces), `non-breaking` (the current strictly-additive behavior — the default), and `full` (more iterations and a broader set of signals, permitting breaking edits, but only where no JAIRF dimension regresses below baseline). The work is entirely inside the markdown skill and agent plus their `references/` tree and the surrounding documentation — no `docker/` or `packages/` code changes.

Alongside the modes, every run gains an `oasdiff`-based breaking-change detection step that compares the original input against the final improved spec. The detection always runs and always reports its result. In `non-breaking` and `summary-description` modes a detected breaking change fails the run; in `full` mode it is reported but does not fail (breaking edits are expected there, bounded by the no-regression guard). `oasdiff` becomes a new user-installed orchestrated tool, documented the same way the skill already documents `jentic-openapi-tools`, `check-jsonschema`, and `jentic-apitools`.

## Out of Scope

- No changes to the scorecard CLI (`packages/cli/`) or the Python runner (`docker/`). The mode switch lives only in the markdown skill/agent; `docs/architecture.md` §5–§9 (CLI flags, auth, engine) are unaffected.
- No bundling or auto-installing of `oasdiff`. It is a user-installed prerequisite, invoked when present — consistent with the skill's "orchestrate user-installed tooling, never vendor it" model.
- No new automated test suite for the skill. Markdown skills have no unit tests; the automated gate stays SkillSpector, and mode/oasdiff behavior is validated manually (see `validation.md`).
- No change to the two-plugin `marketplace.json` structure, the tarball `prepack`/`postpack` packaging, or the `docs/publish-config.json` page mapping beyond keeping their text accurate (the `api-improve` plugin description is refreshed to acknowledge `full` mode).
- No relaxation of the `non-breaking` default or the `summary-description` guarantees — `full` is strictly opt-in.

## Decisions

### Full mode is aggressive but score-safe

`full` mode performs more iterations by default and pursues a broader set of improvement signals than `non-breaking`, and it is permitted to make breaking contract changes — but the existing "no dimension may drop below baseline" pre-ship guard (`SKILL.md` step 7, introduced in commit `b301395`) still applies in every mode. A breaking edit is therefore only shipped when it does not regress any JAIRF dimension; a breaking edit that drops a dimension is rejected exactly as an additive regression is today. This preserves most of the skill's safety while widening the edit surface, and it keeps a single guard rule across all three modes rather than forking the guard logic per mode. `oasdiff` runs report-only in `full` (breaking changes are expected and surfaced, not fatal).

### summary-description mode requires LLM and applies only summary/description suggestions

In `summary-description` mode the skill applies only the `description_suggestion` / `summary_suggestion` fields carried by the scorecard's `POOR_OPERATION_SEMANTICS` diagnostics, which exist only when the score runs with `--with-llm`. This mode therefore hard-requires an available LLM in the score CLI: if the scorecard returns the LLM-failure exit code (8), the run stops and reports rather than falling back to a no-LLM pass. This is a mode-specific hardening of the skill's existing exit-8 handling (today a stop-and-report with an optional up-front `--with-llm` drop); in this mode the drop is not offered, because the mode is defined entirely by LLM-sourced suggestions.

### mode is a named option, default non-breaking

`mode` is surfaced as a named option (parsed from the invocation / prompt), not a third positional argument, because the skill already uses `$0` (input) and `$1` (output dir) positionally and a third positional would collide with the output-dir slot semantics. When unspecified, `mode` defaults to `non-breaking` so existing invocations behave exactly as before. The exact surface (named flag vs. prompt-instruction convention) is settled in `plan.md`; the requirement is only that the default is non-breaking and that an omitted mode is indistinguishable from today's behavior.

### oasdiff is a user-installed Go binary

`oasdiff` (github.com/oasdiff/oasdiff) is a Go binary, unlike every current prerequisite which installs via `pipx`/`npx`. Its install channel (Go install, Homebrew, release binary, or `docker run tufin/oasdiff`) is documented in the skill's `compatibility` line, the `## CLI Tools` section, a new `references/oasdiff.md`, and the README prerequisite block. A new `Bash(oasdiff *)` entry is added to `allowed-tools` in both the skill and the agent (and to the two `settings.local.json` pre-approval snippets), and the invocation obeys the skill's Forbidden Shell Idioms (single allowlisted command, machine-readable output via a flag/redirect, no pipes or compound shell).

## Constraints

Load-bearing invariants this phase must preserve (from `specs/mission.md`, `specs/tech-stack.md`, `docs/architecture.md`, and the current skill):

- **Skills are markdown-only; they orchestrate user-installed tooling and never vendor or auto-install it** — `oasdiff` must follow the existing user-installed-prerequisite pattern (`docs/architecture.md` §4; `.claude/CLAUDE.md`).
- **`skills/` is the single canonical source consumed by three distribution paths** (TanStack Intent, Vercel `skills`, Claude Code marketplace) — every edit lands in the one tree; the tarball `prepack`/`postpack` glob auto-includes new `references/` files, so no packaging edit is needed.
- **SkillSpector `SAFE` gate must keep passing** — `skill-security.yml` globs `skills/*`, runs SkillSpector pinned at commit `cff7ecc` (v2.1.4), and fails unless `risk_assessment.recommendation == "SAFE"`. New shell in `SKILL.md` can flip the verdict, so the `oasdiff` invocation must respect the Forbidden Shell Idioms.
- **The default must stay non-breaking; the Overlay is documented as the non-breaking delta** — `full` mode is an explicit opt-in and must not weaken the `non-breaking`/`summary-description` guarantees.
- **The original input `$0` is read-only for the whole run** — `oasdiff` compares the read-only original against the placed improved spec; it must not mutate `$0`.
- **The no-regression guard ("no dimension may drop below baseline; ship the best clean iteration")** — retained in all three modes, including `full` (this is what makes `full` "score-safe").
- **Skill and agent are mirrored** — every loop/constraint rule exists verbatim in both `SKILL.md` and `agents/jentic-api-improve.md`; mode and oasdiff logic must land in both to avoid drift.

## Context

Phase 21 ported the `jentic-api-improve` skill into this repo as public OSS; Phase 22 benchmarked it across models and specs. Both established the skill as the second public consumer of the scorecard CLI and hardened its no-regression guard. This phase refines that shipped skill: today it runs exactly one behavior (strictly-additive, non-breaking, max two iterations), and users have no way to say "only touch summaries and descriptions" or "go further, I accept breaking changes." The mode switch gives users that control, and `oasdiff` gives every run an explicit, tool-verified breaking-change verdict rather than relying on the skill's self-imposed additive discipline alone.

The relevant design surface is `docs/architecture.md` §4 (the `skills/`/`agents/` layout, the two-plugin marketplace model, and the tarball packaging note) and the improve-skill README section (`### jentic-api-improve`), which the `docs/publish-config.json` `agent-improve-skill` page extracts into the docs site. `docs/improve-cost-benchmark.md` (Phase 22) assumes the standard two-iteration loop; `full` mode's extra iterations warrant a note there, since they multiply score-quota spend.

## Stakeholder Notes

- **OpenAPI spec authors/maintainers (primary persona)** — gain explicit control over how invasive the skill is: a light "polish the prose" pass (`summary-description`), the safe default (`non-breaking`), or an aggressive pass they knowingly accept breaking changes from (`full`), with an `oasdiff` verdict on every run.
- **CI integrators (secondary)** — the per-mode failure semantics (fail on break in `non-breaking`/`summary-description`) make the skill safe to wire into a gated pipeline where only non-breaking improvements may land automatically.
