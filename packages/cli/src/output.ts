import { randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, openSync, renameSync, unlinkSync, writeSync } from 'node:fs';
import { resolve } from 'node:path';
import stripAnsi from 'strip-ansi';

export function writeReport(content: string, filePath: string): void {
  const absPath = resolve(filePath);
  // Temp must live next to <file> so renameSync stays on one filesystem
  // (no EXDEV). Don't move this to os.tmpdir().
  const tmpPath = `${absPath}.tmp-${randomUUID()}`;
  // Pretty output goes through chalk, which keys colour on stdout's TTY
  // state — when -o redirects to a file we want plain text, not the codes
  // chalk produced for the terminal we never wrote to.
  const payload = stripAnsi(content);
  let fd: number | undefined;
  try {
    fd = openSync(tmpPath, 'w');
    writeSync(fd, payload);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(tmpPath, absPath);
  } catch (err) {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // ignore — the original error is what the caller cares about
      }
    }
    try {
      unlinkSync(tmpPath);
    } catch {
      // temp may not exist; that's fine
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`failed to write ${absPath}: ${message}`);
  }
}
