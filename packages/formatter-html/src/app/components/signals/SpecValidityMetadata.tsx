import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

interface DiagnosticCounts {
  error?: number;
  warning?: number;
  information?: number;
  hint?: number;
}

interface SpecValidityMeta {
  failure_reason?: string;
  diagnostic_counts?: DiagnosticCounts;
  provenance?: Provenance;
}

interface SpecValidityMetadataProps {
  metadata: SpecValidityMeta;
  diagnostics?: Diagnostic[];
}

export default function SpecValidityMetadata({ metadata, diagnostics }: SpecValidityMetadataProps) {
  const { failure_reason, diagnostic_counts, provenance } = metadata;

  const error = diagnostic_counts?.error ?? 0;
  const warning = diagnostic_counts?.warning ?? 0;
  const information = diagnostic_counts?.information ?? 0;
  const hint = diagnostic_counts?.hint ?? 0;
  const total = error + warning + information + hint;

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      {failure_reason && (
        <div className="text-xs text-red-600 mb-2">
          <span className="font-medium">Failure:</span> {failure_reason}
        </div>
      )}

      {diagnostic_counts && (
        <div className="text-xs text-gray-600 mb-2">
          <span className="font-medium">{total} diagnostics:</span>{' '}
          {error > 0 && <span className="text-red-600">{error} errors</span>}
          {error > 0 && (warning > 0 || information > 0 || hint > 0) && ', '}
          {warning > 0 && <span className="text-yellow-700">{warning} warnings</span>}
          {warning > 0 && (information > 0 || hint > 0) && ', '}
          {information > 0 && <span className="text-blue-600">{information} info</span>}
          {information > 0 && hint > 0 && ', '}
          {hint > 0 && <span className="text-gray-600">{hint} hints</span>}
          {total === 0 && <span className="text-green-600">No issues found</span>}
        </div>
      )}

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
