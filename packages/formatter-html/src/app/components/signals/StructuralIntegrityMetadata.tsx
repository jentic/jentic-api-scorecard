import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

import Icon from './shared/Icon.tsx';
import { getPercentageTextColorClass, getProgressBarColorClass } from './shared/colors.ts';

interface StructuralIntegrityMeta {
  structural_issues: number;
  structural_issue_threshold: number;
  category_counts?: Record<string, number>;
  provenance?: Provenance;
}

interface StructuralIntegrityMetadataProps {
  metadata: StructuralIntegrityMeta;
  diagnostics?: Diagnostic[];
  score?: number;
}

export default function StructuralIntegrityMetadata({
  metadata,
  diagnostics,
  score,
}: StructuralIntegrityMetadataProps) {
  const { structural_issues, structural_issue_threshold, category_counts, provenance } = metadata;
  // Engine signal scores are 0-1; the distance bar is a 0-100 percentage.
  const percentage = (score ?? 0) * 100;
  const categories = category_counts ? Object.entries(category_counts) : [];

  return (
    <div
      className="mt-3 pt-3 border-t border-[var(--sc-border,#e5e7eb)] cursor-default space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      {structural_issues === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/30 px-3 py-2">
          <Icon name="check-circle" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            No structural issues
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--sc-text-muted,#9ca3af)]">
              Distance to collapse threshold
            </span>
            <div className="flex items-center gap-1">
              <span
                className={`font-mono font-semibold ${getPercentageTextColorClass(percentage)}`}
              >
                {percentage.toFixed(0)}%
              </span>
              <span className="text-[var(--sc-text-muted,#9ca3af)] text-[10px]">
                (away from collapse threshold)
              </span>
            </div>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--sc-section,#f3f4f6)]">
            <div
              className={`h-full rounded-full transition-all ${getProgressBarColorClass(percentage)}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          <p className="text-[var(--sc-text-muted,#9ca3af)] text-xs">
            Structural issues:{' '}
            <span className="text-[var(--sc-text-primary,#111827)] font-mono font-medium">
              {structural_issues}
            </span>{' '}
            / {structural_issue_threshold} (collapse threshold)
          </p>
        </div>
      )}

      {categories.length > 0 && (
        <div className="space-y-1">
          <div className="text-[var(--sc-text-muted,#9ca3af)] text-[10px] font-medium uppercase tracking-wide">
            By Category
          </div>
          <div className="grid grid-cols-2 gap-1">
            {categories.map(([category, count]) => (
              <div
                key={category}
                className="bg-[var(--sc-section,#f3f4f6)] flex items-center justify-between rounded px-2 py-1 text-xs"
              >
                <span className="text-[var(--sc-text-muted,#9ca3af)] truncate capitalize">
                  {category.replace(/_/g, ' ')}
                </span>
                <span className="font-mono font-medium">{count}</span>
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
