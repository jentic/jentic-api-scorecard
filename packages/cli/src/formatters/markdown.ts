import { DEFAULT_DETAIL, DetailLevel } from '../detail.ts';
import { Diagnostic, ScorecardResult } from '../result.ts';
import { cliVersion } from '../version.ts';

const SEVERITY_LABELS: Record<number, string> = {
  1: 'error',
  2: 'warning',
  3: 'info',
  4: 'hint',
};

function severityLabel(sev: number): string {
  return SEVERITY_LABELS[sev] ?? `severity ${sev}`;
}

// GFM cell sanitiser: a literal pipe ends the cell, and a newline ends the row,
// so escape the former and collapse the latter to a space. Backslashes are
// escaped first — otherwise an input like `\|` would be left as a real
// backslash followed by an unescaped pipe, breaking the cell.
function escapeCell(s: string): string {
  return s
    .replace(/[\r\n]+/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|');
}

export interface FormatMarkdownOptions {
  detail?: DetailLevel;
}

export function formatMarkdown(
  result: ScorecardResult,
  options: FormatMarkdownOptions = {},
): string {
  const detail = options.detail ?? DEFAULT_DETAIL;
  const { summary, apiMetadata, metadata, details, diagnostics } = result;
  const lines: string[] = [];

  lines.push(`# API Readiness Scorecard`);
  lines.push('');

  if (apiMetadata?.name) {
    const version = apiMetadata.apiDescriptionVersion
      ? ` v${apiMetadata.apiDescriptionVersion}`
      : '';
    lines.push(`**${apiMetadata.name}**${version}`);
    lines.push('');
  }

  lines.push(
    `Score **${Math.round(summary.score)}** / 100 — ${summary.level.toUpperCase()} (${summary.grade})`,
  );

  const engineRaw = metadata?.engine?.version;
  if (engineRaw) {
    const match = /^([^+]+)(?:\+jairf\.(.+))?$/.exec(engineRaw);
    const engineVer = match?.[1] ?? engineRaw;
    const frameworkVer = match?.[2];
    const parts: string[] = [];
    if (frameworkVer) parts.push(`Scoring Framework ${frameworkVer}`);
    parts.push(`Scoring Engine ${engineVer}`);
    lines.push('');
    lines.push(`_${parts.join(' | ')} · CLI v${cliVersion}_`);
  }

  const showDimensions = detail !== DetailLevel.SUMMARY;

  if (showDimensions && summary.dimensions && summary.dimensions.length > 0) {
    lines.push('');
    lines.push(`## Dimensions`);
    lines.push('');
    lines.push(`| Kind | Name | Score | Grade |`);
    lines.push(`| --- | --- | --- | --- |`);
    for (const dim of summary.dimensions) {
      const score = Math.round(dim.score);
      lines.push(
        `| ${escapeCell(dim.kind)} | ${escapeCell(dim.name)} | ${score} | ${escapeCell(dim.grade)} |`,
      );
    }
  }

  if (apiMetadata) {
    const stats: string[] = [];
    if (apiMetadata.operationCount !== undefined) {
      stats.push(`**${apiMetadata.operationCount}** operations`);
    }
    if (apiMetadata.schemaCount !== undefined) {
      stats.push(`**${apiMetadata.schemaCount}** schemas`);
    }
    if (apiMetadata.tagCount !== undefined) {
      stats.push(`**${apiMetadata.tagCount}** tags`);
    }
    if (apiMetadata.securitySchemeCount !== undefined) {
      stats.push(`**${apiMetadata.securitySchemeCount}** security schemes`);
    }
    if (stats.length > 0) {
      lines.push('');
      lines.push(stats.join(' · '));
    }
  }

  if (detail === DetailLevel.SIGNALS || detail === DetailLevel.DIAGNOSTICS) {
    appendSignals(lines, details);
  }

  if (detail === DetailLevel.DIAGNOSTICS) {
    appendDiagnostics(lines, diagnostics);
  }

  lines.push('');
  return lines.join('\n');
}

function appendSignals(lines: string[], details: ScorecardResult['details']): void {
  if (!details || details.length === 0) return;

  const hasAnySignal = details.some((g) =>
    (g.dimensions ?? []).some((d) => (d.signals ?? []).length > 0),
  );
  if (!hasAnySignal) return;

  lines.push('');
  lines.push(`## Signals`);

  for (const group of details) {
    for (const dim of group.dimensions ?? []) {
      const signals = dim.signals ?? [];
      if (signals.length === 0) continue;

      const stats: string[] = [];
      if (dim.score !== undefined) stats.push(Math.round(dim.score).toString());
      if (dim.grade) stats.push(dim.grade);
      const trailer = stats.length > 0 ? ` (${stats.join(' / ')})` : '';

      lines.push('');
      lines.push(`### ${escapeCell(dim.kind)} — ${escapeCell(dim.name)}${trailer}`);
      lines.push('');
      lines.push(`| Signal | Score | Description |`);
      lines.push(`| --- | --- | --- |`);
      for (const signal of signals) {
        const score = `${Math.round(signal.score * 100)}%`;
        const description = signal.description ? escapeCell(signal.description) : '';
        lines.push(`| ${escapeCell(signal.name)} | ${score} | ${description} |`);
      }
    }
  }
}

function appendDiagnostics(lines: string[], diagnostics: Diagnostic[] | undefined): void {
  lines.push('');
  lines.push(`## Diagnostics`);
  lines.push('');

  if (!diagnostics || diagnostics.length === 0) {
    lines.push(`0 diagnostics`);
    return;
  }

  const grouped = new Map<number, Diagnostic[]>();
  for (const diag of diagnostics) {
    const list = grouped.get(diag.severity) ?? [];
    list.push(diag);
    grouped.set(diag.severity, list);
  }

  const pluralizableSeverities: Record<number, boolean> = { 1: true, 2: true, 4: true };
  const order = [1, 2, 3, 4];

  const tallyParts: string[] = [];
  for (const sev of order) {
    const items = grouped.get(sev);
    if (!items?.length) continue;
    const base = severityLabel(sev);
    const label = pluralizableSeverities[sev] && items.length !== 1 ? `${base}s` : base;
    tallyParts.push(`${items.length} ${label}`);
  }
  // Every diagnostic could carry a severity outside the 1–4 order, leaving the
  // tally empty — drop the em dash in that case rather than dangling it.
  const tally = tallyParts.length > 0 ? ` — ${tallyParts.join(' · ')}` : '';
  lines.push(`**${diagnostics.length}** diagnostics${tally}`);

  lines.push('');
  lines.push(`| Code | Severity | Message |`);
  lines.push(`| --- | --- | --- |`);
  for (const sev of order) {
    const items = grouped.get(sev);
    if (!items?.length) continue;
    for (const diag of items) {
      const code = escapeCell(diag.code ?? '');
      const message = escapeCell(diag.message);
      lines.push(`| ${code} | ${severityLabel(sev)} | ${message} |`);
    }
  }
}
