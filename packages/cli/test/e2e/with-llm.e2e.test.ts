import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';

import { expect } from 'chai';

import { startMockLlmServer } from './mock-llm-server.ts';

const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
const CLI_BIN = fileURLToPath(new URL('../../bin/jentic-api-scorecard.mjs', import.meta.url));
const SAMPLE_SPEC = `${REPO_ROOT}/docker/.build/sample.yaml`;

const E2E_TIMEOUT_MS = 120_000;

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
      ['score', SAMPLE_SPEC, '--with-llm', '--detail', 'diagnostics'],
      {
        ...process.env,
        JENTIC_API_KEY: 'mvp-preview',
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
    const env = { ...process.env };
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
    env['JENTIC_API_KEY'] = 'mvp-preview';

    const result = spawnSync('node', [CLI_BIN, 'score', SAMPLE_SPEC, '--with-llm'], {
      env,
      encoding: 'utf8',
      timeout: E2E_TIMEOUT_MS,
    });

    expect(result.status).to.equal(1);
    expect(result.stderr).to.include('OPENAI_API_KEY');
    expect(result.stderr).to.include('LLM_PROVIDER');
  });
});
