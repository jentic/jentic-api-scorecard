import type { ScorecardData } from './types.ts';

import Scorecard from './components/Scorecard.tsx';
import fixture from './scorecard.fixture.json';

// `format()` accepts engine-verbatim JSON (Record<string, unknown>), so the injected
// payload is not guaranteed to have the shape Scorecard reads. Check the load-bearing
// fields before rendering so a malformed payload degrades to the empty state instead
// of crashing the SPA to a blank screen.
function isRenderable(data: unknown): data is ScorecardData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d['details']) &&
    typeof d['summary'] === 'object' &&
    d['summary'] !== null &&
    typeof d['apiMetadata'] === 'object' &&
    d['apiMetadata'] !== null
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
