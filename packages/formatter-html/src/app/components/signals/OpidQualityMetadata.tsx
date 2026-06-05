import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

import Icon from './shared/Icon.tsx';
import { getBadgeColorClasses, getNormalizedScoreTextColorClass } from './shared/colors.ts';
import {
  MetricGrid,
  ProgressBar,
  SectionHeader,
  type MetricRowProps,
} from './shared/primitives.tsx';

interface OpidQualityMeta {
  ops_with_operation_id: number;
  total_operations: number;
  coverage: number;
  unambiguous_operation_ids: number;
  ambiguous_operation_ids: number;
  uniqueness: number;
  total_collision_issues?: number;
  casing_consistency: number;
  dominant_casing?: string;
  casing_breakdown?: Record<string, number>;
  provenance?: Provenance;
}

interface OpidQualityMetadataProps {
  metadata: OpidQualityMeta;
  diagnostics?: Diagnostic[];
}

const pct = (v: number): string => `${(v * 100).toFixed(0)}%`;

export default function OpidQualityMetadata({ metadata, diagnostics }: OpidQualityMetadataProps) {
  const {
    ops_with_operation_id,
    total_operations,
    coverage,
    unambiguous_operation_ids,
    ambiguous_operation_ids,
    uniqueness,
    total_collision_issues,
    casing_consistency,
    dominant_casing,
    casing_breakdown,
    provenance,
  } = metadata;

  const breakdown = casing_breakdown ?? {};
  const totalCasingCount = Object.values(breakdown).reduce((a, b) => a + b, 0) || total_operations;
  const consistentCount = Math.round(casing_consistency * totalCasingCount);

  const uniquenessExtras: MetricRowProps[] = [];
  if (ambiguous_operation_ids > 0)
    uniquenessExtras.push({
      label: 'Ambiguous operationIds',
      value: ambiguous_operation_ids,
      valueColor: 'yellow',
    });
  if (total_collision_issues !== undefined && total_collision_issues > 0)
    uniquenessExtras.push({
      label: 'Collision issues',
      value: total_collision_issues,
      valueColor: 'red',
    });

  const casingEntries = Object.entries(breakdown);

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default space-y-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="space-y-1">
        <SectionHeader>Coverage</SectionHeader>
        <div className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
          <span className="text-gray-500">Operations with operationId</span>
          <span className="font-mono font-medium whitespace-nowrap">
            {ops_with_operation_id}
            <span className="mx-0.5">/</span>
            {total_operations}
            <span className={`ml-1 ${getNormalizedScoreTextColorClass(coverage)}`}>
              ({pct(coverage)})
            </span>
          </span>
        </div>
        <ProgressBar value={coverage} height="sm" />
      </div>

      <div className="space-y-1">
        <SectionHeader>Uniqueness</SectionHeader>
        <div className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
          <span className="text-gray-500">Unique operationIds</span>
          <span className="font-mono font-medium whitespace-nowrap">
            {unambiguous_operation_ids}
            <span className="mx-0.5">/</span>
            {ops_with_operation_id}
            <span className={`ml-1 ${getNormalizedScoreTextColorClass(uniqueness)}`}>
              ({pct(uniqueness)})
            </span>
          </span>
        </div>
        <ProgressBar value={uniqueness} height="sm" />
        {uniquenessExtras.length > 0 && (
          <div className="mt-1.5">
            <MetricGrid metrics={uniquenessExtras} />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <SectionHeader>Casing Consistency</SectionHeader>
        <div className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
          <span className="text-gray-500">Casing Consistency</span>
          {totalCasingCount > 0 && (
            <span className="font-mono font-medium whitespace-nowrap">
              {consistentCount}
              <span className="mx-0.5">/</span>
              {totalCasingCount} consistent
              <span className={`ml-1 ${getNormalizedScoreTextColorClass(casing_consistency)}`}>
                ({pct(casing_consistency)})
              </span>
            </span>
          )}
        </div>
        <ProgressBar value={casing_consistency} height="sm" />
      </div>

      <div className="border-gray-200 border-t pt-3">
        <div className="text-gray-500 mb-2 text-[10px] font-medium uppercase tracking-wide">
          Casing Styles
        </div>
        {casingEntries.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {casingEntries.map(([style, count]) => {
              const colors =
                style === dominant_casing
                  ? getBadgeColorClasses('green')
                  : { bg: 'bg-gray-200', text: 'text-gray-500' };
              return (
                <span
                  key={style}
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs ${colors.bg} ${colors.text}`}
                >
                  <Icon name="hash" className="h-2.5 w-2.5" />
                  <span className="font-medium">{style}</span>
                  <span className="opacity-70">({count})</span>
                </span>
              );
            })}
          </div>
        ) : (
          <span className="text-xs text-gray-500 italic">None detected</span>
        )}
      </div>

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
