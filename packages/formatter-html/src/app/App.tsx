import type { ScorecardData } from './types.ts';

import Scorecard from './components/Scorecard.tsx';
import fixture from './scorecard.fixture.json';

// `format()` accepts engine-verbatim JSON (Record<string, unknown>), so the injected
// payload is not guaranteed to have the shape the SPA reads. Validate the scalar
// fields SummaryCard actually dereferences (apiMetadata.name, summary.score/level/
// grade) — not just that the containers are objects — so a malformed payload degrades
// to the empty state rather than crashing on `.charAt` of undefined. `details` and
// `summary.dimensions` are intentionally NOT required: the CLI's --detail filter drops
// them at lower levels and the components guard their absence.
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRenderable(data: unknown): data is ScorecardData {
  if (!isObject(data)) return false;
  const { summary, apiMetadata } = data;
  if (!isObject(summary) || !isObject(apiMetadata)) return false;
  return (
    typeof apiMetadata['name'] === 'string' &&
    typeof summary['score'] === 'number' &&
    typeof summary['level'] === 'string' &&
    typeof summary['grade'] === 'string'
  );
}

// window.__SCORECARD__ is the injection point. `format(result)` (src/index.ts) assigns
// the engine result JSON to it before the bundle runs; the SPA reads it on mount. In
// `vite dev` it stays `null` and we fall back to a fixture for local rendering.
function readScorecardData(): ScorecardData | null {
  if (isRenderable(window.__SCORECARD__)) {
    return window.__SCORECARD__;
  }

  if (import.meta.env?.DEV) {
    // Bundled only into the dev build; tree-shaken out of production.
    return fixture as unknown as ScorecardData;
  }

  return null;
}

export default function App() {
  const data = readScorecardData();

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        No scorecard data.
      </div>
    );
  }

  return <Scorecard data={data} />;
}
