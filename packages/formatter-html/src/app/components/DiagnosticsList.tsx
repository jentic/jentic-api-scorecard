import { useState } from 'react';

import type { Diagnostic, Provenance } from '../types.ts';

// Severity mapping: 1=Error, 2=Warning, 3=Information, 4=Hint
const SEVERITY_CONFIG = {
  1: {
    label: 'Error',
    color:
      'bg-red-100 text-red-800 border-red-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40',
    activeColor: 'bg-red-500 text-white',
  },
  2: {
    label: 'Warning',
    color:
      'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40',
    activeColor: 'bg-yellow-500 text-white',
  },
  3: {
    label: 'Information',
    color:
      'bg-blue-100 text-blue-800 border-blue-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800/40',
    activeColor: 'bg-blue-500 text-white',
  },
  4: {
    label: 'Hint',
    color:
      'bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-700/40',
    activeColor: 'bg-gray-500 text-white',
  },
} as const;

type SeverityKey = keyof typeof SEVERITY_CONFIG;
type ActiveFilter = 'all' | SeverityKey;

const SEVERITY_KEYS: SeverityKey[] = [1, 2, 3, 4];

/**
 * Filter diagnostics based on provenance criteria.
 * Provenance can filter by: severity, code, source.
 */
function filterDiagnosticsByProvenance(
  diagnostics: Diagnostic[] | undefined,
  provenance: Provenance | undefined,
): Diagnostic[] {
  if (!diagnostics || !provenance?.diagnostics) return diagnostics || [];

  const { severity, code, source } = provenance.diagnostics;

  return diagnostics.filter((diag) => {
    if (severity && !severity.includes(diag.severity)) return false;
    if (code && !code.includes(diag.code)) return false;
    if (source && !source.includes(diag.source)) return false;
    return true;
  });
}

function groupBySeverity(diagnostics: Diagnostic[]): Record<SeverityKey, Diagnostic[]> {
  const groups: Record<SeverityKey, Diagnostic[]> = { 1: [], 2: [], 3: [], 4: [] };
  diagnostics.forEach((diag) => {
    if (diag.severity in groups) {
      groups[diag.severity as SeverityKey].push(diag);
    }
  });
  return groups;
}

interface DiagnosticsListProps {
  diagnostics: Diagnostic[];
  provenance: Provenance;
}

export default function DiagnosticsList({ diagnostics, provenance }: DiagnosticsListProps) {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');

  const filteredByProvenance = filterDiagnosticsByProvenance(diagnostics, provenance);
  const groupedDiagnostics = groupBySeverity(filteredByProvenance);

  const displayDiagnostics =
    activeFilter === 'all' ? filteredByProvenance : groupedDiagnostics[activeFilter] || [];

  const counts = {
    all: filteredByProvenance.length,
    1: groupedDiagnostics[1].length,
    2: groupedDiagnostics[2].length,
    3: groupedDiagnostics[3].length,
    4: groupedDiagnostics[4].length,
  };

  if (filteredByProvenance.length === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-[var(--sc-border,#e5e7eb)] text-sm text-[var(--sc-text-muted,#9ca3af)]">
        No matching diagnostics for this signal.
      </div>
    );
  }

  return (
    <div
      className="mt-3 pt-3 border-t border-[var(--sc-border,#e5e7eb)] cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Filter buttons */}
      <div className="flex flex-wrap gap-1 mb-3">
        <FilterButton
          label="All"
          count={counts.all}
          active={activeFilter === 'all'}
          onClick={() => setActiveFilter('all')}
        />
        {SEVERITY_KEYS.map((severity) => {
          const config = SEVERITY_CONFIG[severity];
          const count = counts[severity];
          return (
            <FilterButton
              key={severity}
              label={config.label}
              count={count}
              active={activeFilter === severity}
              color={config.color}
              activeColor={config.activeColor}
              onClick={() => setActiveFilter(severity)}
              disabled={count === 0}
            />
          );
        })}
      </div>

      {/* Diagnostics list */}
      <div className="max-h-60 overflow-y-auto space-y-2">
        {displayDiagnostics.length === 0 ? (
          <div className="text-sm text-[var(--sc-text-muted,#9ca3af)] py-2">
            No diagnostics for this severity level.
          </div>
        ) : (
          displayDiagnostics.map((diag) => (
            // Key by the diagnostic's index in the stable provenance-filtered array
            // (not the severity-filtered list's index) so React keeps each item's
            // local expand state bound to the right row across filter changes.
            <DiagnosticItem key={filteredByProvenance.indexOf(diag)} diagnostic={diag} />
          ))
        )}
      </div>
    </div>
  );
}

interface FilterButtonProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: string;
  activeColor?: string;
  disabled?: boolean;
}

function FilterButton({
  label,
  count,
  active,
  onClick,
  color = 'bg-[var(--sc-section,#f3f4f6)] text-[var(--sc-text-secondary,#6b7280)]',
  activeColor = 'bg-gray-700 text-white',
  disabled = false,
}: FilterButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
        disabled
          ? 'bg-[var(--sc-section,#f3f4f6)] text-[var(--sc-text-muted,#9ca3af)] cursor-not-allowed'
          : active
            ? `${activeColor} cursor-pointer`
            : `${color} hover:opacity-80 cursor-pointer`
      }`}
      onClick={disabled ? undefined : onClick}
    >
      {label} ({count})
    </button>
  );
}

interface DiagnosticItemProps {
  diagnostic: Diagnostic;
}

function DiagnosticItem({ diagnostic }: DiagnosticItemProps) {
  const [pathsExpanded, setPathsExpanded] = useState(false);
  const { code, message, severity, source, data } = diagnostic;
  const config = SEVERITY_CONFIG[severity as SeverityKey] || SEVERITY_CONFIG[3];

  const paths = data?.paths && data.paths.length > 0 ? data.paths : null;
  const singlePath = !paths && data?.path && data.path.length > 0 ? formatPath(data.path) : null;

  const VISIBLE_PATHS_COUNT = 3;
  const hasMorePaths = paths && paths.length > VISIBLE_PATHS_COUNT;
  const visiblePaths = paths ? (pathsExpanded ? paths : paths.slice(0, VISIBLE_PATHS_COUNT)) : [];

  return (
    <div className={`p-2 rounded border ${config.color} text-xs`}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono font-semibold">{code}</span>
        <span className="text-[10px] opacity-70">{source}</span>
      </div>
      <p className="mt-1 text-gray-700 dark:text-slate-300">{message}</p>

      {/* Single path display */}
      {singlePath && (
        <p className="mt-1 font-mono text-[10px] opacity-70 truncate" title={singlePath}>
          {singlePath}
        </p>
      )}

      {/* Multiple paths display */}
      {paths && (
        <div className="mt-1">
          <div className="space-y-0.5">
            {visiblePaths.map((pathArray, idx) => (
              <p
                key={idx}
                className="font-mono text-[10px] opacity-70 truncate"
                title={formatPath(pathArray)}
              >
                {formatPath(pathArray)}
              </p>
            ))}
          </div>
          {hasMorePaths && (
            <button
              type="button"
              className="mt-1 text-[10px] font-medium underline cursor-pointer opacity-80 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                setPathsExpanded(!pathsExpanded);
              }}
            >
              {pathsExpanded
                ? 'Show less'
                : `Show ${paths.length - VISIBLE_PATHS_COUNT} more paths...`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatPath(pathArray: unknown): string {
  if (!Array.isArray(pathArray)) return String(pathArray);
  return pathArray.join(' → ');
}
