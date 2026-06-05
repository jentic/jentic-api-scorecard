import { useState } from 'react';

import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

interface OperationScored {
  operation_id: string;
  element_descriptive_score: number;
  clarity_score: number;
  depth_score: number;
  issues_found?: string[];
}

interface DescriptiveRichnessMeta {
  number_of_describable_elements: number;
  operations_with_issues: number;
  operations_without_issues: number;
  operations_scored?: OperationScored[];
  provenance?: Provenance;
}

interface DescriptiveRichnessMetadataProps {
  metadata: DescriptiveRichnessMeta;
  diagnostics?: Diagnostic[];
}

export default function DescriptiveRichnessMetadata({
  metadata,
  diagnostics,
}: DescriptiveRichnessMetadataProps) {
  const {
    number_of_describable_elements,
    operations_with_issues,
    operations_without_issues,
    operations_scored,
    provenance,
  } = metadata;

  const [showOperations, setShowOperations] = useState(false);

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      <dl className="text-xs text-gray-600 space-y-0.5">
        <div className="flex gap-2">
          <dt className="font-medium">Describable elements:</dt>
          <dd className="font-mono">{number_of_describable_elements}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Operations with issues:</dt>
          <dd
            className={`font-mono ${operations_with_issues > 0 ? 'text-yellow-600' : 'text-green-600'}`}
          >
            {operations_with_issues}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium">Operations without issues:</dt>
          <dd className={`font-mono ${operations_without_issues > 0 ? 'text-green-600' : ''}`}>
            {operations_without_issues}
          </dd>
        </div>
      </dl>

      {operations_scored && operations_scored.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            className="text-xs font-medium text-gray-600 hover:text-gray-900 underline cursor-pointer"
            onClick={() => setShowOperations(!showOperations)}
          >
            {showOperations ? 'Hide' : 'Show'} operation details ({operations_scored.length})
          </button>

          {showOperations && (
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {operations_scored.map((op, index) => (
                <div key={index} className="text-xs p-2 bg-gray-50 rounded border border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-medium text-gray-700">{op.operation_id}</span>
                    <span
                      className={`font-mono ${op.element_descriptive_score >= 1.5 ? 'text-green-600' : op.element_descriptive_score >= 1 ? 'text-yellow-600' : 'text-red-600'}`}
                      title="Element descriptive score (clarity + depth)"
                    >
                      {op.element_descriptive_score.toFixed(1)}
                    </span>
                  </div>
                  <div className="mt-1 text-gray-500 flex gap-3">
                    <span>Clarity: {op.clarity_score.toFixed(1)}</span>
                    <span>Depth: {op.depth_score.toFixed(1)}</span>
                  </div>
                  {op.issues_found && op.issues_found.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {op.issues_found.map((issue, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded text-[10px]"
                        >
                          {issue.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
