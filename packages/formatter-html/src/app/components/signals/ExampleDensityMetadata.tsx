import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

interface ExampleDensityMeta {
  present_examples: number;
  expected_examples: number;
  provenance?: Provenance;
}

interface ExampleDensityMetadataProps {
  metadata: ExampleDensityMeta;
  diagnostics?: Diagnostic[];
}

export default function ExampleDensityMetadata({
  metadata,
  diagnostics,
}: ExampleDensityMetadataProps) {
  const { present_examples, expected_examples, provenance } = metadata;

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      <dl className="text-xs text-gray-600 space-y-0.5">
        <div className="flex gap-2">
          <dt className="font-medium">Present examples:</dt>
          <dd className="font-mono">{present_examples}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Expected examples:</dt>
          <dd className="font-mono">{expected_examples}</dd>
        </div>
      </dl>

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
