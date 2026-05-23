---
paths:
  - "packages/**/*.ts"
---

## TypeScript code style

Formatting is Prettier 3 (`.prettierrc` at the repo root) wired into ESLint via `eslint-plugin-prettier/recommended`, so `npm run lint:fix` reformats *and* lints in one pass. Print width 100, single quotes, trailing commas everywhere, LF line endings. The TypeScript rule set lives in `eslint.config.js` (flat config) and rests on `typescript-eslint` plus `eslint-plugin-import-x`. Run `npm run lint:fix` (delegates via `lerna run lint:fix`) on packages you touched before handing off.

A PostToolUse hook (`.claude/hooks/eslint-fix.sh`) runs `eslint --fix` on every Claude-edited `.ts` file under `packages/`, and `.claude/hooks/typescript-check.sh` runs `tsc --noEmit -p <package-tsconfig>` so type errors surface immediately.

- **`'.ts'` suffix on every relative TypeScript import.** ESM under NodeNext requires explicit extensions on relative paths. We set `rewriteRelativeImportExtensions: true` in `tsconfig.base.json` (TS 5.7+), which rewrites `.ts` → `.js` during emit so the source reads as the actual file on disk and the emitted JS satisfies Node's ESM resolver. `import/extensions: ['error', 'always', { ts: 'always', ignorePackages: true }]` enforces the suffix on relative paths only — package imports (`commander`, `@redocly/openapi-core`) stay extension-free. Example: `import { runScore } from './commands/score.ts';` resolves to `score.ts` at type-check time and emits as `./commands/score.js` at runtime.

- **Single quotes for strings.** `quotes: ['error', 'single', { avoidEscape: true }]`. Use a double-quoted literal only when the string contains a single quote and escaping would be noisier.

- **Imports are grouped and separated by blank lines.** `import/order` enforces two groups: `[builtin, external, internal]` then `[parent, sibling, index]`, with `newlines-between: 'always'`. The autofixer handles ordering; just run `lint:fix`.

- **No deep relative imports across packages.** Within a package, `../foo.js` is fine. Reaching into another workspace package via relative paths is wrong — import the public entry instead (`@jentic/api-scorecard-formatter-html`). `import/no-extraneous-dependencies` blocks importing devDeps from non-test code.

- **`_`-prefix for intentionally unused params and vars.** `@typescript-eslint/no-unused-vars` is `error` with `argsIgnorePattern: '^_'`, `varsIgnorePattern: '^_'`, `caughtErrorsIgnorePattern: '^_'`. Use `_result`, `_err` for "I have to declare it but I don't use it" cases. Don't disable the rule.

- **`any` is a warning, not an error — and a smell.** `@typescript-eslint/no-explicit-any: 'warn'` lets `any` slip through in narrow cases (e.g. when typing third-party JSON), but every `any` is an unfinished thought. Prefer `unknown` and narrow with type guards; reach for `Record<string, unknown>` for opaque object shapes.

- **`tsconfig.base.json` is strict on purpose.** `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `forceConsistentCasingInFileNames: true`, `rewriteRelativeImportExtensions: true`. `noUncheckedIndexedAccess` means indexed access returns `T | undefined`; for `process.env`, use bracket access (`process.env['JENTIC_API_KEY']`) and check for `undefined` rather than truthiness. Don't loosen these flags to silence errors — fix the type.

- **Modules are NodeNext ESM.** `tsconfig.base.json` sets `module: "NodeNext"`, `moduleResolution: "NodeNext"`. Every package has `"type": "module"` in its `package.json`, exports compiled `.js` plus `.d.ts`, and uses `"main"` + `"exports"`. Don't add CJS interop shims.

- **Prefer `interface` for object shapes, `type` for unions / mapped / utility forms.** Existing source uses `interface DockerRunOptions { ... }` for record shapes and `type ScorecardResult = Record<string, unknown>` for aliases. Match that.

- **`as const` for enum-like records.** The repo represents fixed sets (e.g. `ExitCode`) as `as const` objects with a derived type:

  ```ts
  export const ExitCode = { SUCCESS: 0, GENERIC_ERROR: 1, /* ... */ } as const;
  export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];
  ```

  Don't introduce TypeScript `enum`s — they have runtime emit and don't cooperate well with `verbatimModuleSyntax`-style tooling.

- **`import type` is optional.** `verbatimModuleSyntax: false` means a regular `import` of a type-only symbol is fine; the compiler erases it. Use `import type` when you want the intent to be explicit, but don't rewrite existing source for it.

- **No comments explaining what code already says.** Project-wide rule from `.claude/rules/karpathy-guidelines.md`: comments should explain *why*, not *what*. JSDoc on exported APIs is welcome when the type signature alone leaves the contract ambiguous; don't add it for self-evident functions.

- **No mocking in tests** when the package eventually grows tests — same rule as `docker/`. See `.claude/rules/testing.md`.

When ESLint and Prettier disagree with a stylistic choice in your edit, the autofixer wins. If a rule is genuinely wrong for a specific line, prefer narrowing the rule in `eslint.config.js` over scattering inline `// eslint-disable` comments.
