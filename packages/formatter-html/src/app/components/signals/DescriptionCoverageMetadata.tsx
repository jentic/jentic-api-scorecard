import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

interface DescriptionCoverageMeta {
  described_elements: number;
  undescribed_elements: number;
  describable_elements: number;
  provenance?: Provenance;
}

interface DescriptionCoverageMetadataProps {
  metadata: DescriptionCoverageMeta;
  diagnostics?: Diagnostic[];
}

export default function DescriptionCoverageMetadata({
  metadata,
  diagnostics,
}: DescriptionCoverageMetadataProps) {
  const { described_elements, undescribed_elements, describable_elements, provenance } = metadata;

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      <dl className="text-xs text-gray-600 space-y-0.5">
        <div className="flex gap-2">
          <dt className="font-medium">Described elements:</dt>
          <dd className={`font-mono ${described_elements > 0 ? 'text-green-600' : ''}`}>
            {described_elements}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Undescribed elements:</dt>
          <dd className={`font-mono ${undescribed_elements > 0 ? 'text-yellow-600' : ''}`}>
            {undescribed_elements}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Describable elements:</dt>
          <dd className="font-mono">{describable_elements}</dd>
        </div>
      </dl>

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
