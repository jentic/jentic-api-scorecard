import chalk from 'chalk';

import { DEFAULT_DETAIL, DetailLevel } from '../detail.ts';
import { Diagnostic, ScorecardResult } from '../result.ts';
import { cliVersion } from '../version.ts';

const BANNER = `     ██╗███████╗███╗   ██╗████████╗██╗ ██████╗
     ██║██╔════╝████╗  ██║╚══██╔══╝██║██╔════╝
     ██║█████╗  ██╔██╗ ██║   ██║   ██║██║
██   ██║██╔══╝  ██║╚██╗██║   ██║   ██║██║
╚█████╔╝███████╗██║ ╚████║   ██║   ██║╚██████╗
 ╚════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝ ╚═════╝`;

export type { ScorecardResult } from '../result.ts';

function gradeColor(grade: string): (s: string) => string {
  if (grade.startsWith('A') || grade.startsWith('B')) return chalk.green;
  if (grade.startsWith('C')) return chalk.yellow;
  return chalk.red;
}

function colorGrade(grade: string): string {
  return gradeColor(grade)(grade);
}

function colorScore(grade: string, formatted: string): string {
  return gradeColor(grade)(formatted);
}

const BAR_WIDTH = 20;

function scoreBar(score: number): string {
  const filled = Math.round((score / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return chalk.white('▄'.repeat(filled)) + chalk.blackBright('▄'.repeat(empty));
}

// Signal scores are [0, 1] with no engine-emitted grade, so we band by raw
// threshold rather than reusing gradeColor (which keys off a grade letter).
function signalScoreColor(score: number): (s: string) => string {
  if (score >= 0.8) return chalk.green;
  if (score >= 0.5) return chalk.yellow;
  return chalk.red;
}

const SEVERITY_LABELS: Record<number, string> = {
  1: 'error',
  2: 'warning',
  3: 'info',
  4: 'hint',
};

function severityLabel(sev: number): string {
  return SEVERITY_LABELS[sev] ?? `severity ${sev}`;
}

function severityColor(sev: number): (s: string) => string {
  if (sev === 1) return chalk.red;
  if (sev === 2) return chalk.yellow;
  return chalk.dim;
}

export interface FormatPrettyOptions {
  detail?: DetailLevel;
}

export function formatPretty(
  result: ScorecardResult,
  source: string,
  options: FormatPrettyOptions = {},
): string {
  const detail = options.detail ?? DEFAULT_DETAIL;
  const { summary, apiMetadata, metadata, details, diagnostics } = result;
  const lines: string[] = [];

  lines.push('');
  lines.push(chalk.cyan(BANNER));
  lines.push(`${chalk.bold('  API Readiness Scorecard')} ${chalk.dim(`v${cliVersion}`)}`);

  const engineRaw = metadata?.engine?.version;
  if (engineRaw) {
    const match = /^([^+]+)(?:\+jairf\.(.+))?$/.exec(engineRaw);
    const engineVer = match?.[1] ?? engineRaw;
    const frameworkVer = match?.[2];
    const parts: string[] = [];
    if (frameworkVer) parts.push(`Scoring Framework ${frameworkVer}`);
    parts.push(`Scoring Engine ${engineVer}`);
    lines.push(chalk.dim(`  ${parts.join('  |  ')}`));
  }
  lines.push('');

  if (apiMetadata?.name) {
    const version = apiMetadata.apiDescriptionVersion
      ? chalk.dim(` v${apiMetadata.apiDescriptionVersion}`)
      : '';
    const heading = `${apiMetadata.name}${apiMetadata.apiDescriptionVersion ? ` v${apiMetadata.apiDescriptionVersion}` : ''}`;
    const divider = chalk.dim('─'.repeat(heading.length));
    lines.push(`  ${divider}`);
    lines.push(`  ${chalk.bold(apiMetadata.name)}${version}`);
    lines.push(`  ${divider}`);
    lines.push('');
  }

  lines.push(`  ${chalk.dim('OpenAPI Document:')} ${source}`);
  const finalScore = colorScore(summary.grade, Math.round(summary.score).toString());
  lines.push(`  Final score:      ${chalk.bold(finalScore)} ${chalk.dim('/ 100')}`);
  lines.push(
    `  Readiness:        ${chalk.bold(summary.level.toUpperCase())}  (${colorGrade(summary.grade)})`,
  );

  const showDimensions = detail !== DetailLevel.SUMMARY;

  if (showDimensions && summary.dimensions && summary.dimensions.length > 0) {
    lines.push('');
    lines.push(`  ${chalk.bold.underline('Dimensions')}`);
    lines.push('');

    const kindWidth = Math.max(...summary.dimensions.map((d) => d.kind.length));
    const nameWidth = Math.max(...summary.dimensions.map((d) => d.name.length));

    for (const dim of summary.dimensions) {
      const kind = chalk.cyan(dim.kind.padEnd(kindWidth));
      const name = dim.name.padEnd(nameWidth);
      const bar = scoreBar(dim.score);
      const score = Math.round(dim.score).toString().padStart(3);
      const grade = colorGrade(dim.grade.padEnd(2));
      lines.push(`    ${kind}  ${name}  ${bar}  ${score}  ${grade}`);
    }
  }

  if (apiMetadata) {
    const stat = (n: number, label: string): string => `${chalk.bold(n)} ${chalk.dim(label)}`;
    const stats: string[] = [];
    if (apiMetadata.operationCount !== undefined) {
      stats.push(stat(apiMetadata.operationCount, 'operations'));
    }
    if (apiMetadata.schemaCount !== undefined) {
      stats.push(stat(apiMetadata.schemaCount, 'schemas'));
    }
    if (apiMetadata.tagCount !== undefined) {
      stats.push(stat(apiMetadata.tagCount, 'tags'));
    }
    if (apiMetadata.securitySchemeCount !== undefined) {
      stats.push(stat(apiMetadata.securitySchemeCount, 'security schemes'));
    }
    if (apiMetadata.securitySchemeTypes && apiMetadata.securitySchemeTypes.length > 0) {
      stats.push(stat(apiMetadata.securitySchemeTypes.length, 'security types'));
    }
    if (stats.length > 0) {
      lines.push('');
      lines.push(`  ${stats.join(chalk.dim('  ·  '))}`);
    }
  }

  if (detail === DetailLevel.SIGNALS || detail === DetailLevel.DIAGNOSTICS) {
    appendSignals(lines, details);
  }

  if (detail === DetailLevel.DIAGNOSTICS) {
    appendDiagnostics(lines, diagnostics);
  }

  appendHint(lines, detail);

  lines.push('');
  return lines.join('\n');
}

function appendSignals(lines: string[], details: ScorecardResult['details']): void {
  if (!details || details.length === 0) return;

  lines.push('');
  lines.push(`  ${chalk.bold.underline('Signals')}`);

  const allSignals = details.flatMap((g) => (g.dimensions ?? []).flatMap((d) => d.signals ?? []));
  if (allSignals.length === 0) return;
  const nameWidth = Math.max(...allSignals.map((s) => s.name.length));

  let firstDim = true;
  for (const group of details) {
    const groupDimensions = group.dimensions ?? [];
    for (const dim of groupDimensions) {
      const signals = dim.signals ?? [];
      if (signals.length === 0) continue;

      lines.push('');
      if (!firstDim) lines.push('');
      firstDim = false;
      const stats: string[] = [];
      if (dim.score !== undefined) stats.push(Math.round(dim.score).toString());
      if (dim.grade) stats.push(colorGrade(dim.grade));
      const trailer = stats.length > 0 ? `  (${stats.join(' / ')})` : '';
      lines.push(`  ${chalk.cyan(dim.kind)}  ${chalk.bold(dim.name)}${trailer}`);

      const indent = 4;
      const termCols = process.stdout.columns ?? Number.POSITIVE_INFINITY;
      const maxRowWidth = Math.max(0, termCols - indent);

      const rows: string[] = [];
      let widest = 0;
      for (const signal of signals) {
        const name = signal.name.padEnd(nameWidth);
        const scoreNum = Math.round(signal.score * 100)
          .toString()
          .padStart(3);
        const scoreText = `${scoreNum}%`;
        const score = signalScoreColor(signal.score)(scoreText);
        const fixedWidth = name.length + 2 + scoreText.length;

        let descRaw = signal.description ?? '';
        let descSegment = '';
        if (descRaw) {
          const descBudget = maxRowWidth - fixedWidth - 2;
          if (descBudget <= 1) {
            descRaw = '';
          } else if (descRaw.length > descBudget) {
            descRaw = descRaw.slice(0, descBudget - 1) + '…';
          }
          descSegment = descRaw ? `  ${chalk.dim(descRaw)}` : '';
        }

        const visible = fixedWidth + (descRaw ? 2 + descRaw.length : 0);
        if (visible > widest) widest = visible;
        rows.push(`    ${name}  ${score}${descSegment}`);
      }

      const rule = chalk.dim('─'.repeat(widest));
      lines.push(`    ${rule}`);
      lines.push(...rows);
      lines.push(`    ${rule}`);
    }
  }
}

const DIAGNOSTIC_PREVIEW_LIMIT = 5;

function appendDiagnostics(lines: string[], diagnostics: Diagnostic[] | undefined): void {
  lines.push('');
  if (!diagnostics || diagnostics.length === 0) {
    lines.push(`  ${chalk.bold.underline('Diagnostics')}  ${chalk.dim('0')}`);
    return;
  }

  const grouped = new Map<number, Diagnostic[]>();
  for (const diag of diagnostics) {
    const list = grouped.get(diag.severity) ?? [];
    list.push(diag);
    grouped.set(diag.severity, list);
  }

  lines.push(
    `  ${chalk.bold.underline('Diagnostics')}  ${chalk.dim(diagnostics.length.toString())}`,
  );

  const pluralizableSeverities: Record<number, boolean> = { 1: true, 2: true, 4: true };
  const order = [1, 2, 3, 4];

  const tallyParts: string[] = [];
  for (const sev of order) {
    const items = grouped.get(sev);
    if (!items?.length) continue;
    const base = severityLabel(sev);
    const label = pluralizableSeverities[sev] && items.length !== 1 ? `${base}s` : base;
    tallyParts.push(severityColor(sev)(`${items.length} ${label}`));
  }
  if (tallyParts.length > 0) {
    lines.push(`    ${tallyParts.join(chalk.dim('  ·  '))}`);
  }

  const indent = 4;
  const termCols = process.stdout.columns ?? Number.POSITIVE_INFINITY;
  const maxRowWidth = Math.max(0, termCols - indent);

  for (const sev of order) {
    const items = grouped.get(sev);
    if (!items?.length) continue;

    const shown = items.slice(0, DIAGNOSTIC_PREVIEW_LIMIT);
    const codeWidth = Math.max(...shown.map((d) => (d.code ?? '').length));

    lines.push('');
    const base = severityLabel(sev);
    const label = pluralizableSeverities[sev] && items.length !== 1 ? `${base}s` : base;
    lines.push(`  ${severityColor(sev)(label)}  ${chalk.dim(`(${items.length})`)}`);

    for (const diag of shown) {
      const code = (diag.code ?? '').padEnd(codeWidth);
      const fixed = code.length + 2;
      const budget = maxRowWidth - fixed;
      let message = diag.message;
      if (budget > 1 && message.length > budget) {
        message = message.slice(0, budget - 1) + '…';
      }
      lines.push(`    ${chalk.bold(code)}  ${chalk.dim(message)}`);
    }

    if (items.length > shown.length) {
      lines.push(chalk.dim(`    … +${items.length - shown.length} more`));
    }
  }
}

const JSON_HINT_RECIPE = '--format json --detail diagnostics';

function appendHint(lines: string[], detail: DetailLevel): void {
  if (detail === DetailLevel.SUMMARY) {
    lines.push('');
    lines.push(chalk.dim('  Run with --detail dimensions for the dimension table.'));
    lines.push(chalk.dim(`  Full report: ${JSON_HINT_RECIPE}`));
    return;
  }

  if (detail === DetailLevel.DIMENSIONS) {
    lines.push('');
    lines.push(chalk.dim('  Run with --detail signals for signal breakdown.'));
    lines.push(chalk.dim(`  Full report: ${JSON_HINT_RECIPE}`));
    return;
  }

  if (detail === DetailLevel.SIGNALS) {
    lines.push('');
    lines.push(
      chalk.dim('  Run with --detail diagnostics for severity counts and a preview of findings.'),
    );
    lines.push(chalk.dim(`  Full evidence: ${JSON_HINT_RECIPE}`));
  }
}
