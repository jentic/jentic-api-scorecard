# @jentic/api-scorecard-formatter-html

HTML formatter and React components for [Jentic API Scorecard](https://github.com/jentic/jentic-api-scorecard) results.

The package has two entry points:

- **`"."`** — `format(result): string` — renders a scorecard as a self-contained HTML document (no React required)
- **`"./react"`** — individual React components for embedding scorecard data in your own app

---

## `format(result): string` — self-contained HTML

Renders a scorecard result as a single self-contained HTML document — an interactive React SPA
with its JS and CSS inlined, the result JSON assigned to `window.__SCORECARD__`, and no external
assets or CDN. The output works offline and is suitable for embedding in CI artifacts and
dashboards.

```ts
import { writeFileSync } from 'node:fs';
import { format } from '@jentic/api-scorecard-formatter-html';

writeFileSync('scorecard.html', format(scorecardResult));
```

`scorecardResult` is the JSON object produced by the CLI with `--format json`. Use
`--detail diagnostics` to include the full evidence bundle:

```sh
npx @jentic/api-scorecard-cli score your-api.yaml \
  --format json --detail diagnostics -o scorecard.json
```

The output includes an auto-dark mode script: it reads the `prefers-color-scheme` media query
on load and adds a fixed-position sun/moon toggle button (`#dark-mode-toggle`) to the page.
The user's manual preference is persisted in `localStorage` under `jentic-scorecard-dark`.

---

## React components — `./react`

For embedding scorecard data inside your own React app. React and react-dom are **peer
dependencies** — the components render with *your* React.

```sh
npm install @jentic/api-scorecard-formatter-html
```

Styling uses Tailwind CSS utility classes — **no CSS is shipped**. Add the Tailwind Play CDN
to your `<head>` or configure Tailwind in your build tool:

```html
<script src="https://cdn.tailwindcss.com"></script>
```

### Getting scorecard data

These components render data sourced from a `ScorecardData` object. The easiest way to get one is from the CLI:

```sh
npx @jentic/api-scorecard-cli score your-api.yaml \
  --format json --detail diagnostics -o scorecard.json
```

Then import or fetch it in your component:

```ts
import reportJson from './scorecard.json';
import type { ScorecardData } from '@jentic/api-scorecard-formatter-html/react';

const scorecard = reportJson as unknown as ScorecardData;
```

If you already have a `scorecard.json` — from an API directory, a CI artifact, or a saved
report — load it directly. No re-scoring step is needed.

### `Scorecard` — full report

Renders the complete scorecard report. Equivalent to `--format html` from the CLI.

```tsx
import { Scorecard } from '@jentic/api-scorecard-formatter-html/react';

<Scorecard data={scorecard} detail="dimensions" />
```

The `detail` prop controls how much information is shown:

| `detail` | What renders |
|---|---|
| `"summary"` | Score + grade only |
| `"dimensions"` | Adds dimension cards |
| `"signals"` | Adds diagnostic evidence inside signal cards |
| `"diagnostics"` | Adds full diagnostics section at the bottom (default) |

### Building-block components

Import individual components to slot scorecard data into an existing layout — a dashboard
sidebar, a docs page header, a CI status panel. Each component is independent.

#### `SummaryCard`

The top-level summary panel — score, grade, and optional API metadata stats bar.

```tsx
import { SummaryCard } from '@jentic/api-scorecard-formatter-html/react';

<SummaryCard
  apiMetadata={scorecard.apiMetadata}
  summary={scorecard.summary}
  metadata={scorecard.metadata}
  showApiMetadata={true}
/>
```

`showApiMetadata` (default `true`) controls whether the API stats bar (endpoint count, auth
type, etc.) is rendered. Set to `false` for compact layouts.

#### `ApiMetadataCard`

The API stats bar as a standalone block — useful when `showApiMetadata` is off on `SummaryCard`.

```tsx
import { ApiMetadataCard } from '@jentic/api-scorecard-formatter-html/react';

<ApiMetadataCard apiMetadata={scorecard.apiMetadata} />
```

#### `DimensionCard`

A single scoring dimension — title, score, and its signal breakdown.

```tsx
import { DimensionCard } from '@jentic/api-scorecard-formatter-html/react';

const dimensions = scorecard.details?.flatMap((g) => g.dimensions ?? []) ?? [];

{dimensions.map((dim) => (
  <DimensionCard
    key={dim.kind}
    dimension={dim}
    diagnostics={scorecard.diagnostics}
  />
))}
```

#### `DiagnosticsSection`

The full diagnostics table — all findings grouped by severity.

```tsx
import { DiagnosticsSection } from '@jentic/api-scorecard-formatter-html/react';

<DiagnosticsSection diagnostics={scorecard.diagnostics} />
```

#### `CircularProgress`

Circular score dial. Useful as a standalone score indicator anywhere in a page.

```tsx
import { CircularProgress } from '@jentic/api-scorecard-formatter-html/react';

<CircularProgress score={scorecard.summary.score} />
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `score` | `number` | — | 0–100 |
| `size` | `number` | `80` | Diameter in px |
| `strokeWidth` | `number` | `6` | Ring thickness in px |
| `labelSize` | `string` | `"text-2xl"` | Tailwind text-size class for the score label |

#### `GradeBadge`

Coloured grade pill (`A+` through `F`).

```tsx
import { GradeBadge } from '@jentic/api-scorecard-formatter-html/react';

<GradeBadge grade={scorecard.summary.grade} />
```

### Dark mode

All components follow a **`class="dark"` parent strategy**: add `dark` to any ancestor element
and the components switch to the Jentic dark palette automatically. No prop is needed.

```tsx
<div className="dark">
  <SummaryCard apiMetadata={scorecard.apiMetadata} summary={scorecard.summary} />
</div>
```

Surface colours are expressed as CSS custom properties. Define these on the parent that carries
`class="dark"` (or on `:root` / `.dark` in your stylesheet):

| Variable | Light default | Dark (Jentic palette) |
|---|---|---|
| `--sc-bg` | `#ffffff` | `#0E1A1D` |
| `--sc-card` | `#f9fafb` | `#162629` |
| `--sc-section` | `#f3f4f6` | `#193238` |
| `--sc-text-primary` | `#111827` | `#FFFFFF` |
| `--sc-text-secondary` | `#6b7280` | `#E4EAEB` |
| `--sc-text-muted` | `#9ca3af` | `#A3CACC` |
| `--sc-border` | `#e5e7eb` | `#305256` |
| `--cp-track` | `#e5e7eb` | `#305256` |
| `--score-color-a` | `hsl(142,71%,45%)` | `hsl(142,63%,60%)` |
| `--score-color-b` | `hsl(165,82%,35%)` | `hsl(165,72%,52%)` |
| `--score-color-c` | `hsl(45,93%,47%)` | `hsl(45,88%,62%)` |
| `--score-color-d` | `hsl(25,95%,53%)` | `hsl(25,90%,65%)` |
| `--score-color-f` | `hsl(0,84%,60%)` | `hsl(0,80%,68%)` |

The `--score-color-*` variables drive score arcs (`CircularProgress`), grade text
(`SummaryCard`), and signal score/border accents (`SignalCard`). `GradeBadge` uses its own
Tailwind grade classes. Define the dark variants in `.dark { ... }` to enable dark mode score
colouring; the light values are baked in as CSS fallbacks so light mode works without any
variable definitions.

To use the `class="dark"` strategy, configure your Tailwind setup:

**Tailwind v4** — add this to your CSS entry point:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

**Tailwind v3** — set `darkMode` in your config:

```js
// tailwind.config.js
module.exports = { darkMode: 'class' };
```

### TypeScript types

```ts
import type {
  ScorecardData,   // top-level scorecard shape
  ApiMetadata,     // API info (title, version, contact, …)
  Summary,         // score, grade, dimension roll-ups
  Dimension,       // individual dimension (kind, score, signals)
  Diagnostic,      // a single finding (severity, message, pointer, …)
} from '@jentic/api-scorecard-formatter-html/react';
```

---

## License

Jentic API Scorecard is licensed under the
[Apache 2.0](https://github.com/jentic/jentic-api-scorecard/blob/main/LICENSE) license.
Jentic API Scorecard comes with an explicit
[NOTICE](https://github.com/jentic/jentic-api-scorecard/blob/main/NOTICE) file containing
additional legal notices and information.
