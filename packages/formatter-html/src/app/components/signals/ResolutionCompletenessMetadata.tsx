import type { Diagnostic, Signal } from '../../types.ts';

import CountBasedMetadata from './CountBasedMetadata.tsx';

interface ResolutionCompletenessMetadataProps {
  metadata: NonNullable<Signal['metadata']>;
  diagnostics?: Diagnostic[];
}

export default function ResolutionCompletenessMetadata({
  metadata,
  diagnostics,
}: ResolutionCompletenessMetadataProps) {
  return (
    <CountBasedMetadata
      kind="resolution_completeness"
      metadata={metadata}
      diagnostics={diagnostics}
    />
  );
}
