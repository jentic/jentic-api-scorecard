import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

import { MetricGrid, SectionHeader, type MetricRowProps } from './shared/primitives.tsx';

interface ComplexityComfortMeta {
  total_operations: number;
  max_schema_depth: number;
  schema_count?: number;
  schemas_exceeding_threshold?: number;
  pct_schemas_exceeding?: number;
  normalised_endpoint_count?: number;
  normalised_schema_depth?: number;
  raw_complexity?: number;
  endpoint_baseline_start?: number;
  endpoint_baseline_range?: number;
  depth_baseline?: number;
  provenance?: Provenance;
}

interface ComplexityComfortMetadataProps {
  metadata: ComplexityComfortMeta;
  diagnostics?: Diagnostic[];
}

export default function ComplexityComfortMetadata({
  metadata,
  diagnostics,
}: ComplexityComfortMetadataProps) {
  const {
    total_operations,
    max_schema_depth,
    schema_count,
    schemas_exceeding_threshold,
    pct_schemas_exceeding,
    normalised_endpoint_count,
    normalised_schema_depth,
    raw_complexity,
    endpoint_baseline_start,
    endpoint_baseline_range,
    depth_baseline,
    provenance,
  } = metadata;

  const metrics: MetricRowProps[] = [];
  const push = (label: string, value: string | number, valueColor?: MetricRowProps['valueColor']) =>
    metrics.push({ label, value, valueColor });

  if (total_operations >= 0) push('Total Operations', total_operations);
  if (max_schema_depth >= 0)
    push(
      'Max Schema Depth',
      max_schema_depth,
      depth_baseline !== undefined && max_schema_depth <= depth_baseline ? 'green' : 'orange',
    );
  if (schema_count !== undefined) push('Schema Count', schema_count);
  if (schemas_exceeding_threshold !== undefined)
    push('Schemas Exceeding Threshold', schemas_exceeding_threshold);
  if (pct_schemas_exceeding !== undefined)
    push('% Schemas Exceeding', `${(pct_schemas_exceeding * 100).toFixed(0)}%`);
  if (normalised_endpoint_count !== undefined)
    push(
      'Normalised Endpoint Count',
      normalised_endpoint_count.toFixed(2),
      normalised_endpoint_count < 1 ? 'green' : 'orange',
    );
  if (normalised_schema_depth !== undefined)
    push(
      'Normalised Schema Depth',
      normalised_schema_depth.toFixed(2),
      normalised_schema_depth < 1 ? 'green' : 'orange',
    );
  if (raw_complexity !== undefined) push('Raw Complexity', raw_complexity.toFixed(3));
  if (endpoint_baseline_start !== undefined && endpoint_baseline_range !== undefined)
    push(
      'Endpoint Baseline',
      `${endpoint_baseline_start}–${endpoint_baseline_start + endpoint_baseline_range}`,
    );
  if (depth_baseline !== undefined) push('Schema Depth Baseline', depth_baseline);

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      {metrics.length > 0 ? (
        <>
          <SectionHeader>Complexity Metrics</SectionHeader>
          <MetricGrid metrics={metrics} />
        </>
      ) : (
        <p className="text-gray-500 text-xs italic text-center py-2">
          No complexity metrics available
        </p>
      )}

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
