import type { Diagnostic, Signal } from '../../types.ts';

import CountBasedMetadata from './CountBasedMetadata.tsx';

interface SummaryCoverageMetadataProps {
  metadata: NonNullable<Signal['metadata']>;
  diagnostics?: Diagnostic[];
}

export default function SummaryCoverageMetadata({
  metadata,
  diagnostics,
}: SummaryCoverageMetadataProps) {
  return (
    <CountBasedMetadata kind="summary_coverage" metadata={metadata} diagnostics={diagnostics} />
  );
}
