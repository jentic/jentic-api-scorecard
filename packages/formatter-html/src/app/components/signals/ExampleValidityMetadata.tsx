import type { Diagnostic, Signal } from '../../types.ts';

import CountBasedMetadata from './CountBasedMetadata.tsx';

interface ExampleValidityMetadataProps {
  metadata: NonNullable<Signal['metadata']>;
  diagnostics?: Diagnostic[];
}

export default function ExampleValidityMetadata({
  metadata,
  diagnostics,
}: ExampleValidityMetadataProps) {
  return (
    <CountBasedMetadata kind="example_validity" metadata={metadata} diagnostics={diagnostics} />
  );
}
