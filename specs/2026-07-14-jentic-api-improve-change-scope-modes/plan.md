# Phase 23 Plan — jentic-api-improve Change-Scope Modes

## Group 1 — Skill core: mode switch + oasdiff in `SKILL.md`

1. Declare the `mode` option in `skills/jentic-api-improve/SKILL.md`: extend the `argument-hint` frontmatter (line 10) and the Overview input handling (line ~18) to accept a named `mode` with values `non-breaking` (default), `summary-description`, `full`; state explicitly that an omitted mode behaves exactly as today.
2. Add `Bash(oasdiff *)` to the `allowed-tools` frontmatter (line 11) and to both `settings.local.json` pre-approval snippets (lines ~51-53 and ~72-74); add the `oasdiff` install command to the `compatibility` frontmatter line (line 9).
3. Add a `### oasdiff (breaking-change detection)` subsection under `## CLI Tools` (following the per-tool template at lines 174-208): install channel (Go install / Homebrew / release binary / `docker run tufin/oasdiff`), the canonical single-command invocation (`oasdiff breaking <base> <revision> --format json -o <file>`, base = read-only `$0`, revision = placed improved spec), and its exit-code contract (non-zero / non-empty breaking list = break found).
4. Define the per-mode behavior in the `## Improvements are non-breaking` / `## Constraints` sections (lines 294-322, 626-643): `summary-description` restricts edits to `description_suggestion`/`summary_suggestion` from `POOR_OPERATION_SEMANTICS` diagnostics only; `non-breaking` keeps the current strictly-additive MUST-NOT list; `full` relaxes the MUST-NOT list to permit breaking edits but is still bound by the no-dimension-regression guard.
5. Wire `summary-description`'s hard LLM requirement into the exit-8 handling (lines 218, 292): in this mode a scorecard LLM-failure (exit 8) stops the run with a report and does NOT offer the up-front `--with-llm` drop.
6. Set the iteration policy per mode at the loop cap (line 536): `non-breaking`/`summary-description` keep the max-2-then-ask cap; `full` runs more iterations by default (state the concrete higher cap and the same "ask the user before exceeding" behavior).
7. Add the `oasdiff breaking` check to the post-placement verify sequence (alongside verify step G, lines 441-447 / 562): run after final placement comparing `$0` original vs the placed improved spec; report the verdict in all modes; fail the run in `non-breaking`/`summary-description` on a detected break; report-only in `full`.
8. Confirm the no-dimension-regression guard (step 7, line 547) is stated as applying in all three modes including `full`, and that `full`'s breaking edits are only shipped when no dimension drops below baseline.
9. Add a `Change-scope mode:` field to the subagent brief template (lines 493-522) so the selected mode threads to the spawned subagent, and update the placeholder-fill instructions (lines 746-758) accordingly.

## Group 2 — Mirror into the agent + add `references/oasdiff.md`

10. Mirror every Group 1 behavioral rule into `agents/jentic-api-improve.md`: add `Bash(oasdiff *)` to `allowed-tools` (line 6), the per-mode constraint relaxation/restriction (`## Constraints`, lines 123-129), the per-mode iteration cap (line 42), and the `oasdiff` check in the final-placement verify step (line 68). Keep the skill as the single source for Forbidden Shell Idioms (agent lines 15-17) — do not duplicate that list.
11. Create `skills/jentic-api-improve/references/oasdiff.md` modeled on `references/jentic-apitools-cli.md`: install, the `oasdiff breaking` invocation, machine-readable output shape, and an exit-code → per-mode reaction table (fail in `non-breaking`/`summary-description`, report in `full`).
12. Update `skills/jentic-api-improve/references/jentic-api-scorecard.md` only if the `summary-description` "fail if LLM unavailable" rule needs restating against the scorecard exit-code table (line ~106) — otherwise leave untouched.

## Group 3 — Documentation sync

13. Update the README `### jentic-api-improve` section (lines 305-360): document the three modes and the default, add `oasdiff` to the prerequisite install block (lines 320-325), and refresh the one-line skills-table row (line 257) and TOC anchor (line 31) if wording changes. Keep the H3 heading text `jentic-api-improve` unchanged so `docs/publish-config.json` extraction still resolves.
14. Update `docs/architecture.md` §4: correct the references-tree description (line 141) from "six-file" to "seven-file" and list `oasdiff` among the improve skill's orchestrated tools; note the `mode` switch in the improve-skill layout prose (lines 139-143).
15. Update `.claude/CLAUDE.md` (the `skills/` bullet, line ~16): change the improve skill's "six-file `references/` tree" to seven files, add `oasdiff` to its orchestrated-tooling list, and mention the three modes.
16. Update the `api-improve` plugin description in `.claude-plugin/marketplace.json` (line ~18) so it no longer implies improvements are exclusively non-breaking (acknowledge `full` mode's opt-in breaking changes).
17. Add a one-line note to `docs/improve-cost-benchmark.md` that `full` mode's extra iterations increase score-quota spend beyond the benchmarked two-iteration loop.
18. Append ` ✅` (a single space followed by the U+2705 checkmark) to the `## Phase 23 — jentic-api-improve Change-Scope Modes` heading in `specs/roadmap.md`, leaving the rest of the block untouched, per the lifecycle rule.

## Group 4 — Verify

19. `git diff --name-only main...HEAD` lists only files under `skills/jentic-api-improve/`, `agents/jentic-api-improve.md`, `README.md`, `docs/architecture.md`, `docs/improve-cost-benchmark.md`, `.claude/CLAUDE.md`, `.claude-plugin/marketplace.json`, and `specs/2026-07-14-jentic-api-improve-change-scope-modes/` — no `docker/` or `packages/` code changed.
20. `python -m pip install "git+https://github.com/NVIDIA/SkillSpector.git@cff7ecc4f2881d9e23ea4bb801a6353e1dbe39e6"` then `skillspector scan skills/jentic-api-improve/ --no-llm --format json --output /tmp/report.json` and `python -c "import json;print(json.load(open('/tmp/report.json'))['risk_assessment']['recommendation'])"` prints `SAFE`.
21. `npm run docs:extract:dry-run` exits 0 (README `### jentic-api-improve` heading still resolves against `docs/publish-config.json`).
22. `grep -F "## Phase 23 — jentic-api-improve Change-Scope Modes ✅" specs/roadmap.md` exits 0 (roadmap-completion marker present).
23. Doc-consistency check: the three mode names, the default (`non-breaking`), and the `oasdiff` prerequisite appear consistently in `SKILL.md`, `agents/jentic-api-improve.md`, `README.md`, `docs/architecture.md`, and `.claude/CLAUDE.md` (no file omits a mode or names one differently).
24. Behavioral matrix (manual, per `validation.md`): drive the skill against a fixture spec once per mode and confirm — `summary-description` applies only summary/description edits and stops if LLM is unavailable; `non-breaking` stays additive and fails on a detected break; `full` runs more iterations, may make breaking edits, and reports (does not fail) on a break — with the no-dimension-regression guard holding in every mode.
