import { Format } from './format.ts';

export interface ScoreOptionsToValidate {
  format: Format;
  output?: string;
}

// Pure validation of cross-option constraints that Commander can't express on its
// own (a choice is only invalid in combination with another flag + the runtime).
// `stdoutIsTty` is injected rather than read from process so this stays unit-testable.
// Returns an error message to print, or null when the options are acceptable.
export function validateScoreOptions(
  options: ScoreOptionsToValidate,
  stdoutIsTty: boolean,
): string | null {
  // HTML and SARIF write machine-oriented documents, not terminal-friendly text.
  // Refuse to dump them into an interactive terminal; require either -o <file> or
  // a redirected stdout.
  const ext = options.format === Format.HTML ? 'html' : 'sarif';
  if (
    (options.format === Format.HTML || options.format === Format.SARIF) &&
    options.output === undefined &&
    stdoutIsTty
  ) {
    return (
      `--format ${options.format} writes a full document; refusing to print it to the terminal.\n` +
      `  Redirect it to a file:  … --format ${options.format} > scorecard.${ext}\n` +
      `  Or use -o:              … --format ${options.format} -o scorecard.${ext}`
    );
  }

  return null;
}
