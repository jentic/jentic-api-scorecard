# @jentic/api-scorecard-formatter-html

HTML formatter and React components for [Jentic API Scorecard](https://github.com/jentic/jentic-api-scorecard) results.

The package has two entry points:

## `format(result): string` — self-contained HTML

Renders a scorecard result as a single self-contained HTML document — an interactive React SPA
with its JS and CSS inlined, the result JSON assigned to `window.__SCORECARD__`, and no external
assets or CDN. The output works offline and is suitable for embedding in CI artifacts and
dashboards.

```ts
import { writeFileSync } from 'node:fs';

import { format } from '@jentic/api-scorecard-formatter-html';

writeFileSync('scorecard.html', format(scorecardResult)); // engine-verbatim scorecard JSON
```

## React components

For embedding the scorecard inside your own React app:

```tsx
import { Scorecard, type ScorecardData } from '@jentic/api-scorecard-formatter-html/react';

export function Report({ data }: { data: ScorecardData }) {
  return <Scorecard data={data} />;
}
```

React is an (optional) **peer dependency** — the components render with *your* React. The
components are styled with stock Tailwind utility classes and **ship no CSS**, so a Tailwind
pipeline must be present. The quickest way is the Tailwind Play CDN:

```html
<script src="https://cdn.tailwindcss.com"></script>
```

The entry exports `Scorecard` (the full report) and the `ScorecardData` type model.

## License

Jentic API Scorecard is licensed under the
[Apache 2.0](https://github.com/jentic/jentic-api-scorecard/blob/main/LICENSE) license.
Jentic API Scorecard comes with an explicit
[NOTICE](https://github.com/jentic/jentic-api-scorecard/blob/main/NOTICE) file containing
additional legal notices and information.
