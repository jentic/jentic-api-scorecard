import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

interface ToolingReadinessMeta {
  ingestion_errors: number;
  threshold?: number;
  interpretation?: string;
  provenance?: Provenance;
}

interface ToolingReadinessMetadataProps {
  metadata: ToolingReadinessMeta;
  diagnostics?: Diagnostic[];
}

export default function ToolingReadinessMetadata({
  metadata,
  diagnostics,
}: ToolingReadinessMetadataProps) {
  const { ingestion_errors, threshold, interpretation, provenance } = metadata;

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      <dl className="text-xs text-gray-600 space-y-0.5">
        <div className="flex gap-2">
          <dt className="font-medium">Ingestion errors:</dt>
          <dd className="font-mono">{ingestion_errors}</dd>
        </div>
        {threshold !== undefined && (
          <div className="flex gap-2">
            <dt className="font-medium">Threshold:</dt>
            <dd className="font-mono">{threshold}</dd>
          </div>
        )}
        {interpretation && (
          <div className="flex gap-2">
            <dt className="font-medium">Interpretation:</dt>
            <dd>{interpretation}</dd>
          </div>
        )}
      </dl>

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
