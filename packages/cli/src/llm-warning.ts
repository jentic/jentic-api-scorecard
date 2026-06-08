import { ScorecardResult } from './result.ts';

const LLM_ANALYSIS_ERROR_CODE = 'llm-analysis-error';
const SEMANTIC_ANALYSIS_CODE = 'semantic-analysis-summary';

export interface AffectedSignal {
  signal: string;
  dimension: string;
}

export interface LlmFailureWarning {
  affectedSignals: AffectedSignal[];
  cause?: string;
}

function provenanceCodes(metadata: Record<string, unknown> | undefined): string[] {
  const provenance = metadata?.['provenance'];
  if (typeof provenance !== 'object' || provenance === null) {
    return [];
  }
  const diagnostics = (provenance as Record<string, unknown>)['diagnostics'];
  if (typeof diagnostics !== 'object' || diagnostics === null) {
    return [];
  }
  const codes = (diagnostics as Record<string, unknown>)['code'];
  return Array.isArray(codes) ? codes.filter((c): c is string => typeof c === 'string') : [];
}

// A signal is LLM-derived when its provenance cites the semantic analyzer's
// summary diagnostic. When the LLM call fails the engine still returns these
// signals at a defaulted (perfect) score rather than omitting them, so we read
// provenance to name exactly which signals were inflated — rather than hard-coding
// a list that would drift as the engine's LLM-backed calculators grow.
function collectAffectedSignals(result: ScorecardResult): AffectedSignal[] {
  const affected: AffectedSignal[] = [];
  for (const group of result.details ?? []) {
    for (const dimension of group.dimensions ?? []) {
      for (const signal of dimension.signals ?? []) {
        if (provenanceCodes(signal.metadata).includes(SEMANTIC_ANALYSIS_CODE)) {
          affected.push({ signal: signal.name, dimension: dimension.name });
        }
      }
    }
  }
  return affected;
}

// The engine signals LLM failure two ways depending on the cause: an explicit
// llm-analysis-error diagnostic (provider auth/model errors), or — for
// connectivity failures — a silent semantic-analysis-summary reporting batches
// attempted but zero operations analyzed. Either means the LLM-derived signals
// defaulted to a perfect score, so detect both.
function semanticAnalysisAborted(diagnostic: { data?: Record<string, unknown> }): boolean {
  const data = diagnostic.data ?? {};
  const batches = data['batches_processed'];
  const analyzed = data['total_operations_analyzed'];
  return typeof batches === 'number' && batches > 0 && analyzed === 0;
}

export function detectLlmFailure(result: ScorecardResult): LlmFailureWarning | null {
  const diagnostics = result.diagnostics ?? [];
  const errors = diagnostics.filter((d) => d.code === LLM_ANALYSIS_ERROR_CODE);
  const aborted = diagnostics.some(
    (d) => d.code === SEMANTIC_ANALYSIS_CODE && semanticAnalysisAborted(d),
  );
  if (errors.length === 0 && !aborted) {
    return null;
  }
  return { affectedSignals: collectAffectedSignals(result), cause: errors[0]?.message };
}

export function formatLlmFailureWarning(warning: LlmFailureWarning): string {
  const lines: string[] = [];
  const count = warning.affectedSignals.length;
  const noun = count === 1 ? 'signal' : 'signals';

  lines.push(
    count > 0
      ? `warning: LLM analysis failed; ${count} LLM-derived ${noun} defaulted to a perfect score.`
      : `warning: LLM analysis failed; LLM-derived signals defaulted to a perfect score.`,
  );

  for (const { signal, dimension } of warning.affectedSignals) {
    lines.push(`  - ${signal} (${dimension})`);
  }

  lines.push(
    `  These signals are scored by the LLM; on failure they default to 100, which`,
    `  inflates the affected dimension(s) and the overall score. The scorecard above`,
    `  is NOT a true --with-llm result.`,
  );

  if (warning.cause !== undefined && warning.cause !== '') {
    lines.push(`  Cause: ${warning.cause}`);
  }

  lines.push(`  Re-run with --detail diagnostics for the full error.`);

  return lines.join('\n') + '\n';
}
