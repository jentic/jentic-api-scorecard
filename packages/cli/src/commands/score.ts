import { existsSync, statSync } from 'node:fs';

import { bundleSpec } from '../bundle.ts';
import { DEFAULT_DETAIL, DetailLevel, filterByDetail } from '../detail.ts';
import { imageExists, imageRef, pullImage, runDocker } from '../docker.ts';
import { ExitCode } from '../exit-codes.ts';
import { formatPretty } from '../formatters/pretty.ts';
import { ScorecardResult } from '../result.ts';
import { spin, done, clearSpinner } from '../spinner.ts';

export interface ScoreOptions {
  withLlm?: boolean;
  detail?: DetailLevel;
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

export async function runScore(input: string, options: ScoreOptions): Promise<number> {
  const containerArgs: string[] = ['score'];
  if (options.withLlm) {
    containerArgs.push('--with-llm');
  }

  const apiKey = process.env['JENTIC_API_KEY'];
  const forwardJenticKey = apiKey !== undefined && apiKey !== '';

  let stdinPayload: string | undefined;
  const startTime = Date.now();

  if (isURL(input)) {
    containerArgs.push('--url', input);
  } else if (isExistingFile(input)) {
    spin(`Bundling ${input}…`);
    try {
      stdinPayload = await bundleSpec(input);
    } catch (err) {
      clearSpinner();
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`error: failed to bundle ${input}: ${message}\n`);
      return ExitCode.SPEC_FAILURE;
    }
  } else {
    process.stderr.write(
      `error: input '${input}' is neither an https:// URL nor an existing file.\n`,
    );
    return ExitCode.GENERIC_ERROR;
  }

  const ref = imageRef();
  const present = await imageExists(ref);
  if (!present) {
    spin(`Pulling ${ref}…`);
    const pullResult = await pullImage(ref);
    if (pullResult.exitCode !== 0) {
      clearSpinner();
      process.stderr.write(`error: failed to pull image ${ref}\n`);
      if (pullResult.stderr) {
        process.stderr.write(pullResult.stderr);
      }
      return pullResult.exitCode === ExitCode.DOCKER_MISSING
        ? ExitCode.DOCKER_MISSING
        : ExitCode.GENERIC_ERROR;
    }
  }

  spin(`Scoring…`);

  let result;
  try {
    result = await runDocker({
      args: containerArgs,
      stdinPayload,
      forwardJenticKey,
    });
  } catch (err) {
    clearSpinner();
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: failed to run docker: ${message}\n`);
    return ExitCode.GENERIC_ERROR;
  }

  if (result.exitCode !== 0) {
    clearSpinner();
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    return result.exitCode;
  }

  let parsed: ScorecardResult;
  try {
    parsed = JSON.parse(result.stdout) as ScorecardResult;
  } catch {
    clearSpinner();
    process.stderr.write(
      'warning: engine output was not valid JSON; passing through raw output.\n',
    );
    process.stdout.write(result.stdout);
    return ExitCode.SUCCESS;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  done(`Scoring done in ${elapsed}s`);

  const detail = options.detail ?? DEFAULT_DETAIL;
  const filtered = filterByDetail(parsed, detail);
  const output = formatPretty(filtered, input, { detail });
  process.stdout.write(output);

  return ExitCode.SUCCESS;
}
