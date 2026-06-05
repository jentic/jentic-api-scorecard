import type { ScorecardData } from './types.ts';

import Scorecard from './components/Scorecard.tsx';
import fixture from './scorecard.fixture.json';

// window.__SCORECARD__ is the injection point. `format(result)` (src/index.ts) assigns
// the engine result JSON to it before the bundle runs; the SPA reads it on mount. In
// `vite dev` it stays `null` and we fall back to a fixture for local rendering.
function readScorecardData(): ScorecardData | null {
  if (window.__SCORECARD__) {
    return window.__SCORECARD__;
  }

  if (import.meta.env.DEV) {
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
