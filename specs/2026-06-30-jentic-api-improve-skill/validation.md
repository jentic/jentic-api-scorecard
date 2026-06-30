# Phase 21 Validation — Add `jentic-api-improve` skill and agent

## Definition of Done

All of the following must be true before this branch is merged.

### 1. Skill and agent are on disk, verbatim

```
find skills/jentic-api-improve agents/jentic-api-improve.md -type f | sort
```

Lists exactly: `agents/jentic-api-improve.md`, `skills/jentic-api-improve/SKILL.md`, and the six `skills/jentic-api-improve/references/` files (`example-validate-output.json`, `jairf-scoring-guide.md`, `jentic-api-scorecard.md`, `jentic-apitools-cli.md`, `openapi-overlay-spec.md`, `overlay-1.1.0-json-schema.yaml`). A `diff -r` of `skills/jentic-api-improve/` against the source skill dir and a `diff` of the agent file against the source report no differences other than any intentional reference fix documented in the PR body.

### 2. Frontmatter preserved

`skills/jentic-api-improve/SKILL.md` frontmatter still carries `name`, `description`, `license`, `metadata`, `compatibility`, `argument-hint`, and `allowed-tools`. `agents/jentic-api-improve.md` frontmatter still carries `name`, `description`, `model: inherit`, `tools`, and `allowed-tools`.

### 3. Config files are valid JSON

```
python3 -c "import json; json.load(open('.claude-plugin/marketplace.json')); json.load(open('docs/publish-config.json'))"
```

Exits 0.

### 4. The npm tarball carries the skill and the agent

```
npm run build && cd packages/cli && npm pack --dry-run 2>&1
```

The listed tarball contents include `skills/jentic-api-improve/SKILL.md`, all six `skills/jentic-api-improve/references/*` files, and `agents/jentic-api-improve.md`. After the dry-run, `packages/cli/skills/` and `packages/cli/agents/` are removed by `postpack`, and `git status` shows neither (both are git-ignored).

### 5. Second plugin entry present and well-formed

`.claude-plugin/marketplace.json` `plugins[]` has two entries. The new one is `name: "api-improve"`, `source: "./"`, `strict: false`, `skills: ["./skills/jentic-api-improve"]`, `agents: ["./agents/jentic-api-improve.md"]`. The existing `api-scorecard` entry is byte-for-byte unchanged. No path under `.claude/` appears in either entry.

### 6. README documents the skill

`README.md` has a new H2 section for the improve skill (between `## Agent Skills` and `## CLI reference`) covering the extra prerequisites, the three install paths (Claude Code `api-improve` plugin, Vercel `--skill jentic-api-improve`, TanStack Intent via the tarball), the companion-agent note, and what it produces. The heading is added to `## Table of contents`.

### 7. docs.jentic.com page generates

```
npm run docs:extract:dry-run
```

Exits 0 and reports a new `docs/cli/api-improve-skill.md` page generated from the README H2. The `sections[].heading` in the new `publish-config.json` page entry matches the README H2 under `extract-docs.js`'s `normalise()` (lowercase, backticks stripped, trimmed); a mismatch prints `❌ Section not found` and makes the script `process.exit(1)`, so a zero-exit dry-run that lists the page proves the match.

### 8. SkillSpector returns SAFE

```
npx skillspector scan skills/jentic-api-improve/ --no-llm --format json --output /tmp/improve-skillspector.json
python3 -c "import json; print(json.load(open('/tmp/improve-skillspector.json'))['risk_assessment']['recommendation'])"
```

Prints `SAFE`. This is the gate `.github/workflows/skill-security.yml` enforces; the CI `skill-security` matrix job for `jentic-api-improve` must be green on the PR. (If SkillSpector cannot be installed locally, this check is satisfied by the green CI job instead.)

### 9. Canonical docs and constitution updated

`docs/architecture.md` §4 layout tree lists `skills/jentic-api-improve/` and a repo-root `agents/` directory, and its distribution notes describe two plugins (`api-scorecard`, `api-improve`), the `api-improve` `agents[]` companion subagent, and the `agents/` tarball-packaging mechanism. `.claude/CLAUDE.md` describes both skills, two plugin entries with the `agents[]` field, the `agents/` directory, and the updated `files`/prepack/postpack packaging.

### 10. Roadmap lifecycle marker

```
grep -F "## Phase 21 — Add jentic-api-improve skill and agent ✅" specs/roadmap.md
```

Exits 0 — the Phase 21 heading exists and carries the ` ✅` suffix (space + U+2705), with the rest of the block intact.

### 11. Repo lint is clean

```
npm run lint
```

Exits 0. (No `.ts`/`.py` source changed, so this is a safety no-op; JSON validity is covered by check 3.)

## Not Required

- **Running the JS/TS or Python test suites.** No code under `packages/cli/src/`, `docker/`, `action/`, or the formatters changed, so `npm test`, `npm run test:e2e`, and `cd docker && uv run poe test` need not run (`.claude/rules/testing.md` "When to run").
- **A `## CLI reference` or scorecard-`SKILL.md` flag-table sync.** The CLI surface is unchanged (`.claude/rules/cli-readme-sync.md`).
- **A `specs/tech-stack.md` dependency update.** The skill's external tools (`jentic-openapi-tools`, `jentic-apitools-cli`, `check-jsonschema`) are user-installed runtime prerequisites, not repository dependencies — no `package.json` / `docker/pyproject.toml` change, so `.claude/rules/update-tech-stack-on-deps.md` does not trigger.
- **Deleting the skill/agent from `jentic-skills-internal`.** Out of scope; a separate follow-up the user owns.
- **End-to-end execution of the skill against a live spec.** Running the improve loop consumes scorecard quota and requires Docker + a `JENTIC_API_KEY` + LLM credentials; it is a manual smoke the user may choose to run, not a merge gate for a markdown-only port.
- **Live publication of the npm package, the docs site, or a Marketplace re-list.** Those are release-time actions outside this PR (see the spec's further-work notes); this phase only lands the files and wiring so the next release picks them up.
