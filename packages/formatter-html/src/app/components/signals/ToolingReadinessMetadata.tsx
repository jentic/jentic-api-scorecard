import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

import Icon, { type IconName } from './shared/Icon.tsx';
import {
  TOOLING_READINESS_SCALE_COLORS,
  TOOLING_READINESS_THRESHOLDS,
  getToolingReadinessColors,
  getToolingReadinessLevel,
  getToolingReadinessMarkerPosition,
  getToolingReadinessScaleLabelColors,
  type ToolingReadinessLevel,
} from './shared/colors.ts';

interface ToolingReadinessMeta {
  ingestion_errors: number;
  threshold?: number;
  interpretation?: string;
  provenance?: Provenance;
}

interface ToolingReadinessMetadataProps {
  metadata: ToolingReadinessMeta;
  diagnostics?: Diagnostic[];
}

const LEVEL_ICON: Record<ToolingReadinessLevel, IconName> = {
  best: 'check-circle',
  ok: 'alert-triangle',
  poor: 'alert-triangle',
  critical: 'x-circle',
};

const { best, ok, poor } = TOOLING_READINESS_THRESHOLDS;
const SCALE_SEGMENTS: {
  level: ToolingReadinessLevel;
  width: string;
  label: string;
  range: string;
}[] = [
  { level: 'best', width: 'w-[20%]', label: 'Best', range: `0-${best}` },
  { level: 'ok', width: 'w-[27%]', label: 'OK', range: `${best + 1}-${ok}` },
  { level: 'poor', width: 'w-[33%]', label: 'Poor', range: `${ok + 1}-${poor}` },
  { level: 'critical', width: 'w-[20%]', label: 'Critical', range: `${poor + 1}+` },
];

export default function ToolingReadinessMetadata({
  metadata,
  diagnostics,
}: ToolingReadinessMetadataProps) {
  const { ingestion_errors, threshold, interpretation, provenance } = metadata;
  const level = getToolingReadinessLevel(ingestion_errors);
  const levelColors = getToolingReadinessColors(level);

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      {interpretation && (
        <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 ${levelColors.bg}`}>
          <Icon name={LEVEL_ICON[level]} className={`h-4 w-4 ${levelColors.icon}`} />
          <span className={`text-sm font-medium ${levelColors.text}`}>{interpretation}</span>
        </div>
      )}

      {ingestion_errors >= 0 && threshold !== undefined && threshold >= 0 && (
        <div className="bg-gray-50 rounded-md p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Ingestion Errors</span>
              <p className="text-[10px] text-gray-500">
                Fewer errors = better tooling compatibility
              </p>
            </div>
            <span className={`text-2xl font-bold ${levelColors.icon}`}>{ingestion_errors}</span>
          </div>

          <div className="relative pt-1">
            <div className="flex h-3 rounded-full overflow-hidden">
              {SCALE_SEGMENTS.map((seg) => (
                <div
                  key={seg.level}
                  className={`${seg.width} ${TOOLING_READINESS_SCALE_COLORS[seg.level]}`}
                />
              ))}
            </div>
            <div
              className="absolute top-0 w-0.5 h-5 bg-gray-900 rounded-full transition-all"
              style={{ left: `${getToolingReadinessMarkerPosition(ingestion_errors)}%` }}
            />
          </div>

          <div className="flex text-[9px]">
            {SCALE_SEGMENTS.map((seg) => (
              <div key={seg.level} className={`${seg.width} text-center`}>
                <span className={`${getToolingReadinessScaleLabelColors(seg.level)} font-medium`}>
                  {seg.label}
                </span>
                <br />
                <span className="text-gray-500">{seg.range}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
