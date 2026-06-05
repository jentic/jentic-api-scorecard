import type { Diagnostic, Signal } from '../../types.ts';

import CountBasedMetadata from './CountBasedMetadata.tsx';

interface ErrorStandardizationMetadataProps {
  metadata: NonNullable<Signal['metadata']>;
  diagnostics?: Diagnostic[];
}

export default function ErrorStandardizationMetadata({
  metadata,
  diagnostics,
}: ErrorStandardizationMetadataProps) {
  return (
    <CountBasedMetadata
      kind="error_standardization"
      metadata={metadata}
      diagnostics={diagnostics}
    />
  );
}
