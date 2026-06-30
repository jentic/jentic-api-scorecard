# Phase 21 Retrospective Draft — Add `jentic-api-improve` skill and agent

> **DRAFT** — written by `/sdd-implement-spec` from tracked implementation deviations. Promote to `retrospective.md` (edit + rename) or delete before merge if nothing here is worth capturing.

## Deviations from the spec

- `validation.md` check 8 / `plan.md` task 19 (SkillSpector `SAFE` gate): the check could not be confirmed locally as `SAFE`. The locally-installed SkillSpector is v2.3.1, while CI pins v2.1.4 (SHA `cff7ecc`); v2.3.1 scores the skill `CAUTION` (37/100) on two HIGH "Tool Parameter Abuse" matches against the skill's own `shutil.rmtree('./.jentic-improve-work', ignore_errors=True)` temp-dir cleanup (SKILL.md:116 and :681) plus one MEDIUM "Session Persistence" match on the `allowed-tools` frontmatter — all pattern-match false positives (bounded hardcoded relative path, no user input, `ignore_errors=True`; the existing `jentic-api-scorecard` skill scores `SAFE` under the same v2.3.1). Installing the CI-pinned v2.1.4 to get the authoritative verdict was blocked by the auto-mode classifier (external git-URL install). Per the user's decision, the check was deferred to the CI `skill-security` job (v2.1.4), which `validation.md` check 8 explicitly accepts as satisfying the gate. The skill was NOT edited to pass the scan — `requirements.md` out-of-scope forbids weakening the skill, and Group 1 requires a verbatim port.

## Root cause

[ONE_OR_TWO_SHORT_PARAGRAPHS — why the spec missed this. Candidate: the spec assumed SkillSpector could be run locally to pre-confirm the gate, but did not account for (a) a local/CI version mismatch producing different verdicts, or (b) the auto-mode classifier blocking the external-git install of the pinned version. The deeper tension — a verbatim-port requirement plus a don't-game-the-gate requirement plus a SAFE-required gate — is only reconcilable if the scanner actually returns SAFE at the pinned version, which the spec took as given.]

## Lesson for future specs

[LESSON_1 — actionable guidance. Candidate: when a phase's validation depends on an external scanner pinned to a specific version in CI, the spec should state that the local pre-check is best-effort and the pinned CI job is authoritative, and should anticipate a version-skew false positive rather than asserting a local SAFE as a hard merge gate.]
[LESSON_2 — Candidate: porting a skill verbatim from a private repo can carry idioms (e.g. `shutil.rmtree`) that trip the public repo's security scanner; the spec should flag a scanner dry-run against the source as a pre-port step so any false-positive triage happens before, not during, implementation.]

## Promotion candidate

no — these are empirical reminders about scanner version-skew and verbatim-port triage, not a load-bearing invariant for `specs/tech-stack.md`. Update to `yes` only if scanner-pinning policy becomes a recurring constraint worth codifying.
