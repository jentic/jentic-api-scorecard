import type { ApiMetadata, EngineMetadata, Summary } from '../types.ts';

import CircularProgress from './CircularProgress.tsx';
import { getGradeColor } from './scoreColors.ts';

// Engine version is `<engine>+jairf.<framework>` (e.g. `0.4.1+jairf.1.0.0`). Mirror
// the CLI pretty formatter: strip the `jairf.` name token, keep the full framework
// version, and omit the framework segment entirely when it is absent (no fake
// fallback versions). Returns null when there is no engine version to show.
function formatEngineLine(version: string | undefined): string | null {
  if (!version) return null;
  const match = /^([^+]+)(?:\+jairf\.(.+))?$/.exec(version);
  const engineVer = match?.[1] ?? version;
  const frameworkVer = match?.[2];
  const parts: string[] = [];
  if (frameworkVer) parts.push(`Scoring Framework ${frameworkVer}`);
  parts.push(`Scoring Engine ${engineVer}`);
  return parts.join(' | ');
}

interface SummaryCardProps {
  apiMetadata: ApiMetadata;
  summary: Summary;
  metadata?: EngineMetadata;
}

export default function SummaryCard({ apiMetadata, summary, metadata }: SummaryCardProps) {
  const engineLine = formatEngineLine(metadata?.engine?.version);

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* Main content */}
      <div className="p-6">
        {/* Title row */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold text-sm">
              {apiMetadata.name.charAt(0).toUpperCase()}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{apiMetadata.name}</h1>
            <span className="text-gray-500 text-lg">
              - {summary.level.charAt(0).toUpperCase() + summary.level.slice(1)}{' '}
              <span className="font-semibold" style={{ color: getGradeColor(summary.grade) }}>
                ({summary.grade})
              </span>
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className="text-5xl font-black tabular-nums leading-none"
              style={{ color: getGradeColor(summary.grade) }}
            >
              {Math.round(summary.score)}
            </span>
            <span
              className="text-xl font-semibold"
              style={{ color: getGradeColor(summary.grade), opacity: 0.7 }}
            >
              /100
            </span>
          </div>
        </div>

        {/* Dimension circles - horizontal row. `dimensions` is absent at --detail
            summary; omit the whole row then so there's no empty band. */}
        {summary.dimensions && summary.dimensions.length > 0 && (
          <div className="flex justify-between items-start mb-8 gap-2">
            {summary.dimensions.map((dim) => (
              <div key={dim.kind} className="flex flex-col items-center text-center flex-1">
                <CircularProgress
                  score={dim.score}
                  size={90}
                  strokeWidth={7}
                  labelSize="text-2xl"
                />
                <span className="mt-3 text-xs text-gray-600 leading-tight max-w-[100px]">
                  {dim.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Stats bar - horizontal */}
        <div className="flex items-stretch gap-3 pt-6 border-t border-gray-200">
          <StatItem label="OPERATIONS" value={apiMetadata.operationCount} />
          <StatItem label="SCHEMAS" value={apiMetadata.schemaCount} />
          <StatItem label="TAGS" value={apiMetadata.tagCount} />
          <StatItem label="SECURITY SCHEMES" value={apiMetadata.securitySchemeCount} />
          <StatItem label="SECURITY TYPES" value={apiMetadata.securitySchemeTypes?.length || 0} />
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 flex items-center justify-between text-xs text-gray-500 border-t border-gray-200">
        <span>
          Powered by{' '}
          <a
            href="https://jentic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 font-semibold hover:underline"
          >
            Jentic
          </a>
        </span>
        {engineLine && <span>{engineLine}</span>}
      </div>
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: number;
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 min-w-0">
      <div className="min-w-0">
        <div className="text-[10px] text-gray-500 uppercase tracking-wide truncate">{label}</div>
        <div className="text-lg font-bold text-gray-900">{value}</div>
      </div>
    </div>
  );
}
