# Phase 26 Validation — Dark Mode Support for Formatter HTML

## Definition of Done

All of the following must be true before this branch is merged.

### 1. Lint passes

```bash
npm run lint -w @jentic/api-scorecard-formatter-html
```

Exits 0. No ESLint errors or Prettier violations across `src/` and `test/`.

### 2. Type check passes

```bash
npm run typescript:check-types -w @jentic/api-scorecard-formatter-html
```

Exits 0. All three tsconfig projects (`tsconfig.json`, `tsconfig.app.json`, `test/tsconfig.json`) report no type errors.

### 3. Build succeeds

```bash
npm run build -w @jentic/api-scorecard-formatter-html
```

Exits 0. `dist/app/index.html`, `dist/index.js`, and `dist/react/` are present in the output.

### 4. Full test suite passes

```bash
npm test -w @jentic/api-scorecard-formatter-html
```

Exits 0 after the build in check 3. All existing tests pass unmodified (light mode regression guard). In addition:

- `SummaryCard`, `DimensionCard`, `SignalCard`, `DiagnosticsSection`, `ApiMetadataCard` SSR output each contain at least one `var(--sc-` reference.
- `CircularProgress` SSR output contains `var(--cp-track)`.
- `GradeBadge` SSR output contains at least one `dark:bg-*-900/30` grade band class.
- `format(fixture)` output (build-gated, via the existing `'format (built template)'` describe block) contains `'prefers-color-scheme'`.
- `format(fixture)` output contains `'id="dark-mode-toggle"'`.
- `format(fixture)` output contains `'--sc-bg'` (CSS variable declaration inlined in the built stylesheet).
- The existing self-containment assertion passes: no external `<script src>` or `<link href>` in `format(fixture)` output.

### 5. CSS custom property layer is wired

`packages/formatter-html/src/app/index.css` contains:

```
@custom-variant dark (&:where(.dark, .dark *));
```

And declares `--sc-bg`, `--sc-card`, `--sc-section`, `--sc-text-primary`, `--sc-text-secondary`, `--sc-text-muted`, `--sc-border`, `--cp-track`, and `--score-color-*` under both `:root` and `.dark`.

### 6. Jentic palette values are used for dark mode surfaces

The `.dark` block in `index.css` sets:
- `--sc-bg: #0E1A1D`
- `--sc-card: #162629`
- `--sc-section: #193238`
- `--sc-border: #305256`
- `--sc-text-secondary: #E4EAEB`
- `--sc-text-muted: #A3CACC`

### 7. Severity colours follow the Jentic convention

`DiagnosticsSection.tsx` and `DiagnosticsList.tsx` use the four-band Jentic severity palette for dark mode:
- Severity 1 (error): `dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40`
- Severity 2 (warning): `dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40`
- Severity 3 (info): `dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800/40`
- Severity 4 (hint): `dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-700/40`

### 8. Standalone HTML dark mode script is present

`injectScorecard()` in `packages/formatter-html/src/index.ts` calls `injectDarkMode()`, and `injectDarkMode()` inserts a `<script>` block before `</head>` containing `prefers-color-scheme`, `jentic-scorecard-dark` (localStorage key), and `'dark-mode-toggle'` (the toggle ID is assigned by the injected script at runtime, not as an HTML attribute).

### 9. Roadmap heading updated

```bash
grep -F "## Phase 26 — Dark Mode Support for Formatter HTML ✅" specs/roadmap.md
```

Exits 0.

## Not Required

- Visual or browser regression testing — no Playwright, Cypress, or screenshot comparison. Acceptance is SSR string assertions and `format()` output string checks.
- Docker image rebuild — `packages/formatter-html` is not part of the scoring engine image; no `docker/` changes are needed.
- Python lint or test changes — no `docker/` code is touched.
- Changes to other packages (`packages/cli/`, `action/`, etc.) — scoped to `packages/formatter-html/` only.
- Changes to the `format()` function signature — it remains `format(result: ScorecardResult): string`.
- New `./react` exports — no new public API surface; dark mode is purely additive to existing component class names and CSS variables.
- A shipped CSS file for `./react` consumers — the `./react` entry remains JS + `.d.ts` only; the `--sc-*` variable set is documented in the README for consumers to provide themselves.
- E2E tests (`test:e2e`) — this package has no `test:e2e` script and none is required.
- Manual QA sign-off — the existing SSR-based test strategy is the acceptance bar.
