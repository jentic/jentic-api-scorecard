import type { ApiMetadata, EngineMetadata, Summary } from '../types.ts';

import ApiMetadataCard from './ApiMetadataCard.tsx';
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
  showApiMetadata?: boolean;
}

export default function SummaryCard({
  apiMetadata,
  summary,
  metadata,
  showApiMetadata = true,
}: SummaryCardProps) {
  const engineLine = formatEngineLine(metadata?.engine?.version);

  return (
    <div className="bg-[var(--sc-bg,#ffffff)] rounded-lg shadow-lg border border-[var(--sc-border,#e5e7eb)] overflow-hidden">
      {/* Main content */}
      <div className="p-6">
        {/* Title row */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--sc-section,#f3f4f6)] rounded-full flex items-center justify-center text-[var(--sc-text-secondary,#6b7280)] font-bold text-sm">
              {apiMetadata.name.charAt(0).toUpperCase()}
            </div>
            <h1 className="text-2xl font-bold text-[var(--sc-text-primary,#111827)]">
              {apiMetadata.name}
            </h1>
            <span className="text-[var(--sc-text-secondary,#6b7280)] text-lg">
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
                <span className="mt-3 text-xs text-[var(--sc-text-secondary,#6b7280)] leading-tight max-w-[100px]">
                  {dim.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Stats bar — rendered via ApiMetadataCard; hidden when showApiMetadata is false */}
        {showApiMetadata && <ApiMetadataCard apiMetadata={apiMetadata} />}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-[var(--sc-section,#f3f4f6)] flex items-center justify-between text-xs text-[var(--sc-text-muted,#9ca3af)] border-t border-[var(--sc-border,#e5e7eb)]">
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
