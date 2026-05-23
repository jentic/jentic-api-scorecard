import chalk from 'chalk';

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

export interface ScorecardResult {
  summary: ScorecardSummary;
}

function colorGrade(grade: string): string {
  if (grade.startsWith('A')) return chalk.green(grade);
  if (grade.startsWith('B')) return chalk.green(grade);
  if (grade.startsWith('C')) return chalk.yellow(grade);
  return chalk.red(grade);
}

function colorScore(score: number, formatted: string): string {
  if (score >= 80) return chalk.green(formatted);
  if (score >= 60) return chalk.yellow(formatted);
  return chalk.red(formatted);
}

export function formatPretty(result: ScorecardResult, source: string): string {
  const { summary } = result;
  const lines: string[] = [];

  lines.push(chalk.bold('Jentic API Readiness Scorecard'));
  lines.push(`${chalk.dim('Source:')} ${source}`);
  lines.push('');
  const scoreStr = colorScore(summary.score, summary.score.toFixed(2));
  lines.push(`  Final score:    ${scoreStr} ${chalk.dim('/ 100')}`);
  lines.push(`  Readiness:      ${chalk.bold(summary.level)}  (${colorGrade(summary.grade)})`);

  if (summary.dimensions && summary.dimensions.length > 0) {
    lines.push('');
    lines.push(chalk.bold('  Dimensions'));

    const kindWidth = Math.max(...summary.dimensions.map((d) => d.kind.length));
    const nameWidth = Math.max(...summary.dimensions.map((d) => d.name.length));

    for (const dim of summary.dimensions) {
      const kind = chalk.cyan(dim.kind.padEnd(kindWidth));
      const name = dim.name.padEnd(nameWidth);
      const score = colorScore(dim.score, dim.score.toFixed(2).padStart(6));
      const grade = colorGrade(dim.grade);
      lines.push(`    ${kind}  ${name}  ${score}  ${grade}`);
    }

    lines.push('');
    lines.push(chalk.dim('  Run with --detail signals for signal breakdown.'));
    lines.push(chalk.dim('  Full report: --format json --detail diagnostics'));
  }

  lines.push('');
  return lines.join('\n');
}
