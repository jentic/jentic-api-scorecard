import ora, { type Ora } from 'ora';

// Single process-wide spinner — concurrent score invocations would interleave.
let spinner: Ora | null = null;
let quiet = false;

export function setQuiet(value: boolean): void {
  quiet = value;
}

export function spin(message: string): void {
  if (quiet) {
    return;
  }
  if (spinner) {
    spinner.text = message;
    return;
  }
  spinner = ora({ text: message, stream: process.stderr }).start();
}

export function done(message: string): void {
  if (quiet) {
    return;
  }
  if (spinner) {
    spinner.succeed(message);
    spinner = null;
    return;
  }
  process.stderr.write(`${message}\n`);
}

export function clearSpinner(): void {
  if (spinner) {
    spinner.stop();
    spinner = null;
  }
}
