import type { Diagnostic, Signal } from '../../types.ts';

import CountBasedMetadata from './CountBasedMetadata.tsx';

interface DescriptionCoverageMetadataProps {
  metadata: NonNullable<Signal['metadata']>;
  diagnostics?: Diagnostic[];
}

export default function DescriptionCoverageMetadata({
  metadata,
  diagnostics,
}: DescriptionCoverageMetadataProps) {
  return (
    <CountBasedMetadata kind="description_coverage" metadata={metadata} diagnostics={diagnostics} />
  );
}
