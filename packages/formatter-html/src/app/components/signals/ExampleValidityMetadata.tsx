import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

interface ExampleValidityMeta {
  valid_examples: number;
  invalid_examples: number;
  total_examples: number;
  provenance?: Provenance;
}

interface ExampleValidityMetadataProps {
  metadata: ExampleValidityMeta;
  diagnostics?: Diagnostic[];
}

export default function ExampleValidityMetadata({
  metadata,
  diagnostics,
}: ExampleValidityMetadataProps) {
  const { valid_examples, invalid_examples, total_examples, provenance } = metadata;

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      <dl className="text-xs text-gray-600 space-y-0.5">
        <div className="flex gap-2">
          <dt className="font-medium">Valid examples:</dt>
          <dd className={`font-mono ${valid_examples > 0 ? 'text-green-600' : ''}`}>
            {valid_examples}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Invalid examples:</dt>
          <dd className={`font-mono ${invalid_examples > 0 ? 'text-red-600' : ''}`}>
            {invalid_examples}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Total examples:</dt>
          <dd className="font-mono">{total_examples}</dd>
        </div>
      </dl>

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
