import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';

import { expect } from 'chai';

import { startMockLlmServer } from './mock-llm-server.ts';

const CLI_BIN = fileURLToPath(new URL('../../bin/jentic-api-scorecard.mjs', import.meta.url));
const OAK_PETSTORE_URL =
  'https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/swagger-api/petstore/1.0.27/openapi.json';

const E2E_TIMEOUT_MS = 120_000;

// 127.0.0.1:1 refuses immediately — a deterministic LLM connectivity failure
// needing no mock server, mirroring docker/tests/test_main.py's exit-8 case.
const UNREACHABLE_LLM_URL = 'http://127.0.0.1:1/v1/chat/completions';

function failingLlmEnv(): NodeJS.ProcessEnv {
  return {
    ...envWithoutKey(),
    LLM_PROVIDER: 'OPENAI',
    LIGHT_LLM_PROVIDER: 'OPENAI',
    OPENAI_API_KEY: 'mock-key',
    OPENAI_API_URL: UNREACHABLE_LLM_URL,
    LLM_MODEL: 'mock-model',
    LLM_LIGHT_MODEL: 'mock-model',
  };
}

function runCliAsync(
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_BIN, ...args], { env, stdio: 'pipe' });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      });
    });
  });
}

function envWithoutKey(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env['JENTIC_API_KEY'];
  return env;
}

describe('--with-llm e2e against mock LLM server', function () {
  this.timeout(E2E_TIMEOUT_MS);

  let server: Server;
  let port: number;

  before(async function () {
    const result = await startMockLlmServer();
    server = result.server;
    port = result.port;
  });

  after(function () {
    server.close();
  });

  it('forwards env vars and produces semantic diagnostics', async function () {
    const result = await runCliAsync(
      ['score', OAK_PETSTORE_URL, '--with-llm', '--detail', 'diagnostics'],
      {
        ...envWithoutKey(),
        LLM_PROVIDER: 'OPENAI',
        LIGHT_LLM_PROVIDER: 'OPENAI',
        OPENAI_API_KEY: 'mock-key',
        OPENAI_API_URL: `http://127.0.0.1:${port}/v1/chat/completions`,
        LLM_MODEL: 'mock-model',
        LLM_LIGHT_MODEL: 'mock-model',
      },
    );

    expect(result.exitCode, `stderr: ${result.stderr}`).to.equal(0);
    expect(result.stdout).to.include('semantic-analysis-summary');
  });

  it('fail-fast exits 1 when no provider is configured', function () {
    const env = envWithoutKey();
    delete env['OPENAI_API_KEY'];
    delete env['ANTHROPIC_API_KEY'];
    delete env['GEMINI_API_KEY'];
    delete env['AWS_ACCESS_KEY_ID'];
    delete env['AWS_SECRET_ACCESS_KEY'];
    delete env['AWS_SESSION_TOKEN'];
    delete env['AWS_REGION'];
    delete env['AWS_BEARER_TOKEN_BEDROCK'];
    delete env['OPENAI_API_URL'];
    delete env['ANTHROPIC_API_URL'];
    delete env['GEMINI_API_URL'];
    delete env['LLM_PROVIDER'];
    delete env['LIGHT_LLM_PROVIDER'];
    delete env['LLM_MODEL'];
    delete env['LLM_LIGHT_MODEL'];
    delete env['LLM_MAX_TOKENS'];

    const result = spawnSync('node', [CLI_BIN, 'score', OAK_PETSTORE_URL, '--with-llm'], {
      env,
      encoding: 'utf8',
      timeout: E2E_TIMEOUT_MS,
    });

    expect(result.status).to.equal(1);
    expect(result.stderr).to.include('OPENAI_API_KEY');
    expect(result.stderr).to.include('LLM_PROVIDER');
  });
});

describe('--with-llm e2e on LLM failure (exit 8, suppressed report)', function () {
  this.timeout(E2E_TIMEOUT_MS);

  it('exits 8, suppresses stdout, and errors on stderr', async function () {
    const result = await runCliAsync(['score', OAK_PETSTORE_URL, '--with-llm'], failingLlmEnv());

    expect(result.exitCode, `stderr: ${result.stderr}`).to.equal(8);
    expect(result.stdout).to.equal('');
    expect(result.stderr).to.include('LLM analysis failed');
    expect(result.stderr).to.not.include('✔');
  });

  it('suppresses --format json output too', async function () {
    const result = await runCliAsync(
      ['score', OAK_PETSTORE_URL, '--with-llm', '--format', 'json'],
      failingLlmEnv(),
    );

    expect(result.exitCode, `stderr: ${result.stderr}`).to.equal(8);
    expect(result.stdout).to.equal('');
  });

  it('does not write the -o output file on failure', async function () {
    const dir = mkdtempSync(join(tmpdir(), 'scorecard-e2e-'));
    const outPath = join(dir, 'report.json');
    try {
      const result = await runCliAsync(
        ['score', OAK_PETSTORE_URL, '--with-llm', '--format', 'json', '-o', outPath],
        failingLlmEnv(),
      );

      expect(result.exitCode, `stderr: ${result.stderr}`).to.equal(8);
      expect(existsSync(outPath), 'output file should not be written on failure').to.equal(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
