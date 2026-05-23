import { WriteStream } from 'node:tty';

const isTTY = process.stderr instanceof WriteStream && process.stderr.isTTY;

let currentLine = '';

function clearLine(): void {
  if (isTTY) {
    process.stderr.write('\r\x1b[K');
  }
}

export function spin(message: string): void {
  if (!isTTY) return;
  clearLine();
  currentLine = message;
  process.stderr.write(currentLine);
}

export function done(message: string): void {
  if (!isTTY) return;
  clearLine();
  currentLine = '';
  process.stderr.write(`${message}\n`);
}

export function hasSpinner(): boolean {
  return isTTY;
}

export function clearSpinner(): void {
  if (currentLine) {
    clearLine();
    currentLine = '';
  }
}
