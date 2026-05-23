import ora, { type Ora } from 'ora';

// Single process-wide spinner — concurrent score invocations would interleave.
let spinner: Ora | null = null;

export function spin(message: string): void {
  if (spinner) {
    spinner.text = message;
    return;
  }
  spinner = ora({ text: message, stream: process.stderr }).start();
}

export function done(message: string): void {
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
