import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

interface ComplexityComfortMeta {
  total_operations: number;
  max_schema_depth: number;
  normalised_endpoint_count?: number;
  normalised_schema_depth?: number;
  raw_complexity?: number;
  endpoint_baseline_start: number;
  endpoint_baseline_range: number;
  depth_baseline: number;
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
    normalised_endpoint_count,
    normalised_schema_depth,
    raw_complexity,
    endpoint_baseline_start,
    endpoint_baseline_range,
    depth_baseline,
    provenance,
  } = metadata;

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      <dl className="text-xs text-gray-600 space-y-0.5">
        <div className="flex gap-2">
          <dt className="font-medium">Total operations:</dt>
          <dd className="font-mono">{total_operations}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Max schema depth:</dt>
          <dd className="font-mono">{max_schema_depth}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Normalised endpoint count:</dt>
          <dd className="font-mono">{normalised_endpoint_count?.toFixed(3)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Normalised schema depth:</dt>
          <dd className="font-mono">{normalised_schema_depth?.toFixed(3)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Raw complexity:</dt>
          <dd className="font-mono">{raw_complexity?.toFixed(4)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Endpoint baseline:</dt>
          <dd className="font-mono">
            {endpoint_baseline_start}–{endpoint_baseline_start + endpoint_baseline_range}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Depth baseline:</dt>
          <dd className="font-mono">{depth_baseline}</dd>
        </div>
      </dl>

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
