import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

import Icon from './shared/Icon.tsx';
import {
  getDiagnosticSeverityColors,
  getSpecValidityColors,
  getSpecValidityFailureBoxColors,
  type DiagnosticSeverityName,
} from './shared/colors.ts';

interface DiagnosticCounts {
  error?: number;
  warning?: number;
  information?: number;
  hint?: number;
}

interface SpecValidityMeta {
  failure_reason?: string;
  diagnostic_counts?: DiagnosticCounts;
  provenance?: Provenance;
}

interface SpecValidityMetadataProps {
  metadata: SpecValidityMeta;
  diagnostics?: Diagnostic[];
  score?: number;
}

const SEVERITY_CHIPS: {
  key: keyof DiagnosticCounts;
  name: DiagnosticSeverityName;
  icon: 'x-circle' | 'alert-triangle' | 'info';
}[] = [
  { key: 'error', name: 'error', icon: 'x-circle' },
  { key: 'warning', name: 'warning', icon: 'alert-triangle' },
  { key: 'information', name: 'information', icon: 'info' },
];

export default function SpecValidityMetadata({
  metadata,
  diagnostics,
  score,
}: SpecValidityMetadataProps) {
  const { failure_reason, diagnostic_counts, provenance } = metadata;
  const passed = score === 1;
  const colors = getSpecValidityColors(passed);

  const error = diagnostic_counts?.error ?? 0;
  const warning = diagnostic_counts?.warning ?? 0;
  const information = diagnostic_counts?.information ?? 0;
  const hint = diagnostic_counts?.hint ?? 0;
  const total = error + warning + information + hint;
  const counts: Record<keyof DiagnosticCounts, number> = { error, warning, information, hint };

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 ${colors.bg}`}>
          <Icon name={passed ? 'check-circle' : 'x-circle'} className={`h-4 w-4 ${colors.icon}`} />
          <span className={`text-sm font-semibold ${colors.text}`}>
            {passed ? 'Passed' : 'Failed'}
          </span>
        </div>
        {total > 0 && (
          <div className="flex items-center gap-1.5">
            {SEVERITY_CHIPS.map(({ key, name, icon }) => {
              const count = counts[key];
              if (count <= 0) return null;
              const chip = getDiagnosticSeverityColors(name);
              return (
                <div
                  key={key}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 ${chip.bg}`}
                >
                  <Icon name={icon} className={`h-3 w-3 ${chip.icon}`} />
                  <span className={`text-xs font-medium ${chip.text}`}>{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!passed && failure_reason && <FailureBox reason={failure_reason} />}

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}

function FailureBox({ reason }: { reason: string }) {
  const box = getSpecValidityFailureBoxColors();
  return (
    <div className={`rounded-md border ${box.border} ${box.bg} p-2.5`}>
      <div className="flex items-start gap-2">
        <Icon name="x-circle" className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${box.icon}`} />
        <p className={`text-xs ${box.text}`}>{reason}</p>
      </div>
    </div>
  );
}
