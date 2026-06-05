import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

interface SeverityCounts {
  critical?: number;
  error?: number;
  warning?: number;
  info?: number;
  hint?: number;
}

interface LintResultsMeta {
  severity_counts?: SeverityCounts;
  weighted_cost?: number;
  max_cost?: number;
  provenance?: Provenance;
}

interface LintResultsMetadataProps {
  metadata: LintResultsMeta;
  diagnostics?: Diagnostic[];
}

export default function LintResultsMetadata({ metadata, diagnostics }: LintResultsMetadataProps) {
  const { severity_counts, weighted_cost, max_cost, provenance } = metadata;

  const critical = severity_counts?.critical ?? 0;
  const error = severity_counts?.error ?? 0;
  const warning = severity_counts?.warning ?? 0;
  const info = severity_counts?.info ?? 0;
  const hint = severity_counts?.hint ?? 0;
  const total = critical + error + warning + info + hint;

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      {severity_counts && (
        <div className="text-xs text-gray-600">
          <span className="font-medium">{total} issues:</span>{' '}
          {critical > 0 && <span className="text-red-700">{critical} critical</span>}
          {critical > 0 && (error > 0 || warning > 0 || info > 0 || hint > 0) && ', '}
          {error > 0 && <span className="text-red-600">{error} errors</span>}
          {error > 0 && (warning > 0 || info > 0 || hint > 0) && ', '}
          {warning > 0 && <span className="text-yellow-700">{warning} warnings</span>}
          {warning > 0 && (info > 0 || hint > 0) && ', '}
          {info > 0 && <span className="text-blue-600">{info} info</span>}
          {info > 0 && hint > 0 && ', '}
          {hint > 0 && <span className="text-gray-600">{hint} hints</span>}
          {total === 0 && <span className="text-green-600">No issues found</span>}
        </div>
      )}

      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
        <strong>How scoring works:</strong> Errors impact the score more than warnings, and warnings
        more than info.
      </div>

      {weighted_cost !== undefined &&
        weighted_cost >= 0 &&
        max_cost !== undefined &&
        max_cost >= 0 && (
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-50 flex items-center justify-between rounded px-2.5 py-2">
              <span className="text-gray-500">Weighted Cost</span>
              <span className="font-mono font-semibold">{weighted_cost.toFixed(2)}</span>
            </div>
            <div className="bg-gray-50 flex items-center justify-between rounded px-2.5 py-2">
              <span className="text-gray-500">Max Cost</span>
              <span className="font-mono font-semibold">{max_cost.toFixed(2)}</span>
            </div>
          </div>
        )}

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
