import { ScorecardResult } from './result.ts';

export const DetailLevel = {
  SUMMARY: 'summary',
  DIMENSIONS: 'dimensions',
  SIGNALS: 'signals',
  DIAGNOSTICS: 'diagnostics',
} as const;

export type DetailLevel = (typeof DetailLevel)[keyof typeof DetailLevel];

export const DETAIL_LEVELS: readonly DetailLevel[] = [
  DetailLevel.SUMMARY,
  DetailLevel.DIMENSIONS,
  DetailLevel.SIGNALS,
  DetailLevel.DIAGNOSTICS,
];

export const DEFAULT_DETAIL: DetailLevel = DetailLevel.DIMENSIONS;

export function isDetailLevel(value: string): value is DetailLevel {
  return (DETAIL_LEVELS as readonly string[]).includes(value);
}

export function filterByDetail(result: ScorecardResult, level: DetailLevel): ScorecardResult {
  const { summary, details, diagnostics, ...rest } = result;

  const filtered: ScorecardResult = { ...rest, summary };

  if (level === DetailLevel.SUMMARY) {
    const { dimensions: _dimensions, ...summaryRest } = summary;
    filtered.summary = summaryRest;
    return filtered;
  }

  if (level === DetailLevel.DIMENSIONS) {
    return filtered;
  }

  if (level === DetailLevel.SIGNALS) {
    if (details !== undefined) filtered.details = details;
    return filtered;
  }

  if (details !== undefined) filtered.details = details;
  if (diagnostics !== undefined) filtered.diagnostics = diagnostics;
  return filtered;
}
