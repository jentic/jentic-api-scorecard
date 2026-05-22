import { existsSync, statSync } from 'node:fs';

import { bundleSpec } from '../bundle.js';
import { runDocker } from '../docker.js';
import { ExitCode } from '../exit-codes.js';

export interface ScoreOptions {
  withLlm?: boolean;
}

function isURL(input: string): boolean {
  return /^https:\/\//i.test(input);
}

function isExistingFile(input: string): boolean {
  try {
    return existsSync(input) && statSync(input).isFile();
  } catch {
    return false;
  }
}

async function execDocker(opts: Parameters<typeof runDocker>[0]): Promise<number> {
  try {
    const result = await runDocker(opts);
    return result.exitCode;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: failed to run docker: ${message}\n`);
    return ExitCode.GENERIC_ERROR;
  }
}

export async function runScore(input: string, options: ScoreOptions): Promise<number> {
  const containerArgs: string[] = ['score'];
  if (options.withLlm) {
    containerArgs.push('--with-llm');
  }

  const apiKey = process.env['JENTIC_API_KEY'];
  const forwardJenticKey = apiKey !== undefined && apiKey !== '';

  if (isURL(input)) {
    containerArgs.push('--url', input);
    return execDocker({ args: containerArgs, forwardJenticKey });
  }

  if (isExistingFile(input)) {
    let bundled: string;
    try {
      bundled = await bundleSpec(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`error: failed to bundle ${input}: ${message}\n`);
      return ExitCode.SPEC_FAILURE;
    }

    return execDocker({ args: containerArgs, stdinPayload: bundled, forwardJenticKey });
  }

  process.stderr.write(
    `error: input '${input}' is neither an https:// URL nor an existing file.\n`,
  );
  return ExitCode.GENERIC_ERROR;
}
