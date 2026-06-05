import type { Diagnostic, Signal } from '../../types.ts';

import CountBasedMetadata from './CountBasedMetadata.tsx';

interface ExampleDensityMetadataProps {
  metadata: NonNullable<Signal['metadata']>;
  diagnostics?: Diagnostic[];
}

export default function ExampleDensityMetadata({
  metadata,
  diagnostics,
}: ExampleDensityMetadataProps) {
  return (
    <CountBasedMetadata kind="example_density" metadata={metadata} diagnostics={diagnostics} />
  );
}
