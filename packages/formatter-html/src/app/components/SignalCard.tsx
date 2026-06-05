import { useState } from 'react';
import type { ComponentType } from 'react';

import type { Diagnostic, Signal } from '../types.ts';

import {
  LintResultsMetadata,
  ResolutionCompletenessMetadata,
  SpecValidityMetadata,
  StructuralIntegrityMetadata,
  ExampleDensityMetadata,
  ExampleValidityMetadata,
  ResponseCoverageMetadata,
  ToolingReadinessMetadata,
  DescriptionCoverageMetadata,
  SummaryCoverageMetadata,
  ComplexityComfortMetadata,
  AuthStrengthMetadata,
  DescriptiveRichnessMetadata,
  ErrorStandardizationMetadata,
  OpidQualityMetadata,
} from './signals/index.ts';

const getScoreColor = (score: number): string => {
  const pct = score * 100;
  if (pct >= 80) return 'border-green-500';
  if (pct >= 50) return 'border-yellow-500';
  if (pct >= 30) return 'border-orange-500';
  return 'border-red-500';
};

const getScoreTextColor = (score: number): string => {
  const pct = score * 100;
  if (pct >= 80) return 'text-green-600';
  if (pct >= 50) return 'text-yellow-600';
  if (pct >= 30) return 'text-orange-600';
  return 'text-red-600';
};

// Each metadata component types its own metadata shape; the registry erases those
// differences, so cast to a common prop signature at the boundary.
type MetadataComponent = ComponentType<{ metadata: never; diagnostics?: Diagnostic[] }>;

const SIGNAL_METADATA_COMPONENTS: Record<string, MetadataComponent> = {
  lint_results: LintResultsMetadata as MetadataComponent,
  resolution_completeness: ResolutionCompletenessMetadata as MetadataComponent,
  spec_validity: SpecValidityMetadata as MetadataComponent,
  structural_integrity: StructuralIntegrityMetadata as MetadataComponent,
  example_density: ExampleDensityMetadata as MetadataComponent,
  example_validity: ExampleValidityMetadata as MetadataComponent,
  response_coverage: ResponseCoverageMetadata as MetadataComponent,
  tooling_readiness: ToolingReadinessMetadata as MetadataComponent,
  description_coverage: DescriptionCoverageMetadata as MetadataComponent,
  summary_coverage: SummaryCoverageMetadata as MetadataComponent,
  complexity_comfort: ComplexityComfortMetadata as MetadataComponent,
  auth_strength: AuthStrengthMetadata as MetadataComponent,
  descriptive_richness: DescriptiveRichnessMetadata as MetadataComponent,
  error_standardization: ErrorStandardizationMetadata as MetadataComponent,
  opid_quality: OpidQualityMetadata as MetadataComponent,
};

const hasMetadata = (signal: Signal): boolean =>
  signal.kind in SIGNAL_METADATA_COMPONENTS && Boolean(signal.metadata);

interface SignalCardProps {
  signal: Signal;
  diagnostics?: Diagnostic[];
}

export default function SignalCard({ signal, diagnostics }: SignalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const percentage = Math.round(signal.score * 100);
  const isExpandable = hasMetadata(signal);
  const MetadataComponent = SIGNAL_METADATA_COMPONENTS[signal.kind];

  return (
    <div
      className={`border-l-4 ${getScoreColor(signal.score)} bg-white rounded-r-lg p-4 shadow-sm ${isExpandable ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
      onClick={() => isExpandable && setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        <span className={`font-bold ${getScoreTextColor(signal.score)}`}>{percentage}%</span>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900">{signal.name}</h4>
            {isExpandable && (
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            )}
          </div>
          <p className="text-sm text-gray-600">{signal.description}</p>

          {/* Render metadata component if expanded */}
          {expanded && MetadataComponent && signal.metadata && (
            <MetadataComponent metadata={signal.metadata as never} diagnostics={diagnostics} />
          )}
        </div>
      </div>
    </div>
  );
}
