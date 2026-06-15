import { DetailLevel } from './detail.ts';
import { Format } from './format.ts';

export interface ScoreOptionsToValidate {
  format: Format;
  output?: string;
  detail?: DetailLevel;
  // Whether --detail was passed on the command line (vs. left at its default).
  // Injected rather than read from Commander so this stays unit-testable.
  detailIsExplicit?: boolean;
}

export interface ScoreOptionsVerdict {
  // A fatal message: the caller prints it and exits non-zero.
  error: string | null;
  // A non-fatal advisory: the caller prints it and proceeds.
  warning: string | null;
}

// Pure validation of cross-option constraints that Commander can't express on its
// own (a choice is only invalid in combination with another flag + the runtime).
// `stdoutIsTty` is injected rather than read from process so this stays unit-testable.
export function validateScoreOptions(
  options: ScoreOptionsToValidate,
  stdoutIsTty: boolean,
): ScoreOptionsVerdict {
  // HTML is a full document, not terminal-friendly. Refuse to dump it into an
  // interactive terminal; require either -o <file> or a redirected stdout. SARIF,
  // json, and markdown are plain text and stay printable to a TTY.
  if (options.format === Format.HTML && options.output === undefined && stdoutIsTty) {
    return {
      error:
        `--format html writes a full HTML document; refusing to print it to the terminal.\n` +
        `  Redirect it to a file:  … --format html > scorecard.html\n` +
        `  Or use -o:              … --format html -o scorecard.html`,
      warning: null,
    };
  }

  // SARIF always emits the full diagnostics, so --detail has no effect. Warn (don't
  // fail) when it was set explicitly to something other than diagnostics, so the
  // override is visible rather than silent.
  if (
    options.format === Format.SARIF &&
    options.detailIsExplicit === true &&
    options.detail !== DetailLevel.DIAGNOSTICS
  ) {
    return {
      error: null,
      warning:
        `--detail ${options.detail} is ignored with --format sarif; ` +
        `SARIF always includes the full diagnostics.`,
    };
  }

  return { error: null, warning: null };
}
