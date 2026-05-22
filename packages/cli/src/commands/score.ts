import { existsSync, statSync } from 'node:fs';

import { bundleLocalSpec } from '../bundle.js';
import { runDocker } from '../docker.js';

export interface ScoreOptions {
  withLlm?: boolean;
}

function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

function isExistingFile(input: string): boolean {
  try {
    return existsSync(input) && statSync(input).isFile();
  } catch {
    return false;
  }
}

export async function runScore(input: string, options: ScoreOptions): Promise<number> {
  const containerArgs: string[] = ['score'];
  if (options.withLlm) {
    containerArgs.push('--with-llm');
  }

  const forwardJenticKey = process.env.JENTIC_API_KEY !== undefined;

  if (isUrl(input)) {
    containerArgs.push('--url', input);
    const result = await runDocker({
      args: containerArgs,
      forwardJenticKey,
    });
    return result.exitCode;
  }

  if (isExistingFile(input)) {
    let bundled: string;
    try {
      bundled = await bundleLocalSpec(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`error: failed to bundle ${input}: ${message}\n`);
      return 1;
    }

    const result = await runDocker({
      args: containerArgs,
      stdinPayload: bundled,
      forwardJenticKey,
    });
    return result.exitCode;
  }

  process.stderr.write(
    `error: input '${input}' is neither a URL (http://, https://) nor an existing file.\n`,
  );
  return 1;
}
