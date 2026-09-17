# Phase 26 Requirements — Dark Mode Support for Formatter HTML

## Scope

This phase adds dark mode to `@jentic/api-scorecard-formatter-html` across both its public surfaces. The `./react` entry gains dark mode support on every component so consumers can activate it by adding `class="dark"` to any parent element in their app. The standalone `format()` HTML output gains a self-contained dark mode system: a vanilla JS script injected at format time that reads the user's system colour preference, sets `class="dark"` on the `<html>` element, and renders a sun/moon toggle button so viewers can override their system preference while the artefact is open.

No changes are made to the `format(result): string` signature, the `./react` export API, or the engine result JSON shape. Light mode rendering must be pixel-equivalent before and after — existing test assertions act as the regression guard.

## Out of Scope

_(none — all roadmap bullets are in scope, with paths and mechanisms corrected per the Decisions section below)_

## Decisions

### Tailwind v4 dark mode mechanism

The package uses Tailwind CSS v4 (`^4.3.1`) with the `@tailwindcss/vite` plugin. Tailwind v4 does not use a `tailwind.config.js` file or a `darkMode: 'class'` key — those are v3 APIs. Dark mode in v4 is configured via CSS. The correct mechanism is adding a `@custom-variant` directive to `src/app/index.css`:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

This makes all `dark:` prefixed utilities and CSS variable scoping respond to a `.dark` class ancestor. The roadmap's wording "Set `darkMode: 'class'` in the Tailwind config" expresses the same intent; this decision records the correct v4 implementation path.

### Color file paths

The roadmap references `packages/formatter-html/src/app/colors.ts`, which does not exist. The actual files are:

- `packages/formatter-html/src/app/components/scoreColors.ts` — exports `getScoreColor(score)` and `getGradeColor(grade)`, returning raw HSL strings applied as inline `style` attributes
- `packages/formatter-html/src/app/components/signals/shared/colors.ts` — exports Tailwind class-name helper functions for signal metadata panels; its header comment already documents the absence of `dark:` variants

Both files are in scope. The comment in `signals/shared/colors.ts` is updated to reflect that `dark:` variants are now included. `scoreColors.ts` is updated per the CSS custom property decision below.

### CSS custom property layer for surface colours

The Jentic design system uses a teal-based dark palette (`#0E1A1D` page background, `#162629` card background, `#305256` borders) that has no standard Tailwind utility equivalent. Rather than hardcoding arbitrary hex values into component class strings — which would lock the package to a single dark palette and prevent `./react` consumers from overriding it — this phase introduces a CSS custom property layer.

`src/app/index.css` declares `--sc-*` variables under `:root` (light mode defaults) and `.dark` (Jentic brand palette):

```css
:root {
  --sc-bg:           #ffffff;
  --sc-card:         #f9fafb;  /* gray-50 */
  --sc-section:      #f3f4f6;  /* gray-100 */
  --sc-text-primary: #111827;  /* gray-900 */
  --sc-text-secondary: #6b7280; /* gray-500 */
  --sc-text-muted:   #9ca3af;  /* gray-400 */
  --sc-border:       #e5e7eb;  /* gray-200 */
}

.dark {
  --sc-bg:           #0E1A1D;
  --sc-card:         #162629;
  --sc-section:      #193238;
  --sc-text-primary: #FFFFFF;
  --sc-text-secondary: #E4EAEB;
  --sc-text-muted:   #A3CACC;
  --sc-border:       #305256;
}
```

Components reference these via Tailwind's arbitrary value syntax: `bg-[var(--sc-bg)]`, `text-[var(--sc-text-primary)]`, `border-[var(--sc-border)]`. In the standalone HTML all CSS is inlined by Vite so the variables are always defined. For `./react` consumers, the README documents that they must provide these variables in their own stylesheet (or use the Jentic theme, which defines compatible equivalents automatically).

Severity and grade badge colours use standard Tailwind utilities aligned with the Jentic convention — `rose-*/amber-*/sky-*/slate-*` for the four severity levels, grade-specific colour bands for badges — rather than CSS variables, since these are chromatic accents that do not need per-consumer override.

### Dark mode for HSL inline styles (`scoreColors.ts`)

`scoreColors.ts` returns raw HSL strings applied as `style={{ color }}`. These bypass the CSS custom property layer entirely. This phase extends `index.css` with `--score-color-N` variables for each score band under `:root` (current light-mode HSL values) and `.dark` (dark-adjusted variants from the Jentic grade colour palette). `scoreColors.ts` returns `var(--score-color-N)` references instead of hard-coded HSL strings, keeping component JS dark-mode-agnostic.

### Standalone HTML dark mode injection point

Two approaches were evaluated:

- **A: Bake into source `index.html`** so Vite inlines it automatically
- **B: Inject in `injectScorecard()` in `src/index.ts`** at format time, targeting `</head>`

Approach B is chosen — it matches the roadmap's explicit guidance and keeps the dev-mode SPA toggle-free while the built artefact carries it. A separate `injectDarkMode(html)` helper is added to `src/index.ts` and called from `injectScorecard()` after the data-island replacement. The `</head>` string is the regex target; it appears exactly once in the built HTML.

### Toggle persistence

The manual toggle overrides system preference and persists via `localStorage` under the key `'jentic-scorecard-dark'`. On load, `localStorage` wins over `prefers-color-scheme`. A `matchMedia` change listener updates the system-preference default if no manual override is stored.

## Constraints

- **`format(result): string` signature is sacrosanct.** Dark mode injection happens inside `injectScorecard()` and is invisible to the public API surface.
- **No new runtime dependencies in the `"."` entry.** The toggle script is vanilla JS inlined as a string literal. No React, no Preact, no library is added to the `"."` path.
- **Self-contained HTML constraint preserved.** The existing `format.test.ts` assertion (no external `<script src>` or `<link href>`) must continue to pass. All CSS, scripts, and variable declarations are inlined.
- **No CSS shipped by `./react`.** The `./react` entry exports only `.js` + `.d.ts`. `./react` consumers must supply `--sc-*` CSS variables in their own stylesheet to get dark mode surface colours; the README documents the required variable set.
- **Light mode pixel-equivalent.** When `class="dark"` is absent the components render identically to today. Existing test assertions are the regression guard and must pass unmodified.
- **No Tailwind theme extension.** No custom color additions to `tailwind.config.*`. All class references use standard Tailwind utilities or CSS custom property references via the arbitrary value syntax.

## Context

Phases 24 and 25 built out the `detail` prop and the full `./react` building-block export surface. With a mature public component API in place, dark mode is the next visible quality-of-life improvement. Scorecard reports are increasingly embedded in dashboards, CI artefact viewers, and documentation sites that carry their own dark themes — without dark mode support the components create a jarring light-only island in a dark page.

Aligning with the Jentic design system (teal-based surfaces, `rose-*/amber-*/sky-*/slate-*` severity palette, Jentic grade badge colours) ensures the `format()` standalone HTML looks coherent alongside Jentic's own tooling when shared. The CSS custom property layer simultaneously allows `./react` consumers to override the palette to match a different design system by redefining the `--sc-*` variables.

The standalone HTML toggle matters for shared CI artefacts: a developer opening a scorecard report on a dark-mode OS gets dark mode automatically, and can switch manually without any configuration on the pipeline that generated the file.

This is a pure presentation addition — no data model changes, no API surface changes, no engine changes. Refs #343.
