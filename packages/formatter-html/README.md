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
