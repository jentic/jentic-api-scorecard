import ora, { type Ora } from 'ora';

// Single process-wide spinner — concurrent score invocations would interleave.
let spinner: Ora | null = null;
let quiet = false;
let noSpinner = false;
// Tracks the last message printed in no-spinner mode to suppress exact duplicates
// (spin() can be called with the same message when bundling + LLM are both active).
let lastPlainMessage = '';

export function setQuiet(value: boolean): void {
  quiet = value;
}

export function setNoSpinner(value: boolean): void {
  noSpinner = value;
  lastPlainMessage = '';
}

export function spin(message: string): void {
  if (quiet) {
    return;
  }
  if (noSpinner) {
    if (message !== lastPlainMessage) {
      lastPlainMessage = message;
      process.stderr.write(`${message}\n`);
    }
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
  if (noSpinner) {
    lastPlainMessage = '';
    process.stderr.write(`${message}\n`);
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
