// Ordered highest-first so find() returns the first matching band.
// minScore: 0 on the last entry means getScoreColor always finds a match.
const BANDS = [
  { minScore: 70, letter: 'A', color: 'hsl(142, 71%, 45%)' }, // excellent — green
  { minScore: 60, letter: 'B', color: 'hsl(165, 82%, 35%)' }, // good — teal
  { minScore: 50, letter: 'C', color: 'hsl(45, 93%, 47%)' }, // fair — amber
  { minScore: 40, letter: 'D', color: 'hsl(25, 95%, 53%)' }, // poor — orange
  { minScore: 0, letter: 'F', color: 'hsl(0, 84%, 60%)' }, // failing — red
] as const;

const FAILING_COLOR = 'hsl(0, 84%, 60%)';

export function getScoreColor(score: number): string {
  return BANDS.find((b) => score >= b.minScore)?.color ?? FAILING_COLOR;
}

export function getGradeColor(grade: string): string {
  const letter = grade.charAt(0);
  return BANDS.find((b) => b.letter === letter)?.color ?? FAILING_COLOR;
}
