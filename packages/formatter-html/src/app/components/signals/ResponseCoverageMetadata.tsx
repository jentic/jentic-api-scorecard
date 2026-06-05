import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

interface ResponseCoverageMeta {
  total_operations: number;
  response_coverage_sum: number;
  provenance?: Provenance;
}

interface ResponseCoverageMetadataProps {
  metadata: ResponseCoverageMeta;
  diagnostics?: Diagnostic[];
}

export default function ResponseCoverageMetadata({
  metadata,
  diagnostics,
}: ResponseCoverageMetadataProps) {
  const { total_operations, response_coverage_sum, provenance } = metadata;

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
          <dt className="font-medium">Response coverage sum:</dt>
          <dd className="font-mono">{response_coverage_sum}</dd>
        </div>
      </dl>

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
