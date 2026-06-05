import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

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
  dominant_casing_count?: number;
  casing_breakdown?: Record<string, number>;
  provenance?: Provenance;
}

interface OpidQualityMetadataProps {
  metadata: OpidQualityMeta;
  diagnostics?: Diagnostic[];
}

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
    dominant_casing_count,
    casing_breakdown,
    provenance,
  } = metadata;

  const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Coverage Section */}
      <div className="mb-3">
        <h5 className="text-xs font-semibold text-gray-700 mb-1">Coverage</h5>
        <dl className="text-xs text-gray-600 space-y-0.5">
          <div className="flex gap-2">
            <dt className="font-medium">Operations with operationId:</dt>
            <dd className="font-mono">
              {ops_with_operation_id} / {total_operations}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Coverage:</dt>
            <dd
              className={`font-mono ${coverage === 1 ? 'text-green-600' : coverage >= 0.8 ? 'text-yellow-600' : 'text-red-600'}`}
            >
              {formatPercent(coverage)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Uniqueness Section */}
      <div className="mb-3">
        <h5 className="text-xs font-semibold text-gray-700 mb-1">Uniqueness</h5>
        <dl className="text-xs text-gray-600 space-y-0.5">
          <div className="flex gap-2">
            <dt className="font-medium">Unambiguous operationIds:</dt>
            <dd className={`font-mono ${ambiguous_operation_ids === 0 ? 'text-green-600' : ''}`}>
              {unambiguous_operation_ids}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Ambiguous operationIds:</dt>
            <dd className={`font-mono ${ambiguous_operation_ids > 0 ? 'text-red-600' : ''}`}>
              {ambiguous_operation_ids}
            </dd>
          </div>
          {total_collision_issues !== undefined && (
            <div className="flex gap-2">
              <dt className="font-medium">Total collision issues:</dt>
              <dd
                className={`font-mono ${total_collision_issues > 0 ? 'text-red-600' : 'text-green-600'}`}
              >
                {total_collision_issues}
              </dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="font-medium">Uniqueness:</dt>
            <dd className={`font-mono ${uniqueness === 1 ? 'text-green-600' : 'text-yellow-600'}`}>
              {formatPercent(uniqueness)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Casing Consistency Section */}
      <div className="mb-3">
        <h5 className="text-xs font-semibold text-gray-700 mb-1">Casing Consistency</h5>
        <dl className="text-xs text-gray-600 space-y-0.5">
          <div className="flex gap-2">
            <dt className="font-medium">Consistency:</dt>
            <dd
              className={`font-mono ${casing_consistency === 1 ? 'text-green-600' : casing_consistency >= 0.8 ? 'text-yellow-600' : 'text-red-600'}`}
            >
              {formatPercent(casing_consistency)}
            </dd>
          </div>
          {dominant_casing && (
            <div className="flex gap-2">
              <dt className="font-medium">Dominant casing:</dt>
              <dd className="font-mono">
                {dominant_casing} ({dominant_casing_count})
              </dd>
            </div>
          )}
          {!dominant_casing && (
            <div className="flex gap-2">
              <dt className="font-medium">Dominant casing:</dt>
              <dd className="text-gray-500 italic">None detected</dd>
            </div>
          )}
          {casing_breakdown && Object.keys(casing_breakdown).length > 1 && (
            <div className="mt-1">
              <dt className="font-medium mb-1">Casing breakdown:</dt>
              <dd className="ml-2">
                {Object.entries(casing_breakdown).map(([casing, count]) => (
                  <div key={casing} className="flex gap-2 font-mono">
                    <span>{casing}:</span>
                    <span>{count}</span>
                  </div>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
