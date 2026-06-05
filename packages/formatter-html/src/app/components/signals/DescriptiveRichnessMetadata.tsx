import { useState } from 'react';

import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

import Icon from './shared/Icon.tsx';
import { getColorClassesByType, getNormalizedScoreColor } from './shared/colors.ts';
import { MetricGrid, type MetricRowProps } from './shared/primitives.tsx';

interface OperationScored {
  operation_id: string;
  element_descriptive_score: number;
  clarity_score: number;
  depth_score: number;
  issues_found?: string[];
}

interface DescriptiveRichnessMeta {
  number_of_describable_elements: number;
  operations_with_issues: number;
  operations_without_issues: number;
  sum_of_element_descriptive_scores?: number;
  operations_scored?: OperationScored[];
  provenance?: Provenance;
}

interface DescriptiveRichnessMetadataProps {
  metadata: DescriptiveRichnessMeta;
  diagnostics?: Diagnostic[];
}

export default function DescriptiveRichnessMetadata({
  metadata,
  diagnostics,
}: DescriptiveRichnessMetadataProps) {
  const {
    number_of_describable_elements,
    operations_with_issues,
    operations_without_issues,
    sum_of_element_descriptive_scores,
    operations_scored,
    provenance,
  } = metadata;

  const [expanded, setExpanded] = useState(false);

  const sortedOperations = operations_scored
    ? [...operations_scored].sort(
        (a, b) => a.element_descriptive_score - b.element_descriptive_score,
      )
    : [];

  const metrics: MetricRowProps[] = [
    { label: 'Describable Elements', value: number_of_describable_elements },
  ];
  if (sum_of_element_descriptive_scores !== undefined)
    metrics.push({
      label: 'Total Descriptive Score',
      value: sum_of_element_descriptive_scores.toFixed(2),
    });
  metrics.push({
    label: 'Ops without Issues',
    value: operations_without_issues,
    valueColor: 'green',
  });
  metrics.push({
    label: 'Ops with Issues',
    value: operations_with_issues,
    valueColor: operations_with_issues > 0 ? 'yellow' : 'green',
  });

  const emptyText =
    number_of_describable_elements === 0
      ? 'No elements require descriptions'
      : operations_with_issues === 0
        ? 'All operations have good descriptions'
        : 'No operations analyzed';

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      <MetricGrid metrics={metrics} />

      {sortedOperations.length > 0 ? (
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Operation Details ({sortedOperations.length})
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              {expanded ? 'Hide' : 'Show'}
              <Icon
                name="chevron-down"
                className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </span>
          </button>
          {expanded && (
            <div className="overflow-y-auto p-2 space-y-1.5" style={{ maxHeight: '280px' }}>
              {sortedOperations.map((op, index) => (
                <OperationRow key={index} op={op} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg bg-emerald-50 px-3 py-2 border border-emerald-200">
          <Icon name="check-circle" className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">{emptyText}</span>
        </div>
      )}

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}

function OperationRow({ op }: { op: OperationScored }) {
  const scoreColor = getColorClassesByType(
    getNormalizedScoreColor(op.element_descriptive_score, 2),
  );
  return (
    <div className="bg-gray-50 rounded-md p-2.5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] text-gray-500 flex-shrink-0">Operation ID:</span>
          <span className="font-mono text-xs font-medium truncate">{op.operation_id}</span>
        </div>
        <span className={`font-mono text-xs font-semibold flex-shrink-0 ${scoreColor.text}`}>
          {op.element_descriptive_score.toFixed(2)}
        </span>
      </div>
      <div className="flex items-center gap-4 mb-2">
        <ScoreBadge label="Clarity" score={op.clarity_score} />
        <ScoreBadge label="Depth" score={op.depth_score} />
      </div>
      {op.issues_found && op.issues_found.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {op.issues_found.map((issue, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[10px] text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded"
            >
              <Icon name="tag" className="h-2.5 w-2.5" />
              {issue.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ label, score }: { label: string; score: number }) {
  const color = getColorClassesByType(getNormalizedScoreColor(score, 1));
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-500">{label}:</span>
      <span className={`font-mono text-[10px] font-semibold ${color.text}`}>
        {score.toFixed(2)}
      </span>
    </div>
  );
}
