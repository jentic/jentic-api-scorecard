import type { Diagnostic, Signal } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

import { DonutChart, ProgressBar, SecondaryMetric } from './shared/primitives.tsx';

interface CountConfig {
  numeratorField: string;
  denominatorField: string;
  label: string;
  denominatorLabel: string;
  secondaryField?: string;
  secondaryLabel?: string;
  secondaryIsBad?: boolean;
  showPercentagePrimary?: boolean;
}

const COUNT_SIGNAL_CONFIG: Record<string, CountConfig> = {
  resolution_completeness: {
    numeratorField: 'resolved_refs',
    denominatorField: 'total_refs',
    label: 'References Resolved',
    denominatorLabel: 'total',
    secondaryField: 'unresolved_refs',
    secondaryLabel: 'Unresolved',
    secondaryIsBad: true,
  },
  example_density: {
    numeratorField: 'present_examples',
    denominatorField: 'expected_examples',
    label: 'Examples Present',
    denominatorLabel: 'expected',
  },
  example_validity: {
    numeratorField: 'valid_examples',
    denominatorField: 'total_examples',
    label: 'Valid Examples',
    denominatorLabel: 'total',
    secondaryField: 'invalid_examples',
    secondaryLabel: 'Invalid',
    secondaryIsBad: true,
  },
  response_coverage: {
    numeratorField: 'response_coverage_sum',
    denominatorField: 'total_operations',
    label: 'Response Coverage',
    denominatorLabel: 'operations',
    showPercentagePrimary: true,
  },
  description_coverage: {
    numeratorField: 'described_elements',
    denominatorField: 'describable_elements',
    label: 'Descriptions Present',
    denominatorLabel: 'total',
    secondaryField: 'undescribed_elements',
    secondaryLabel: 'Missing',
    secondaryIsBad: true,
  },
  error_standardization: {
    numeratorField: 'operations_using_rfc9457',
    denominatorField: 'total_operations',
    label: 'RFC 9457 Compliant',
    denominatorLabel: 'total',
    secondaryField: 'operations_without_rfc9457',
    secondaryLabel: 'Non-compliant',
    secondaryIsBad: true,
  },
  summary_coverage: {
    numeratorField: 'summaries_present',
    denominatorField: 'summaries_expected',
    label: 'Summaries Present',
    denominatorLabel: 'expected',
    secondaryField: 'missing_summaries',
    secondaryLabel: 'Missing',
    secondaryIsBad: true,
  },
};

function num(metadata: Record<string, unknown>, field: string): number {
  const v = metadata[field];
  return typeof v === 'number' ? v : 0;
}

interface CountBasedMetadataProps {
  kind: string;
  metadata: NonNullable<Signal['metadata']>;
  diagnostics?: Diagnostic[];
}

export default function CountBasedMetadata({
  kind,
  metadata,
  diagnostics,
}: CountBasedMetadataProps) {
  const config = COUNT_SIGNAL_CONFIG[kind];
  const provenance = metadata.provenance;

  const footer = diagnostics && provenance && (
    <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
  );

  if (!config) return <>{footer}</>;

  const numerator = num(metadata, config.numeratorField);
  const denominator = num(metadata, config.denominatorField);
  const percentage = denominator > 0 ? (numerator / denominator) * 100 : 0;
  const secondaryValue = config.secondaryField ? num(metadata, config.secondaryField) : null;

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      {config.showPercentagePrimary ? (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <DonutChart percentage={percentage} size={96} strokeWidth={10} />
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-sm font-medium">{config.label}</p>
                <p className="text-xs text-gray-500">{denominator} operations analyzed</p>
              </div>
              <div className="text-xs">
                <span className="text-gray-500">Coverage points: </span>
                <span className="font-mono font-medium">{numerator.toFixed(2)}</span>
                <span className="text-gray-500"> / {denominator.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 bg-gray-50 rounded px-2 py-1.5">
            Each operation scores 0-1: +0.25 for 2XX, 4XX, 5XX, and default responses
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs">{config.label}</span>
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs font-medium">{numerator}</span>
              <span className="text-gray-500 text-xs">/</span>
              <span className="font-mono text-xs font-medium">{denominator}</span>
              <span className="text-gray-500 text-[10px] ml-0.5">{config.denominatorLabel}</span>
            </div>
          </div>
          <ProgressBar value={numerator} max={denominator} />
          {secondaryValue !== null && config.secondaryLabel && (
            <SecondaryMetric
              value={secondaryValue}
              label={config.secondaryLabel}
              isBad={config.secondaryIsBad}
            />
          )}
        </div>
      )}

      {footer}
    </div>
  );
}
