---
paths:
  - "packages/cli/src/index.ts"
  - "packages/cli/src/detail.ts"
  - "packages/cli/src/format.ts"
  - "packages/cli/src/exit-codes.ts"
---

When a change touches the CLI's user-visible surface, update the matching section of `README.md` in the **same commit**. The README's `## CLI reference` section is hand-maintained against the commander definition; past sections (e.g. "Control output depth", "Machine-readable output") have drifted between releases — the rule below narrows the responsibility to the four source files that *define* the surface.

The mapping is:

| Source file | What changes there | README section to update |
|---|---|---|
| `packages/cli/src/index.ts` | adding/removing/renaming a command, argument, or option; changing a default | `### <command>` synopsis, `#### Arguments`, `#### Options`, `#### Environment` |
| `packages/cli/src/detail.ts` | changing `DETAIL_LEVELS` or `DEFAULT_DETAIL` | `#### Options` (the `-d, --detail` row's Choices/Default columns) and the "Control output depth" examples |
| `packages/cli/src/format.ts` | changing `FORMATS` or `DEFAULT_FORMAT` | `#### Options` (the `-f, --format` row) and the "Machine-readable output" examples |
| `packages/cli/src/exit-codes.ts` | changing the numeric `ExitCode` mapping | `#### Exit codes` |

After editing the README, verify the help block matches by running:

```
node packages/cli/bin/jentic-api-scorecard.mjs score --help
```

(Requires `npm run build:typescript -w @jentic/api-scorecard-cli` first if `dist/` is stale — the bin shim imports `dist/index.js`.) Every flag, default, and choice in the help output should appear in the corresponding `#### Options` row, and vice versa.

Internal-only edits to those files (renaming a private helper, refactoring an action handler) do **not** require a README update — only changes that a user could observe through `--help`, the exit code, or the documented environment.

`.claude/CLAUDE.md` already requires that "When a PR adds or changes a feature, update the relevant documentation in the same PR." This rule is the narrow, file-level expression of that for the CLI's public contract.
