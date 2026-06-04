import { existsSync, statSync } from 'node:fs';

import { bundleSpec } from '../bundle.ts';
import { DEFAULT_DETAIL, DetailLevel, filterByDetail } from '../detail.ts';
import { imageExists, imageRef, pullImage, runDocker } from '../docker.ts';
import { ExitCode } from '../exit-codes.ts';
import { DEFAULT_FORMAT, Format } from '../format.ts';
import { formatJson } from '../formatters/json.ts';
import { formatPretty } from '../formatters/pretty.ts';
import { detectLlmEnv } from '../llm-env.ts';
import { writeReport } from '../output.ts';
import { ScorecardResult } from '../result.ts';
import { spin, done, clearSpinner, setQuiet } from '../spinner.ts';

export interface ScoreOptions {
  withLlm?: boolean;
  bundle?: boolean;
  detail?: DetailLevel;
  format?: Format;
  output?: string;
  quiet?: boolean;
}

export type ParseEngineOutputResult =
  | { ok: true; parsed: ScorecardResult }
  | { ok: false; exitCode: ExitCode; stderr: string; stdout: string };

function isScorecardShape(value: unknown): value is ScorecardResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  if (!('summary' in value)) {
    return false;
  }
  const summary = (value as { summary: unknown }).summary;
  if (typeof summary !== 'object' || summary === null || Array.isArray(summary)) {
    return false;
  }
  const s = summary as { score?: unknown; level?: unknown; grade?: unknown };
  return typeof s.score === 'number' && typeof s.level === 'string' && typeof s.grade === 'string';
}

export function tryParseEngineOutput(stdout: string, format: Format): ParseEngineOutputResult {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch {
    return invalidEngineOutput(format, stdout);
  }
  if (!isScorecardShape(value)) {
    return invalidEngineOutput(format, stdout);
  }
  return { ok: true, parsed: value };
}

function invalidEngineOutput(format: Format, stdout: string): ParseEngineOutputResult {
  if (format === Format.JSON) {
    return {
      ok: false,
      exitCode: ExitCode.ENGINE_FAILURE,
      stderr: 'error: engine output was not a valid scorecard.\n',
      stdout: '',
    };
  }
  return {
    ok: false,
    exitCode: ExitCode.SUCCESS,
    stderr: 'warning: engine output was not a valid scorecard; passing through raw output.\n',
    stdout,
  };
}

function isURL(input: string): boolean {
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
  setQuiet(options.quiet === true);

  const containerArgs: string[] = ['score'];
  if (options.withLlm) {
    containerArgs.push('--with-llm');
  }

  const apiKey = process.env['JENTIC_API_KEY'];
  const forwardJenticKey = apiKey !== undefined && apiKey !== '';

  let forwardEnvVars: string[] = [];
  let forwardEnvOverrides = new Map<string, string>();
  let needsHostNetwork = false;

  if (options.withLlm) {
    const detection = detectLlmEnv(process.env);
    if (!detection.hasUsableProvider) {
      process.stderr.write(
        `error: --with-llm requires an LLM provider but none was detected.\n` +
          `\n` +
          `Cloud recipe (set one credential + routing variables):\n` +
          `  export OPENAI_API_KEY=<key>        # or ANTHROPIC_API_KEY, GEMINI_API_KEY, or AWS key pair\n` +
          `  export LLM_PROVIDER=OPENAI          # match the credential\n` +
          `  export LIGHT_LLM_PROVIDER=OPENAI    # lightweight model provider\n` +
          `  export LLM_LIGHT_MODEL=<model>      # e.g. gpt-4o-mini\n` +
          `\n` +
          `  Without LLM_LIGHT_MODEL the engine falls back to a Bedrock model ID\n` +
          `  and the run will fail for non-Bedrock providers.\n` +
          `\n` +
          `Local recipe (OpenAI-compatible endpoint, e.g. Ollama):\n` +
          `  export LLM_PROVIDER=OPENAI\n` +
          `  export LIGHT_LLM_PROVIDER=OPENAI\n` +
          `  export OPENAI_API_URL=http://localhost:11434/v1/chat/completions\n` +
          `  export OPENAI_API_KEY=ollama        # any non-empty value\n` +
          `  export LLM_MODEL=<your-model>       # e.g. llama3.1:8b\n` +
          `  export LLM_LIGHT_MODEL=<your-model>\n`,
      );
      return ExitCode.GENERIC_ERROR;
    }
    forwardEnvVars = detection.forwardEnvVars;
    forwardEnvOverrides = detection.forwardEnvOverrides;
    needsHostNetwork = detection.needsHostNetwork;
  }

  let stdinPayload: string | undefined;
  const startTime = Date.now();

  if (isURL(input)) {
    if (options.bundle) {
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
      containerArgs.push('--url', input);
    }
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
      `error: input '${input}' is neither an http(s):// URL nor an existing file.\n`,
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
      forwardEnvVars,
      forwardEnvOverrides,
      needsHostNetwork,
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

  const format = options.format ?? DEFAULT_FORMAT;

  const parseResult = tryParseEngineOutput(result.stdout, format);
  if (!parseResult.ok) {
    clearSpinner();
    process.stderr.write(parseResult.stderr);
    if (parseResult.stdout) {
      if (options.output !== undefined) {
        try {
          writeReport(parseResult.stdout, options.output, format);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          process.stderr.write(`error: ${message}\n`);
          return ExitCode.GENERIC_ERROR;
        }
      } else {
        process.stdout.write(parseResult.stdout);
      }
    }
    return parseResult.exitCode;
  }
  const parsed = parseResult.parsed;

  const detail = options.detail ?? DEFAULT_DETAIL;
  const filtered = filterByDetail(parsed, detail);
  const output =
    format === Format.JSON ? formatJson(filtered) : formatPretty(filtered, input, { detail });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (options.output !== undefined) {
    try {
      writeReport(output, options.output, format);
    } catch (err) {
      clearSpinner();
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`error: ${message}\n`);
      return ExitCode.GENERIC_ERROR;
    }
    done(`Scoring done in ${elapsed}s`);
  } else {
    done(`Scoring done in ${elapsed}s`);
    process.stdout.write(output);
  }

  return ExitCode.SUCCESS;
}
