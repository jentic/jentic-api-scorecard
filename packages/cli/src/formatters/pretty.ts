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

export function formatPretty(result: ScorecardResult, source: string): string {
  const { summary } = result;
  const lines: string[] = [];

  lines.push('Jentic API Readiness Scorecard');
  lines.push(`Source: ${source}`);
  lines.push('');
  lines.push(`  Final score:    ${summary.score.toFixed(2)} / 100`);
  lines.push(`  Readiness:      ${summary.level}  (${summary.grade})`);

  if (summary.dimensions && summary.dimensions.length > 0) {
    lines.push('');
    lines.push('  Dimensions');

    const kindWidth = Math.max(...summary.dimensions.map((d) => d.kind.length));
    const nameWidth = Math.max(...summary.dimensions.map((d) => d.name.length));

    for (const dim of summary.dimensions) {
      const kind = dim.kind.padEnd(kindWidth);
      const name = dim.name.padEnd(nameWidth);
      const score = dim.score.toFixed(2).padStart(6);
      lines.push(`    ${kind}  ${name}  ${score}  ${dim.grade}`);
    }

    lines.push('');
    lines.push('  Run with --detail signals for signal breakdown.');
    lines.push('  Full report: --format json --detail diagnostics');
  }

  lines.push('');
  return lines.join('\n');
}
