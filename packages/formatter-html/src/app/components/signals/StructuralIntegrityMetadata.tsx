import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

const CATEGORY_LABELS: Record<string, string> = {
  invalid_model_shape: 'Invalid model shape',
  contradictory_typing: 'Contradictory typing',
  impossible_constraints: 'Impossible constraints',
  broken_polymorphism: 'Broken polymorphism',
  request_response_undefined: 'Request/response undefined',
  non_evaluable_example: 'Non-evaluable example',
  unresolvable_or_circular_schema: 'Unresolvable/circular schema',
};

interface StructuralIntegrityMeta {
  structural_issues: number;
  structural_issue_threshold: number;
  category_counts?: Record<string, number>;
  provenance?: Provenance;
}

interface StructuralIntegrityMetadataProps {
  metadata: StructuralIntegrityMeta;
  diagnostics?: Diagnostic[];
}

export default function StructuralIntegrityMetadata({
  metadata,
  diagnostics,
}: StructuralIntegrityMetadataProps) {
  const { structural_issues, structural_issue_threshold, category_counts, provenance } = metadata;

  const categories = category_counts ? Object.entries(category_counts) : [];

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-xs text-gray-600 mb-2">
        <span className="font-medium">Structural Issues:</span>{' '}
        {structural_issues === 0 ? (
          <span className="text-green-600">None found</span>
        ) : (
          <span className="text-red-600">{structural_issues} issues</span>
        )}
        <span className="text-gray-500"> (threshold: {structural_issue_threshold})</span>
      </div>

      {categories.length > 0 && (
        <div className="text-xs text-gray-600 mb-2">
          <span className="font-medium">By category:</span>
          <dl className="mt-1 space-y-0.5">
            {categories.map(([category, count]) => (
              <div
                key={category}
                className={`flex gap-2 ${count > 0 ? 'text-red-600' : 'text-gray-500'}`}
              >
                <dt>{CATEGORY_LABELS[category] || category}:</dt>
                <dd className="font-mono">{count}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
