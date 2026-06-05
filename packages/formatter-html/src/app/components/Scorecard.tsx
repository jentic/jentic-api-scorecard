import type { ScorecardData } from '../types.ts';

import DiagnosticsSection from './DiagnosticsSection.tsx';
import DimensionCard from './DimensionCard.tsx';
import SummaryCard from './SummaryCard.tsx';

interface ScorecardProps {
  data: ScorecardData;
}

export default function Scorecard({ data }: ScorecardProps) {
  // Flatten all dimensions from details
  const allDimensions = data.details.flatMap((detail) => detail.dimensions);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Summary Card */}
      <SummaryCard apiMetadata={data.apiMetadata} summary={data.summary} metadata={data.metadata} />

      {/* Overview Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
          <span className="text-gray-600">
            Overall score: {Math.round(data.summary.score)} out of 100
          </span>
        </div>

        {/* Dimension Details */}
        {allDimensions.map((dimension, index) => (
          <DimensionCard key={index} dimension={dimension} diagnostics={data.diagnostics} />
        ))}
      </div>

      {/* Diagnostics Section */}
      <div className="mt-8">
        <DiagnosticsSection diagnostics={data.diagnostics} />
      </div>
    </div>
  );
}
