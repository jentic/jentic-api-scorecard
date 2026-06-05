import type { ScorecardData } from '../types.ts';

import DiagnosticsSection from './DiagnosticsSection.tsx';
import DimensionCard from './DimensionCard.tsx';
import SummaryCard from './SummaryCard.tsx';

interface ScorecardProps {
  data: ScorecardData;
}

export default function Scorecard({ data }: ScorecardProps) {
  // `details` is absent at the lower --detail levels (summary/dimensions); flatten
  // defensively (and tolerate a non-array) so those payloads still render the summary.
  const allDimensions = Array.isArray(data.details)
    ? data.details.flatMap((detail) => detail.dimensions ?? [])
    : [];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Summary Card */}
      <SummaryCard apiMetadata={data.apiMetadata} summary={data.summary} metadata={data.metadata} />

      {/* Overview Section — only when per-dimension detail is present */}
      {allDimensions.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
            <span className="text-gray-600">
              Overall score: {Math.round(data.summary.score)} out of 100
            </span>
          </div>

          {allDimensions.map((dimension, index) => (
            <DimensionCard key={index} dimension={dimension} diagnostics={data.diagnostics} />
          ))}
        </div>
      )}

      {/* Diagnostics Section — only when diagnostics are included (--detail diagnostics) */}
      {data.diagnostics && data.diagnostics.length > 0 && (
        <div className="mt-8">
          <DiagnosticsSection diagnostics={data.diagnostics} />
        </div>
      )}
    </div>
  );
}
