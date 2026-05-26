import { randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, openSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import stripAnsi from 'strip-ansi';

import { Format } from './format.ts';

export function writeReport(content: string, filePath: string, format: Format): void {
  const absPath = resolve(filePath);
  // Temp must live next to <file> so renameSync stays on one filesystem
  // (no EXDEV). Don't move this to os.tmpdir().
  const tmpPath = `${absPath}.tmp-${randomUUID()}`;
  // Pretty output goes through chalk, which keys colour on stdout's TTY
  // state — when -o redirects to a file we want plain text on disk. JSON
  // is engine-verbatim per docs/architecture.md §7, so leave it alone.
  const payload = format === Format.PRETTY ? stripAnsi(content) : content;
  try {
    // flush: true was added in Node 20.10 / 21.0 and is always present
    // for our `engines` range; older Nodes silently ignore the option.
    writeFileSync(tmpPath, payload, { flush: true });
    renameSync(tmpPath, absPath);
    fsyncDir(dirname(absPath));
  } catch (err) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // temp may not exist; that's fine
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`failed to write ${absPath}: ${message}`);
  }
}

// Persist the directory entry created by rename so the new file survives
// a power loss. POSIX requires this; Windows fsyncs of the directory
// itself are not meaningful and the API may EPERM — we tolerate that.
function fsyncDir(dir: string): void {
  let dirFd: number | undefined;
  try {
    dirFd = openSync(dir, 'r');
    fsyncSync(dirFd);
  } catch {
    // best-effort durability; not all platforms permit dir fsync.
  } finally {
    if (dirFd !== undefined) {
      try {
        closeSync(dirFd);
      } catch {
        // ignore
      }
    }
  }
}
