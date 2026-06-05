import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

interface ResolutionCompletenessMeta {
  total_refs: number;
  resolved_refs: number;
  unresolved_refs: number;
  provenance?: Provenance;
}

interface ResolutionCompletenessMetadataProps {
  metadata: ResolutionCompletenessMeta;
  diagnostics?: Diagnostic[];
}

export default function ResolutionCompletenessMetadata({
  metadata,
  diagnostics,
}: ResolutionCompletenessMetadataProps) {
  const { total_refs, resolved_refs, unresolved_refs, provenance } = metadata;

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-xs text-gray-600 mb-2">
        <span className="font-medium">Reference Resolution:</span>{' '}
        <span className="text-green-600">{resolved_refs} resolved</span>
        {unresolved_refs > 0 && (
          <>
            {' / '}
            <span className="text-red-600">{unresolved_refs} unresolved</span>
          </>
        )}{' '}
        <span className="text-gray-500">of {total_refs} total</span>
      </div>

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
