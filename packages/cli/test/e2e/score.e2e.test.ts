import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';

import { startMockSpecServer } from './mock-spec-server.ts';

const CLI_BIN = fileURLToPath(new URL('../../bin/jentic-api-scorecard.mjs', import.meta.url));
const OAK_PETSTORE_URL =
  'https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/swagger-api/petstore/1.0.27/openapi.json';

function runCliAsync(
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_BIN, ...args], { env, stdio: 'pipe' });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    child.on('close', (code) => {
      resolve({
        exitCode: code,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      });
    });
  });
}

const E2E_TIMEOUT_MS = 120_000;

function strip(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1B\[[0-9;]*m/g, '');
}

function envWithoutKey(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env['JENTIC_API_KEY'];
  return env;
}

describe('score command — e2e against docker', function () {
  this.timeout(E2E_TIMEOUT_MS);

  describe('allowlisted URL input', function () {
    let exitCode: number | null;
    let stdout: string;
    let stderr: string;

    before(function () {
      const result = spawnSync('node', [CLI_BIN, 'score', OAK_PETSTORE_URL], {
        env: envWithoutKey(),
        encoding: 'utf8',
        timeout: E2E_TIMEOUT_MS,
      });
      exitCode = result.status;
      stdout = result.stdout ?? '';
      stderr = result.stderr ?? '';
    });

    it('exits 0', function () {
      expect(exitCode, `stderr: ${stderr}`).to.equal(0);
    });

    it('renders the headline', function () {
      const out = strip(stdout);
      expect(out).to.include('API Readiness Scorecard');
      expect(out).to.include('Final score:');
      expect(out).to.include('Readiness:');
    });

    it('renders the dimension table', function () {
      const out = strip(stdout);
      expect(out).to.include('Foundational Compliance');
      expect(out).to.include('Security');
      expect(out).to.match(/\d+\s+operations/);
    });

    it('echoes the source URL', function () {
      expect(strip(stdout)).to.include(OAK_PETSTORE_URL);
    });
  });

  describe('stream interleaving (regression: #84)', function () {
    let exitCode: number | null;
    let merged: string;

    before(function () {
      // Merge stderr into stdout so we can observe the actual emission
      // order users see on a TTY.
      const result = spawnSync('bash', ['-c', 'node "$CLI" score "$SPEC" 2>&1'], {
        env: {
          ...envWithoutKey(),
          CLI: CLI_BIN,
          SPEC: OAK_PETSTORE_URL,
        },
        encoding: 'utf8',
        timeout: E2E_TIMEOUT_MS,
      });
      exitCode = result.status;
      merged = strip(result.stdout ?? '');
    });

    it('exits 0', function () {
      expect(exitCode).to.equal(0);
    });

    it("emits 'Scoring done in …' before the report headline", function () {
      const doneIdx = merged.indexOf('Scoring done in');
      const reportIdx = merged.indexOf('API Readiness Scorecard');
      expect(doneIdx, 'spinner success line missing').to.be.greaterThan(-1);
      expect(reportIdx, 'report headline missing').to.be.greaterThan(-1);
      expect(doneIdx).to.be.lessThan(reportIdx);
    });
  });

  describe('--detail summary', function () {
    let exitCode: number | null;
    let stdout: string;

    before(function () {
      const result = spawnSync(
        'node',
        [CLI_BIN, 'score', OAK_PETSTORE_URL, '--detail', 'summary'],
        {
          env: envWithoutKey(),
          encoding: 'utf8',
          timeout: E2E_TIMEOUT_MS,
        },
      );
      exitCode = result.status;
      stdout = result.stdout ?? '';
    });

    it('exits 0', function () {
      expect(exitCode).to.equal(0);
    });

    it('omits the Dimensions table', function () {
      expect(strip(stdout)).to.not.include('Dimensions');
    });
  });

  describe('--format json', function () {
    describe('default detail (dimensions)', function () {
      let exitCode: number | null;
      let stdout: string;
      let stderr: string;

      before(function () {
        const result = spawnSync('node', [CLI_BIN, 'score', OAK_PETSTORE_URL, '--format', 'json'], {
          env: envWithoutKey(),
          encoding: 'utf8',
          timeout: E2E_TIMEOUT_MS,
        });
        exitCode = result.status;
        stdout = result.stdout ?? '';
        stderr = result.stderr ?? '';
      });

      it('exits 0', function () {
        expect(exitCode, `stderr: ${stderr}`).to.equal(0);
      });

      it('emits parseable JSON on stdout', function () {
        expect(() => JSON.parse(stdout)).to.not.throw();
      });

      it('has a numeric summary.score and 6 dimensions, no details/diagnostics', function () {
        const parsed = JSON.parse(stdout) as Record<string, unknown>;
        const summary = parsed['summary'] as Record<string, unknown>;
        expect(summary['score']).to.be.a('number');
        expect(summary['dimensions']).to.be.an('array').with.length(6);
        expect(parsed['details']).to.equal(undefined);
        expect(parsed['diagnostics']).to.equal(undefined);
      });

      it('never leaks progress chrome onto stdout', function () {
        // Spinner-only strings the engine JSON cannot emit. 'Bundling' and
        // bare 'Scoring' would false-positive on metadata.engine.name
        // ('Jentic API Scoring Framework') and summary.scoringDate.
        expect(stdout).to.not.include('Bundling…');
        expect(stdout).to.not.include('Scoring done in');
      });
    });

    describe('--detail summary', function () {
      let exitCode: number | null;
      let stdout: string;

      before(function () {
        const result = spawnSync(
          'node',
          [CLI_BIN, 'score', OAK_PETSTORE_URL, '--format', 'json', '--detail', 'summary'],
          {
            env: envWithoutKey(),
            encoding: 'utf8',
            timeout: E2E_TIMEOUT_MS,
          },
        );
        exitCode = result.status;
        stdout = result.stdout ?? '';
      });

      it('exits 0', function () {
        expect(exitCode).to.equal(0);
      });

      it('omits summary.dimensions, details, and diagnostics', function () {
        const parsed = JSON.parse(stdout) as Record<string, unknown>;
        const summary = parsed['summary'] as Record<string, unknown>;
        expect(summary['dimensions']).to.equal(undefined);
        expect(parsed['details']).to.equal(undefined);
        expect(parsed['diagnostics']).to.equal(undefined);
      });
    });

    describe('--detail diagnostics', function () {
      let exitCode: number | null;
      let stdout: string;

      before(function () {
        const result = spawnSync(
          'node',
          [CLI_BIN, 'score', OAK_PETSTORE_URL, '--format', 'json', '--detail', 'diagnostics'],
          {
            env: envWithoutKey(),
            encoding: 'utf8',
            timeout: E2E_TIMEOUT_MS,
          },
        );
        exitCode = result.status;
        stdout = result.stdout ?? '';
      });

      it('exits 0', function () {
        expect(exitCode).to.equal(0);
      });

      it('includes details and diagnostics arrays', function () {
        const parsed = JSON.parse(stdout) as Record<string, unknown>;
        expect(parsed['details']).to.be.an('array');
        expect(parsed['diagnostics']).to.be.an('array');
      });
    });

    describe('-f short flag', function () {
      let exitCode: number | null;
      let stdout: string;
      let stderr: string;

      before(function () {
        const result = spawnSync('node', [CLI_BIN, 'score', OAK_PETSTORE_URL, '-f', 'json'], {
          env: envWithoutKey(),
          encoding: 'utf8',
          timeout: E2E_TIMEOUT_MS,
        });
        exitCode = result.status;
        stdout = result.stdout ?? '';
        stderr = result.stderr ?? '';
      });

      it('exits 0', function () {
        expect(exitCode, `stderr: ${stderr}`).to.equal(0);
      });

      it('emits parseable JSON on stdout', function () {
        expect(() => JSON.parse(stdout)).to.not.throw();
      });
    });

    describe('--format invalid', function () {
      let exitCode: number | null;
      let stderr: string;

      before(function () {
        const result = spawnSync(
          'node',
          [CLI_BIN, 'score', OAK_PETSTORE_URL, '--format', 'invalid'],
          {
            env: envWithoutKey(),
            encoding: 'utf8',
            timeout: E2E_TIMEOUT_MS,
          },
        );
        exitCode = result.status;
        stderr = result.stderr ?? '';
      });

      it('exits non-zero', function () {
        expect(exitCode).to.not.equal(0);
      });

      it('mentions --format and invalid on stderr', function () {
        expect(stderr).to.include('--format');
        expect(stderr).to.include('invalid');
      });
    });
  });

  describe('-o / --output FILE', function () {
    let workDir: string;
    let outPath: string;
    let exitCode: number | null;
    let stdout: string;
    let stderr: string;

    before(function () {
      workDir = mkdtempSync(join(tmpdir(), 'jentic-e2e-output-'));
      outPath = join(workDir, 'report.json');
      const result = spawnSync(
        'node',
        [CLI_BIN, 'score', OAK_PETSTORE_URL, '--format', 'json', '-o', outPath],
        {
          env: envWithoutKey(),
          encoding: 'utf8',
          timeout: E2E_TIMEOUT_MS,
        },
      );
      exitCode = result.status;
      stdout = result.stdout ?? '';
      stderr = result.stderr ?? '';
    });

    after(function () {
      rmSync(workDir, { recursive: true, force: true });
    });

    it('exits 0', function () {
      expect(exitCode, `stderr: ${stderr}`).to.equal(0);
    });

    it('writes parseable JSON to the output file', function () {
      const fileContents = readFileSync(outPath, 'utf8');
      expect(() => JSON.parse(fileContents)).to.not.throw();
      const parsed = JSON.parse(fileContents) as Record<string, unknown>;
      expect((parsed['summary'] as Record<string, unknown>)['score']).to.be.a('number');
    });

    it('does not write the report to stdout', function () {
      expect(stdout).to.equal('');
    });

    it('keeps the spinner completion message on stderr', function () {
      expect(stderr).to.include('Scoring done in');
    });

    it('also accepts the --output longform', function () {
      const altPath = join(workDir, 'longform.json');
      const result = spawnSync(
        'node',
        [CLI_BIN, 'score', OAK_PETSTORE_URL, '--format', 'json', '--output', altPath],
        {
          env: envWithoutKey(),
          encoding: 'utf8',
          timeout: E2E_TIMEOUT_MS,
        },
      );
      expect(result.status, `stderr: ${result.stderr}`).to.equal(0);
      expect(result.stdout).to.equal('');
      const fileContents = readFileSync(altPath, 'utf8');
      expect(() => JSON.parse(fileContents)).to.not.throw();
    });
  });

  it('exits non-zero when -o targets an unwritable path', function () {
    // Build a deterministically-missing parent under our own temp dir so
    // the failure mode does not depend on host filesystem layout.
    const workDir = mkdtempSync(join(tmpdir(), 'jentic-e2e-unwritable-'));
    try {
      const target = join(workDir, 'does-not-exist', 'report.json');
      const result = spawnSync(
        'node',
        [CLI_BIN, 'score', OAK_PETSTORE_URL, '--format', 'json', '-o', target],
        {
          env: envWithoutKey(),
          encoding: 'utf8',
          timeout: E2E_TIMEOUT_MS,
        },
      );
      expect(result.status).to.not.equal(0);
      expect(result.stderr).to.include('failed to write');
      // Suppress success chrome on the failure path so the user does not
      // see ✔ followed by an error.
      expect(result.stderr).to.not.include('Scoring done in');
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  describe('--quiet', function () {
    let exitCode: number | null;
    let stdout: string;
    let stderr: string;

    before(function () {
      const result = spawnSync('node', [CLI_BIN, 'score', OAK_PETSTORE_URL, '--quiet'], {
        env: envWithoutKey(),
        encoding: 'utf8',
        timeout: E2E_TIMEOUT_MS,
      });
      exitCode = result.status;
      stdout = result.stdout ?? '';
      stderr = result.stderr ?? '';
    });

    it('exits 0', function () {
      expect(exitCode, `stderr: ${stderr}`).to.equal(0);
    });

    it('still renders the report on stdout', function () {
      expect(stdout).to.include('API Readiness Scorecard');
    });

    it('omits the spinner completion message from stderr', function () {
      expect(stderr).to.not.include('Scoring done in');
      expect(stderr).to.not.include('Bundling');
    });
  });

  it('writes plain text (no ANSI escapes) when -o is set with --format pretty', function () {
    const workDir = mkdtempSync(join(tmpdir(), 'jentic-e2e-pretty-output-'));
    const outPath = join(workDir, 'report.txt');
    try {
      const result = spawnSync(
        'node',
        [CLI_BIN, 'score', OAK_PETSTORE_URL, '--format', 'pretty', '-o', outPath],
        {
          env: { ...envWithoutKey(), FORCE_COLOR: '1' },
          encoding: 'utf8',
          timeout: E2E_TIMEOUT_MS,
        },
      );
      expect(result.status, `stderr: ${result.stderr}`).to.equal(0);
      const fileContents = readFileSync(outPath, 'utf8');
      expect(fileContents).to.include('API Readiness Scorecard');
      // eslint-disable-next-line no-control-regex
      expect(fileContents).to.not.match(/\x1B\[/);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it('exits with GATE_REJECTED (3) for a non-allowlisted URL with no key', function () {
    // RFC 6761 reserves .test as never-resolvable, so even if the gate were
    // bypassed the engine could not fetch the URL.
    const result = spawnSync('node', [CLI_BIN, 'score', 'https://invalid.test/openapi.yaml'], {
      env: envWithoutKey(),
      encoding: 'utf8',
      timeout: E2E_TIMEOUT_MS,
    });
    expect(result.status).to.equal(3);
  });

  it('URL + --bundle without a key exits with AUTH_INVALID_KEY (2)', async function () {
    const started = await startMockSpecServer();
    try {
      const mockUrl = `http://127.0.0.1:${started.port}/openapi.yaml`;
      const result = await runCliAsync(['score', mockUrl, '--bundle'], envWithoutKey());
      expect(result.exitCode).to.equal(2);
      expect(result.stderr).to.include('Bundling');
      expect(result.stderr).to.include(mockUrl);
    } finally {
      started.server.close();
    }
  });
});
