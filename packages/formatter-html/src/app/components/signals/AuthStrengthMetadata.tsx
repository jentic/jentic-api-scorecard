import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

interface AuthScheme {
  type: string;
  score: number;
  details?: {
    flows?: string[];
    in?: string;
    name?: string;
  };
}

interface AuthStrengthMeta {
  schemes_count: number;
  schemes?: AuthScheme[];
  provenance?: Provenance;
}

interface AuthStrengthMetadataProps {
  metadata: AuthStrengthMeta;
  diagnostics?: Diagnostic[];
}

export default function AuthStrengthMetadata({ metadata, diagnostics }: AuthStrengthMetadataProps) {
  const { schemes_count, schemes, provenance } = metadata;

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      <dl className="text-xs text-gray-600 space-y-0.5">
        <div className="flex gap-2">
          <dt className="font-medium">Security schemes:</dt>
          <dd className="font-mono">{schemes_count}</dd>
        </div>
      </dl>

      {schemes && schemes.length > 0 && (
        <div className="mt-2 space-y-2">
          {schemes.map((scheme, index) => (
            <div key={index} className="text-xs p-2 bg-gray-50 rounded border border-gray-200">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-700">{scheme.type}</span>
                <span
                  className={`font-mono ${scheme.score >= 0.7 ? 'text-green-600' : scheme.score >= 0.4 ? 'text-yellow-600' : 'text-red-600'}`}
                >
                  {(scheme.score * 100).toFixed(0)}%
                </span>
              </div>
              {scheme.details && (
                <div className="mt-1 text-gray-500">
                  {scheme.details.flows && <span>Flows: {scheme.details.flows.join(', ')}</span>}
                  {scheme.details.in && (
                    <span>
                      In: {scheme.details.in} ({scheme.details.name})
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
