# Phase 23 Validation — jentic-api-improve Change-Scope Modes

## Definition of Done

All of the following must be true before this branch is merged.

### 1. SkillSpector SAFE verdict

```
python -m pip install "git+https://github.com/NVIDIA/SkillSpector.git@cff7ecc4f2881d9e23ea4bb801a6353e1dbe39e6"
skillspector scan skills/jentic-api-improve/ --no-llm --format json --output /tmp/report.json
python -c "import json; print(json.load(open('/tmp/report.json'))['risk_assessment']['recommendation'])"
```

Prints `SAFE`. This mirrors the CI gate in `.github/workflows/skill-security.yml` (pinned commit `cff7ecc`, v2.1.4), which fails unless `risk_assessment.recommendation == "SAFE"`. The `skill-security.yml` job for `jentic-api-improve` must be green on the PR.

### 2. Docs extraction dry-run passes

```
npm run docs:extract:dry-run
```

Exits 0. Confirms the README `### jentic-api-improve` H3 heading still resolves against the `agent-improve-skill` page in `docs/publish-config.json` (extraction `process.exit(1)`s on a heading miss). If the README section was renamed, `docs/publish-config.json` must be updated in lockstep so this still exits 0.

### 3. Roadmap-completion marker present

```
grep -F "## Phase 23 — jentic-api-improve Change-Scope Modes ✅" specs/roadmap.md
```

Exits 0. The `## Phase 23 — …` heading ends with ` ✅` (single space + U+2705) and the rest of the block is unchanged.

### 4. No code trees touched

```
git diff --name-only main...HEAD
```

Every path is under `skills/jentic-api-improve/`, `agents/jentic-api-improve.md`, `README.md`, `docs/architecture.md`, `docs/improve-cost-benchmark.md`, `.claude/CLAUDE.md`, `.claude-plugin/marketplace.json`, or `specs/2026-07-14-jentic-api-improve-change-scope-modes/`. No file under `docker/` or `packages/` appears.

### 5. Mode surface documented consistently

The three mode names (`summary-description`, `non-breaking`, `full`), the default (`non-breaking`), and the `oasdiff` prerequisite appear consistently across `skills/jentic-api-improve/SKILL.md`, `agents/jentic-api-improve.md`, `README.md`, `docs/architecture.md`, and `.claude/CLAUDE.md`. No file omits a mode, names one differently, or contradicts the per-mode `oasdiff` fail/report behavior. `docs/architecture.md` and `.claude/CLAUDE.md` describe the references tree as seven files (was six) and list `oasdiff` among the orchestrated tools.

### 6. oasdiff invocation obeys the Forbidden Shell Idioms

The `oasdiff` invocation in `SKILL.md` (and any in the agent) is a single allowlisted `Bash(oasdiff *)` command writing machine-readable output via a flag/redirect — no `$(...)`, no compound `&&`/`;`/`|`, no heredoc — and `Bash(oasdiff *)` is present in `allowed-tools` in both `SKILL.md` and `agents/jentic-api-improve.md` and in both `settings.local.json` pre-approval snippets.

### 7. Behavioral matrix across the three modes (manual)

Drive the skill against a fixture spec (e.g. `packages/cli/test/fixtures/sample.yaml`) once per mode with `oasdiff` available (install via `go install github.com/oasdiff/oasdiff@latest` or `docker run --rm -v "$PWD:/specs" tufin/oasdiff breaking /specs/before.yaml /specs/after.yaml`). Confirm:

- `summary-description`: only `summary`/`description` fields are added/changed; the run stops and reports if the score CLI has no LLM (scorecard exit 8); a detected breaking change fails the run.
- `non-breaking` (default): edits stay strictly additive; a detected breaking change fails the run.
- `full`: more iterations run; breaking edits may appear; `oasdiff` reports the break but the run does not fail on it; the no-dimension-regression guard still holds (no JAIRF dimension below baseline in the shipped iteration).

Evidence (the improved specs, the `oasdiff` verdicts, and the per-mode pass/fail outcome) is attached to the PR. This is a required reviewer walkthrough, not a CI gate — the skill is agent-driven markdown and cannot be exercised by an automated suite.

## Not Required

- No unit / integration / e2e test suite for the skill — no pytest (`docker/tests/`) or mocha (`packages/cli/test/`, `packages/formatter-html/test/`) test touches `skills/` or the improve skill, and `.claude/rules/testing.md` exempts `docs/`/`.claude/`-only changes from test suites.
- No `cli-readme-sync.md` obligation — that rule is scoped to `packages/cli/src/*.ts`; this phase changes no CLI source and the improve skill has no README flag/mode table to mirror. Doc consistency is the manual check in item 5.
- No CI job for `oasdiff` — break detection is a runtime behavior of the agent-driven skill; item 7 is the manual verification.
- No packaging edits — the `prepack`/`postpack` `copyfiles` globs and `marketplace.json` directory references auto-include the new `references/oasdiff.md`; only text accuracy (item 5, plugin description) is checked.
- No changes to the scorecard CLI, the Docker runner, exit codes, or `docs/architecture.md` §5–§9.
