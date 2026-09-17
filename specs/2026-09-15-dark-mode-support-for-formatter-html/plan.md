# Phase 26 Plan — Dark Mode Support for Formatter HTML

## Group 1 — CSS Config and Custom Properties

1. Add `@custom-variant dark (&:where(.dark, .dark *));` to `packages/formatter-html/src/app/index.css` (below the existing `@import 'tailwindcss';` line) to wire the `.dark` class strategy for Tailwind v4.
2. Add `--sc-*` surface colour variable declarations to `index.css` under `:root` (light defaults) and `.dark` (Jentic brand palette):
   - `:root`: `--sc-bg: #ffffff`, `--sc-card: #f9fafb`, `--sc-section: #f3f4f6`, `--sc-text-primary: #111827`, `--sc-text-secondary: #6b7280`, `--sc-text-muted: #9ca3af`, `--sc-border: #e5e7eb`
   - `.dark`: `--sc-bg: #0E1A1D`, `--sc-card: #162629`, `--sc-section: #193238`, `--sc-text-primary: #FFFFFF`, `--sc-text-secondary: #E4EAEB`, `--sc-text-muted: #A3CACC`, `--sc-border: #305256`
3. Add `--cp-track` variable to `index.css` under `:root` (`#e5e7eb`) and `.dark` (`#305256`) for the `CircularProgress` background ring.
4. Add `--score-color-N` variable declarations to `index.css` under `:root` (current HSL values from `scoreColors.ts`) and `.dark` (dark-adjusted equivalents aligned with the Jentic grade colour palette).

## Group 2 — Core Layout Components

5. Update `packages/formatter-html/src/app/components/scoreColors.ts` to return `var(--score-color-N)` CSS custom property references instead of hard-coded HSL strings. Update the file comment to document the CSS variable approach.
6. Update `packages/formatter-html/src/app/components/SummaryCard.tsx`: replace hard-coded light/dark Tailwind pairs with CSS variable references — `bg-[var(--sc-bg)]`, `bg-[var(--sc-card)]`, `bg-[var(--sc-section)]`, `text-[var(--sc-text-primary)]`, `text-[var(--sc-text-secondary)]`, `text-[var(--sc-text-muted)]`, `border-[var(--sc-border)]`.
7. Apply the same CSS variable substitution to `packages/formatter-html/src/app/components/DimensionCard.tsx`.
8. Apply the same CSS variable substitution to `packages/formatter-html/src/app/components/SignalCard.tsx`; keep interactive hover utilities as Tailwind classes (e.g. `hover:brightness-110`).
9. Update `packages/formatter-html/src/app/components/GradeBadge.tsx`: light mode class pairs stay unchanged; add dark mode badge variants aligned with the Jentic grade palette — `dark:bg-green-900/30 dark:text-green-300` (A+/A/A-), `dark:bg-teal-900/30 dark:text-teal-300` (B), `dark:bg-amber-900/30 dark:text-amber-300` (C), `dark:bg-orange-900/30 dark:text-orange-300` (D), `dark:bg-red-900/30 dark:text-red-300` (F).
10. Apply CSS variable substitution to `packages/formatter-html/src/app/components/ApiMetadataCard.tsx`.
11. Apply CSS variable substitution to `packages/formatter-html/src/app/components/Scorecard.tsx`.
12. Add `text-[var(--sc-text-secondary)]` to the empty-state element in `packages/formatter-html/src/app/App.tsx` (replacing the current hard-coded `text-gray-500`).
13. Update `packages/formatter-html/src/app/components/CircularProgress.tsx`: replace the hard-coded `stroke="#e5e7eb"` on the background circle element with `stroke="var(--cp-track)"`.

## Group 3 — Diagnostics Components

14. Update `packages/formatter-html/src/app/components/DiagnosticsSection.tsx`: apply CSS variable substitution for container, text, and border classes; update the four severity colour bands to the Jentic convention:
    - Error (severity 1): `bg-red-100 text-red-800 border-red-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40`
    - Warning (severity 2): `bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40`
    - Info (severity 3): `bg-blue-100 text-blue-800 border-blue-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800/40`
    - Hint (severity 4): `bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-700/40`
15. Apply the same CSS variable substitution and severity colour updates to `packages/formatter-html/src/app/components/DiagnosticsList.tsx`.

## Group 4 — Signal Components

16. Apply CSS variable substitution to `packages/formatter-html/src/app/components/signals/shared/primitives.tsx` for all surface colour classes in `MetricRow`, `MetricGrid`, `SectionHeader`, `ProgressBar`, `DonutChart`, and `SecondaryMetric`.
17. Update `packages/formatter-html/src/app/components/signals/shared/colors.ts`: replace the light-mode-only class strings with paired light+dark variants using the Jentic convention (e.g. `'text-emerald-600'` → `'text-emerald-600 dark:text-emerald-400'`, `'bg-green-100'` → `'bg-green-100 dark:bg-green-900/30'`, `'bg-gray-50'` → `'bg-[var(--sc-section)]'`). Update the header comment to document the dark mode strategy.
18. Apply CSS variable substitution and Jentic-aligned dark severity classes to the signal components with inline class names: `CountBasedMetadata.tsx`, `AuthStrengthMetadata.tsx`, `LintResultsMetadata.tsx`, `StructuralIntegrityMetadata.tsx`, `ToolingReadinessMetadata.tsx`, `OpidQualityMetadata.tsx`, `DescriptiveRichnessMetadata.tsx`, `ComplexityComfortMetadata.tsx`.

## Group 5 — Standalone HTML Dark Mode Script

19. Add a `injectDarkMode(html: string): string` function in `packages/formatter-html/src/index.ts`. It targets the literal `</head>` in the template string and inserts a synchronous `<script>` block before it. The script: (a) reads `localStorage.getItem('jentic-scorecard-dark')`, falls back to `window.matchMedia('(prefers-color-scheme: dark)').matches`, (b) sets or removes `class="dark"` on `document.documentElement` accordingly, (c) adds a `matchMedia` change listener that updates the class when system preference changes (only when no manual override is stored), (d) appends a fixed-position sun/moon toggle button (`id="dark-mode-toggle"`) to `document.body` that flips the class and writes the override to `localStorage` under `'jentic-scorecard-dark'`.
20. Wire `injectDarkMode()` into `injectScorecard()` in `packages/formatter-html/src/index.ts` — call it on the result string after the existing data-island replacement step.

## Group 6 — Tests, Docs, and Roadmap Completion

21. Add dark mode assertions to `packages/formatter-html/test/components.test.tsx`: for each of the six exported building-block components assert that the SSR output contains at least one CSS variable reference. Examples: `SummaryCard` output contains `var(--sc-bg)`, `CircularProgress` output contains `var(--cp-track)`, `GradeBadge` output contains `dark:bg-green-900/30` (or equivalent grade band).
22. Add a build-gated assertion inside the existing `'format (built template)'` describe block in `packages/formatter-html/test/format.test.ts` that calls `format(fixture)` and asserts: the output contains `'prefers-color-scheme'`, the output contains `'id="dark-mode-toggle"'`, the output contains `'--sc-bg'`, and the existing self-containment assertion (no external `<script src>` or `<link href>`) continues to pass.
23. Add a `### Dark mode` subsection to `packages/formatter-html/README.md` under the `./react` section: explain the `class="dark"` parent strategy and list the `--sc-*` CSS variables that must be defined for surface colours. Add a note in the `format()` section about the auto-dark + toggle behaviour.
24. Append ` ✅` to the `## Phase 26 — Dark Mode Support for Formatter HTML` heading in `specs/roadmap.md`.

## Group 7 — Verify

25. `npm run lint -w @jentic/api-scorecard-formatter-html` exits 0.
26. `npm run typescript:check-types -w @jentic/api-scorecard-formatter-html` exits 0 (checks `tsconfig.json`, `tsconfig.app.json`, and `test/tsconfig.json`).
27. `npm run build -w @jentic/api-scorecard-formatter-html` exits 0; `dist/app/index.html`, `dist/index.js`, and `dist/react/` are produced.
28. `npm test -w @jentic/api-scorecard-formatter-html` exits 0 — all existing tests pass (light mode regression guard) and new dark mode assertions pass.
29. `grep -F "## Phase 26 — Dark Mode Support for Formatter HTML ✅" specs/roadmap.md` exits 0.
