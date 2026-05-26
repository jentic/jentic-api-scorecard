import { ScorecardResult } from '../result.ts';

export function formatJson(result: ScorecardResult): string {
  return JSON.stringify(result, null, 2) + '\n';
}
