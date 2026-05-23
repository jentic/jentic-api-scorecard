import chalk from 'chalk';

import { cliVersion } from '../version.ts';

const BANNER = `     ██╗███████╗███╗   ██╗████████╗██╗ ██████╗
     ██║██╔════╝████╗  ██║╚══██╔══╝██║██╔════╝
     ██║█████╗  ██╔██╗ ██║   ██║   ██║██║
██   ██║██╔══╝  ██║╚██╗██║   ██║   ██║██║
╚█████╔╝███████╗██║ ╚████║   ██║   ██║╚██████╗
 ╚════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝ ╚═════╝`;

export interface Dimension {
  kind: string;
  name: string;
  score: number;
  grade: string;
}

export interface ScorecardSummary {
  score: number;
  level: string;
  grade: string;
  dimensions?: Dimension[];
}

export interface ApiMetadata {
  name?: string;
  apiDescriptionVersion?: string;
  operationCount?: number;
  schemaCount?: number;
  tagCount?: number;
  securitySchemeCount?: number;
  securitySchemeTypes?: string[];
}

export interface EngineMetadata {
  version?: string;
}

export interface Metadata {
  engine?: EngineMetadata;
}

export interface ScorecardResult {
  summary: ScorecardSummary;
  apiMetadata?: ApiMetadata;
  metadata?: Metadata;
}

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

export function formatPretty(result: ScorecardResult, source: string): string {
  const { summary, apiMetadata, metadata } = result;
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
  const finalScore = colorScore(summary.grade, summary.score.toFixed(2));
  lines.push(`  Final score:      ${chalk.bold(finalScore)} ${chalk.dim('/ 100')}`);
  lines.push(
    `  Readiness:        ${chalk.bold(summary.level.toUpperCase())}  (${colorGrade(summary.grade)})`,
  );

  if (summary.dimensions && summary.dimensions.length > 0) {
    lines.push('');
    lines.push(chalk.bold('  Dimensions'));
    lines.push('');

    const kindWidth = Math.max(...summary.dimensions.map((d) => d.kind.length));
    const nameWidth = Math.max(...summary.dimensions.map((d) => d.name.length));

    for (const dim of summary.dimensions) {
      const kind = chalk.cyan(dim.kind.padEnd(kindWidth));
      const name = dim.name.padEnd(nameWidth);
      const bar = scoreBar(dim.score);
      const score = dim.score.toFixed(2).padStart(6);
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

  if (summary.dimensions && summary.dimensions.length > 0) {
    lines.push('');
    lines.push(chalk.dim('  Run with --detail signals for signal breakdown.'));
    lines.push(chalk.dim('  Full report: --format json --detail diagnostics'));
  }

  lines.push('');
  return lines.join('\n');
}
