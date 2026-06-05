import { useState } from 'react';

import type { Diagnostic } from '../types.ts';

// Severity mapping: 1=Error, 2=Warning, 3=Information, 4=Hint
const SEVERITY_CONFIG = {
  1: {
    label: 'Error',
    color: 'bg-red-100 text-red-800 border-red-200',
    activeColor: 'bg-red-500 text-white',
  },
  2: {
    label: 'Warning',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    activeColor: 'bg-yellow-500 text-white',
  },
  3: {
    label: 'Information',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    activeColor: 'bg-blue-500 text-white',
  },
  4: {
    label: 'Hint',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    activeColor: 'bg-gray-500 text-white',
  },
} as const;

type SeverityKey = keyof typeof SEVERITY_CONFIG;
type ActiveFilter = 'all' | SeverityKey;

const SEVERITY_KEYS: SeverityKey[] = [1, 2, 3, 4];

function groupBySeverity(diagnostics: Diagnostic[]): Record<SeverityKey, Diagnostic[]> {
  const groups: Record<SeverityKey, Diagnostic[]> = { 1: [], 2: [], 3: [], 4: [] };
  diagnostics.forEach((diag) => {
    if (diag.severity in groups) {
      groups[diag.severity as SeverityKey].push(diag);
    }
  });
  return groups;
}

interface DiagnosticsSectionProps {
  diagnostics?: Diagnostic[];
}

export default function DiagnosticsSection({ diagnostics }: DiagnosticsSectionProps) {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [pathsExpanded, setPathsExpanded] = useState<Record<number, boolean>>({});

  if (!diagnostics || diagnostics.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Diagnostics</h2>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-gray-500">No diagnostics found.</p>
        </div>
      </div>
    );
  }

  const groupedDiagnostics = groupBySeverity(diagnostics);

  const displayDiagnostics =
    activeFilter === 'all' ? diagnostics : groupedDiagnostics[activeFilter] || [];

  const counts = {
    all: diagnostics.length,
    1: groupedDiagnostics[1].length,
    2: groupedDiagnostics[2].length,
    3: groupedDiagnostics[3].length,
    4: groupedDiagnostics[4].length,
  };

  const togglePaths = (index: number) => {
    setPathsExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Diagnostics</h2>
        <span className="text-gray-600">{diagnostics.length} total</span>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Filter buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
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
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {displayDiagnostics.length === 0 ? (
            <p className="text-gray-500 py-4">No diagnostics for this severity level.</p>
          ) : (
            displayDiagnostics.map((diag) => {
              // Key by the diagnostic's index in the full, stable array (not the
              // filtered list's index) so expand state stays bound to the right row
              // when the severity filter changes.
              const stableIndex = diagnostics.indexOf(diag);
              return (
                <DiagnosticItem
                  key={stableIndex}
                  diagnostic={diag}
                  pathsExpanded={pathsExpanded[stableIndex]}
                  onTogglePaths={() => togglePaths(stableIndex)}
                />
              );
            })
          )}
        </div>
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
  color = 'bg-gray-100 text-gray-700',
  activeColor = 'bg-gray-700 text-white',
  disabled = false,
}: FilterButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
        disabled
          ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
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
  pathsExpanded?: boolean;
  onTogglePaths: () => void;
}

function DiagnosticItem({ diagnostic, pathsExpanded, onTogglePaths }: DiagnosticItemProps) {
  const { code, message, severity, source, data } = diagnostic;
  const config = SEVERITY_CONFIG[severity as SeverityKey] || SEVERITY_CONFIG[3];

  const paths = data?.paths && data.paths.length > 0 ? data.paths : null;
  const singlePath = !paths && data?.path && data.path.length > 0 ? formatPath(data.path) : null;

  const VISIBLE_PATHS_COUNT = 3;
  const hasMorePaths = paths && paths.length > VISIBLE_PATHS_COUNT;
  const visiblePaths = paths ? (pathsExpanded ? paths : paths.slice(0, VISIBLE_PATHS_COUNT)) : [];

  return (
    <div className={`p-3 rounded border ${config.color}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono font-semibold text-sm">{code}</span>
        <span className="text-xs opacity-70">{source}</span>
      </div>
      <p className="mt-1 text-sm text-gray-700">{message}</p>

      {singlePath && (
        <p className="mt-2 font-mono text-xs opacity-70 truncate" title={singlePath}>
          {singlePath}
        </p>
      )}

      {paths && (
        <div className="mt-2">
          <div className="space-y-0.5">
            {visiblePaths.map((pathArray, idx) => (
              <p
                key={idx}
                className="font-mono text-xs opacity-70 truncate"
                title={formatPath(pathArray)}
              >
                {formatPath(pathArray)}
              </p>
            ))}
          </div>
          {hasMorePaths && (
            <button
              type="button"
              className="mt-1 text-xs font-medium text-gray-600 hover:text-gray-900 underline cursor-pointer"
              onClick={onTogglePaths}
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
