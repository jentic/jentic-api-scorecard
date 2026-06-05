import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

interface ErrorStandardizationMeta {
  operations_using_rfc9457: number;
  operations_without_rfc9457: number;
  total_operations: number;
  provenance?: Provenance;
}

interface ErrorStandardizationMetadataProps {
  metadata: ErrorStandardizationMeta;
  diagnostics?: Diagnostic[];
}

export default function ErrorStandardizationMetadata({
  metadata,
  diagnostics,
}: ErrorStandardizationMetadataProps) {
  const { operations_using_rfc9457, operations_without_rfc9457, total_operations, provenance } =
    metadata;

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      <dl className="text-xs text-gray-600 space-y-0.5">
        <div className="flex gap-2">
          <dt className="font-medium">Operations using RFC 9457:</dt>
          <dd className={`font-mono ${operations_using_rfc9457 > 0 ? 'text-green-600' : ''}`}>
            {operations_using_rfc9457}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Operations without RFC 9457:</dt>
          <dd className={`font-mono ${operations_without_rfc9457 > 0 ? 'text-red-600' : ''}`}>
            {operations_without_rfc9457}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Total operations:</dt>
          <dd className="font-mono">{total_operations}</dd>
        </div>
      </dl>

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
