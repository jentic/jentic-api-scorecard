import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import stripAnsi from 'strip-ansi';

import { Format } from './format.ts';

export function writeReport(content: string, filePath: string, format: Format): void {
  const absPath = resolve(filePath);
  // Pretty output goes through chalk, which keys colour on stdout's TTY
  // state — when -o redirects to a file we want plain text on disk.
  // JSON content is left as the formatter emitted it.
  const payload = format === Format.PRETTY ? stripAnsi(content) : content;
  try {
    writeFileSync(absPath, payload, { flush: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`failed to write ${absPath}: ${message}`);
  }
}
