import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

interface SummaryCoverageMeta {
  summaries_present: number;
  missing_summaries: number;
  summaries_expected: number;
  provenance?: Provenance;
}

interface SummaryCoverageMetadataProps {
  metadata: SummaryCoverageMeta;
  diagnostics?: Diagnostic[];
}

export default function SummaryCoverageMetadata({
  metadata,
  diagnostics,
}: SummaryCoverageMetadataProps) {
  const { summaries_present, missing_summaries, summaries_expected, provenance } = metadata;

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      <dl className="text-xs text-gray-600 space-y-0.5">
        <div className="flex gap-2">
          <dt className="font-medium">Summaries present:</dt>
          <dd className={`font-mono ${summaries_present > 0 ? 'text-green-600' : ''}`}>
            {summaries_present}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Missing summaries:</dt>
          <dd className={`font-mono ${missing_summaries > 0 ? 'text-yellow-600' : ''}`}>
            {missing_summaries}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Summaries expected:</dt>
          <dd className="font-mono">{summaries_expected}</dd>
        </div>
      </dl>

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
