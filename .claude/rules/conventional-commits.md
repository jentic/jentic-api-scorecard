Commit messages MUST follow Conventional Commits (https://www.conventionalcommits.org/en/v1.0.0/).

*Enforced via two paths sharing `.commitlintrc.json`: the Claude PreToolUse hook (`.claude/hooks/commitlint-before-commit.py`) validates `git commit -m` payloads before Claude fires them, and the husky `commit-msg` hook (`.husky/commit-msg`) validates human / CI commits via `npx commitlint -e`.*

Format: `type(scope): description` — max 69 characters in the header.

- Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `perf`, `build`, `ci`, `style`, `revert`
- If a change ships to users, it's `feat` (new capability) or `fix`
  (bug). Internal developer tooling (agent harness configs, editor
  configs, dev scripts, dependency bumps) uses `chore`. The other
  types (`refactor`, `test`, `docs`, `perf`, `build`, `ci`, `style`,
  `revert`) take precedence over `chore` when they fit.
- Scope: always include a scope. Use the primary subject of the change:
  - For `docs`: the doc file name without extension (e.g. `docs(README)`, `docs(architecture)`)
  - For `ci`: the workflow/config file name without extension (e.g. `ci(docker-image)`, `ci(npm-publish)`). When the change IS the CI config, use type `ci` — not `chore(ci)`.
  - For code: the module, package, or component name (e.g. `fix(gate)`, `feat(score)`, `refactor(cli)`)
  - For `chore`: prefer harness-agnostic scopes — `chore(harness)`
    covers anything under `.claude/`, `.cursor/`, `.codex/`, etc.
- Description: lowercase, imperative mood, no trailing period
