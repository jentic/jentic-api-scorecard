import type { ScorecardData } from '../types.ts';
import { DEFAULT_DETAIL, DetailLevel } from '../detail.ts';

import DiagnosticsSection from './DiagnosticsSection.tsx';
import DimensionCard from './DimensionCard.tsx';
import SummaryCard from './SummaryCard.tsx';

interface ScorecardProps {
  data: ScorecardData;
  detail?: DetailLevel;
}

export default function Scorecard({ data, detail = DEFAULT_DETAIL }: ScorecardProps) {
  // `details` is absent at the lower --detail levels (summary/dimensions); flatten
  // defensively (and tolerate a non-array) so those payloads still render the summary.
  const allDimensions = Array.isArray(data.details)
    ? data.details.flatMap((d) => d.dimensions ?? [])
    : [];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Summary Card — dimension circles are absent at summary level, matching CLI behaviour */}
      <SummaryCard
        apiMetadata={data.apiMetadata}
        summary={
          detail === DetailLevel.SUMMARY ? { ...data.summary, dimensions: undefined } : data.summary
        }
        metadata={data.metadata}
      />

      {/* Overview Section — at dimensions/signals/diagnostics level; diagnostics are only
          shown at diagnostics level */}
      {allDimensions.length > 0 && detail !== DetailLevel.SUMMARY && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-[var(--sc-text-primary,#111827)]">Overview</h2>
            <span className="text-[var(--sc-text-secondary,#6b7280)]">
              Overall score: {Math.round(data.summary.score)} out of 100
            </span>
          </div>

          {allDimensions.map((dimension, index) => (
            <DimensionCard
              key={index}
              dimension={dimension}
              diagnostics={detail !== DetailLevel.DIMENSIONS ? data.diagnostics : undefined}
            />
          ))}
        </div>
      )}

      {/* Diagnostics Section — only when detail='diagnostics' and diagnostics are present */}
      {data.diagnostics && data.diagnostics.length > 0 && detail === DetailLevel.DIAGNOSTICS && (
        <div className="mt-8">
          <DiagnosticsSection diagnostics={data.diagnostics} />
        </div>
      )}
    </div>
  );
}
