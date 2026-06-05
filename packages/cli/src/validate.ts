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
  // HTML is a full document, not terminal-friendly. Refuse to dump it into an
  // interactive terminal; require either -o <file> or a redirected stdout.
  if (options.format === Format.HTML && options.output === undefined && stdoutIsTty) {
    return (
      `--format html writes a full HTML document; refusing to print it to the terminal.\n` +
      `  Redirect it to a file:  … --format html > scorecard.html\n` +
      `  Or use -o:              … --format html -o scorecard.html`
    );
  }

  return null;
}
