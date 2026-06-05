/// <reference types="vite/client" />

import type { ScorecardData } from './types.ts';

declare global {
  interface Window {
    // Injected by format(result) (src/index.ts); null in `vite dev`.
    __SCORECARD__: ScorecardData | null;
  }
}

export {};
