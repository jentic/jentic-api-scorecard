import { format } from '@jentic/api-scorecard-formatter-html';

import { ScorecardResult } from '../result.ts';

// Thin adapter over the standalone HTML formatter package so the score-command
// dispatch stays uniform with formatPretty / formatJson. The package owns all of
// the React/Vite/Tailwind weight; the CLI only consumes the built format() string.
export function formatHtml(result: ScorecardResult): string {
  // The package types its input as Record<string, unknown>; the CLI's structured
  // ScorecardResult is a valid record but TS won't widen a typed interface to an
  // index signature implicitly, so cast at the boundary.
  return format(result as unknown as Record<string, unknown>);
}
