import { useState } from 'react';
import type { ComponentType } from 'react';

import type { Diagnostic, Signal } from '../types.ts';

import { getScoreColor } from './scoreColors.ts';
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

// Each of the 15 metadata components types its own distinct `metadata` shape. A
// `kind -> component` registry can't preserve those per-kind types in one Record
// without a discriminated-union lookup (a large refactor for no runtime gain), so
// we erase `metadata` to `never` at this boundary. The cost: field-drift in a
// component is caught at runtime by the fixture-based value assertions in
// test/signals.test.tsx, not at compile time. `score` is passed to every component;
// most ignore it.
type MetadataComponent = ComponentType<{
  metadata: never;
  diagnostics?: Diagnostic[];
  score?: number;
}>;

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
      className={`border-l-4 bg-[var(--sc-card,#f9fafb)] rounded-r-lg p-4 shadow-sm ${isExpandable ? 'cursor-pointer hover:bg-[var(--sc-section,#f3f4f6)] transition-colors' : ''}`}
      style={{ borderLeftColor: getScoreColor(percentage) }}
      onClick={() => isExpandable && setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        <span className="font-bold" style={{ color: getScoreColor(percentage) }}>
          {percentage}%
        </span>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-[var(--sc-text-primary,#111827)]">{signal.name}</h4>
            {isExpandable && (
              <svg
                className={`w-5 h-5 text-[var(--sc-text-muted,#9ca3af)] transition-transform ${expanded ? 'rotate-180' : ''}`}
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
          <p className="text-sm text-[var(--sc-text-secondary,#6b7280)]">{signal.description}</p>

          {/* Render metadata component if expanded */}
          {expanded && MetadataComponent && signal.metadata && (
            <MetadataComponent
              metadata={signal.metadata as never}
              diagnostics={diagnostics}
              score={signal.score}
            />
          )}
        </div>
      </div>
    </div>
  );
}
