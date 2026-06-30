# Phase 21 Plan — Add `jentic-api-improve` skill and agent

Source paths (the private repo the files are copied from):
- Skill: `/dati/dev/progetti/jentic/projects/jentic-skills-internal/skills/jentic-api-improve/` (SKILL.md + `references/`: `example-validate-output.json`, `jairf-scoring-guide.md`, `jentic-api-scorecard.md`, `jentic-apitools-cli.md`, `openapi-overlay-spec.md`, `overlay-1.1.0-json-schema.yaml`)
- Agent: `/dati/dev/progetti/jentic/projects/jentic-skills-internal/agents/jentic-api-improve.md`

Each `## Group` is one atomic, DCO-signed, Conventional-Commits commit (the Verify group runs no commit of its own unless a fix-up is needed).

## Group 1 — Copy the skill and agent into the repo

1. Create `skills/jentic-api-improve/` and copy the source `SKILL.md` into it verbatim (preserve all frontmatter: `name`, `description`, `license`, `metadata`, `compatibility`, `argument-hint`, `allowed-tools`).
2. Create `skills/jentic-api-improve/references/` and copy all six source reference files verbatim: `example-validate-output.json`, `jairf-scoring-guide.md`, `jentic-api-scorecard.md`, `jentic-apitools-cli.md`, `openapi-overlay-spec.md`, `overlay-1.1.0-json-schema.yaml`.
3. Create the repo-root `agents/` directory and copy the source `agents/jentic-api-improve.md` into it verbatim (preserve `name`, `description`, `model: inherit`, `tools`, `allowed-tools`).
4. Read every copied file end-to-end and confirm each internal cross-reference resolves in *this* repo: the SKILL.md "copy `agents/jentic-api-improve.md` (from the repo root)" instruction (now correct — the file exists at the repo root), every `references/<file>` link, and the `<base-dir>/references/overlay-1.1.0-json-schema.yaml` path. Fix only a reference that is genuinely wrong in this repo's context; otherwise change nothing. Confirm the SKILL.md never points at `.claude/` or at the private source repo.
   - Commit: `docs(skills): add jentic-api-improve skill and agent`

## Group 2 — Package the skill and agent into the npm tarball

5. In `packages/cli/package.json` `files`: add `"agents/"` (the `skills/` entry already globs the new skill in — no change needed for the skill).
6. In `packages/cli/package.json` `scripts.prepack`: append ` && copyfiles -u 2 "../../agents/**/*" .` after the existing `skills/**/*` clause, so the repo-root `agents/` tree is copied into `packages/cli/agents/` at pack time.
7. In `packages/cli/package.json` `scripts.postpack`: add `agents` to the `rimraf` list (`rimraf NOTICE LICENSE README.md skills agents`).
8. In `.gitignore`: add `packages/cli/agents/` next to the existing `packages/cli/skills/` line, so the prepack-staged copy is never committed.
   - Commit: `chore(cli): ship jentic-api-improve skill and agent in the tarball`

## Group 3 — Register the new Claude Code plugin

9. In `.claude-plugin/marketplace.json`: add a second object to `plugins[]` — `name: "api-improve"`, a one-line `description`, `source: "./"`, `strict: false`, `skills: ["./skills/jentic-api-improve"]`, and `agents: ["./agents/jentic-api-improve.md"]`. Leave the existing `api-scorecard` entry untouched. Confirm the file is valid JSON.
   - Commit: `feat(marketplace): add api-improve plugin (skill + agent)`

## Group 4 — Document the skill (README + docs.jentic.com)

10. In `README.md`: add a new H2 section for the improve skill (placed after `## Agent Skills`, before `## CLI reference`). It must state the extra runtime prerequisites (`jentic-openapi-tools`, `jentic-apitools-cli`, `check-jsonschema`, `jq`, Python, plus the scorecard CLI's Node/Docker/`JENTIC_API_KEY`), the three install paths (Claude Code `/plugin install api-improve@jentic-api-scorecard`, Vercel `npx skills add jentic/jentic-api-scorecard --skill jentic-api-improve`, TanStack Intent via the npm tarball), the companion-agent note, and a one-line "what it produces" (improved spec + Overlay + changelog, non-breaking). Add the new heading to `## Table of contents`.
11. In `docs/publish-config.json`: add a new `pages[]` entry (`id: "agent-improve-skill"`, `output: "docs/cli/api-improve-skill.md"`, a `title` and `intro`, `sections: [{ "heading": "<README H2 text from task 10>" }]`, and `relatedLinks` mirroring the existing `agent-skill` page — CLI Reference, Agent Skill, GitHub Action, the source `SKILL.md` GitHub link). Add an `Agent Improve Skill` related-link to the existing `agent-skill`, `cli-reference`, and `github-action` pages' `relatedLinks` so the new page is reachable. Confirm the file is valid JSON and the `sections[].heading` matches the README H2 under `extract-docs.js`'s `normalise()` (lowercase, backticks stripped, trimmed) — easiest is to make it identical text.
    - Commit: `docs(README): document the jentic-api-improve skill`

## Group 5 — Update the canonical docs and the constitution

12. In `docs/architecture.md` §4: add `skills/jentic-api-improve/` (SKILL.md + `references/`) and a new top-level `agents/` directory (`jentic-api-improve.md`) to the layout tree; extend the distribution notes to say the plugin marketplace now lists **two** plugins (`api-scorecard`, `api-improve`), that `api-improve` additionally ships a companion subagent via its `agents[]`, and that the repo-root `agents/` tree is carried into the CLI tarball by the same prepack/postpack mechanism as `skills/`.
13. In `.claude/CLAUDE.md`: update the `skills/` bullet to describe both skills; update the `.claude-plugin/` bullet to describe two plugin entries and the `agents[]` field on `api-improve`; update the `packages/` CLI bullet's `files`/prepack/postpack description to include `agents/`; add a new repo-structure bullet for the repo-root `agents/` directory. Keep it terse and matched to the file's existing style.
14. In `specs/roadmap.md`: ensure a `## Phase 21 — Add jentic-api-improve skill and agent` block exists (add it if absent — see the note below) and append ` ✅` (single space + U+2705) to that heading once the work is complete.
    - Commit: `docs(architecture): record the api-improve skill, agent, and plugin`

> Roadmap note: the scaffolded spec was titled "Phase 16", but Phase 16 (`Graduate to stable 1.0.0`) is already shipped and the next free number is **21**. The spec files use Phase 21. `specs/roadmap.md` has no Phase 21 block yet; the cleanest path is to add one via `/sdd-new-phase` (or by hand, matching the existing block format: `## Phase 21 — …`, `**Goal:**`, `**Depends on:**`, `**Priority:**`, body bullets) *before* `/sdd-implement-spec` runs, so the implement skill can find an unprocessed phase to mark `✅`. If the block is added by hand in this same effort, task 14's "add it if absent" is already satisfied and only the `✅` append remains.

## Group N — Verify

15. `python3 -c "import json; json.load(open('.claude-plugin/marketplace.json')); json.load(open('docs/publish-config.json'))"` exits 0 (both edited config files are valid JSON).
16. `find skills/jentic-api-improve agents/jentic-api-improve.md -type f` lists the SKILL.md, all six reference files, and the agent file — and a byte-for-byte compare against the source (`diff -r` skill dir, `diff` agent file) reports no differences except any intentional reference fix from task 4.
17. `cd packages/cli && npm pack --dry-run 2>&1` lists `skills/jentic-api-improve/SKILL.md`, the six `skills/jentic-api-improve/references/*` files, and `agents/jentic-api-improve.md` among the tarball contents (run after `npm run build` so `prepack` fires). Confirm `packages/cli/skills/` and `packages/cli/agents/` are cleaned afterward by `postpack` and are git-ignored.
18. `npm run docs:extract:dry-run` exits 0 and reports the new `docs/cli/api-improve-skill.md` page being generated from the README H2 — proving the `publish-config.json` `heading` matches the README exactly (a mismatch makes `extract-docs.js` skip or error on the section).
19. `npx skillspector scan skills/jentic-api-improve/ --no-llm --format json --output /tmp/improve-skillspector.json` then read `risk_assessment.recommendation` — must be `SAFE` (this is what `.github/workflows/skill-security.yml` enforces in CI; run it locally so the PR does not fail the gate). If SkillSpector is not installed locally, note that CI will run it and the gate must pass.
20. `grep -F "## Phase 21 — Add jentic-api-improve skill and agent ✅" specs/roadmap.md` exits 0 (lifecycle marker present with the load-bearing leading space) — only after the roadmap block exists per the Group 5 note.
21. `npm run lint` exits 0 (no `.ts`/`.py` changed, so this is a fast no-op safety check; the edited JSON/markdown are not linted but JSON validity is covered by task 15).
