---
paths:
  - "packages/cli/src/index.ts"
  - "packages/cli/src/detail.ts"
  - "packages/cli/src/format.ts"
  - "packages/cli/src/exit-codes.ts"
---

When a change to these files alters the CLI's public surface (commands, arguments, options, defaults, choices, exit codes, or documented env vars), update **both** the `## CLI reference` section of `README.md` **and** the canonical agent skill `skills/jentic-api-scorecard/SKILL.md` (plus `references/llm-analysis.md` when the change touches `--with-llm` / LLM env vars) in the same commit. The skill restates the flag table and exit codes for AI agents, so it drifts from the code the same way the README does.

Internal-only edits (renaming a private helper, refactoring an action handler) do not require a README or skill update.
