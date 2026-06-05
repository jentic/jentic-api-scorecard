import type { Diagnostic, Signal } from '../../types.ts';

import CountBasedMetadata from './CountBasedMetadata.tsx';

interface ResponseCoverageMetadataProps {
  metadata: NonNullable<Signal['metadata']>;
  diagnostics?: Diagnostic[];
}

export default function ResponseCoverageMetadata({
  metadata,
  diagnostics,
}: ResponseCoverageMetadataProps) {
  return (
    <CountBasedMetadata kind="response_coverage" metadata={metadata} diagnostics={diagnostics} />
  );
}
