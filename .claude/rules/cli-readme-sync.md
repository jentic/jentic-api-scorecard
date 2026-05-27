---
paths:
  - "packages/cli/src/index.ts"
  - "packages/cli/src/detail.ts"
  - "packages/cli/src/format.ts"
  - "packages/cli/src/exit-codes.ts"
---

When a change to these files alters the CLI's public surface (commands, arguments, options, defaults, choices, exit codes, or documented env vars), update the `## CLI reference` section of `README.md` in the same commit.

Internal-only edits (renaming a private helper, refactoring an action handler) do not require a README update.
