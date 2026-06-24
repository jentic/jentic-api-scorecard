import { execFile, spawn } from 'node:child_process';
import { constants as osConstants, platform } from 'node:os';

import { ExitCode } from './exit-codes.ts';
import { cliVersion } from './version.ts';

export const IMAGE_NAME = 'ghcr.io/jentic/jentic-api-scorecard';

const DOCKER_MISSING_MESSAGE =
  "error: 'docker' command not found.\n" +
  '  Install Docker: https://docs.docker.com/get-docker/\n';

const DOCKER_NOT_RUNNING_MESSAGE =
  'error: Docker is installed but the daemon is not running.\n' +
  '  Start Docker Desktop, or on Linux: sudo systemctl start docker\n';

export function isDaemonDown(stderr: string): boolean {
  return /Cannot connect to the Docker daemon|if the daemon is running/i.test(stderr);
}

export function imageRef(): string {
  return `${IMAGE_NAME}:${cliVersion}`;
}

export function imageExists(ref: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('docker', ['image', 'inspect', ref], (err) => {
      resolve(err === null);
    });
  });
}

export interface PullResult {
  exitCode: number;
  stderr: string;
}

export function pullImage(ref: string): Promise<PullResult> {
  return new Promise((resolve) => {
    const child = spawn('docker', ['pull', ref], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    const stderrChunks: Buffer[] = [];
    if (child.stderr) {
      child.stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });
    }
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        resolve({ exitCode: ExitCode.DOCKER_MISSING, stderr: DOCKER_MISSING_MESSAGE });
        return;
      }
      resolve({ exitCode: ExitCode.GENERIC_ERROR, stderr: err.message });
    });
    child.on('close', (code) => {
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      if (code !== 0 && isDaemonDown(stderr)) {
        resolve({ exitCode: ExitCode.DOCKER_MISSING, stderr: DOCKER_NOT_RUNNING_MESSAGE });
        return;
      }
      resolve({ exitCode: code ?? ExitCode.GENERIC_ERROR, stderr });
    });
  });
}

export interface DockerRunOptions {
  args: string[];
  stdinPayload?: string;
  forwardJenticKey: boolean;
  forwardEnvVars: string[];
  forwardEnvOverrides: Map<string, string>;
  needsHostNetwork: boolean;
}

export interface DockerRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const FORWARDED_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];

export function buildDockerArgs(
  opts: DockerRunOptions,
  plat: NodeJS.Platform = platform(),
): string[] {
  const dockerArgs: string[] = ['run', '--rm'];

  if (opts.stdinPayload !== undefined) {
    dockerArgs.push('-i');
  }

  if (opts.forwardJenticKey) {
    dockerArgs.push('-e', 'JENTIC_API_KEY');
  }

  for (const name of opts.forwardEnvVars) {
    const override = opts.forwardEnvOverrides.get(name);
    if (override !== undefined) {
      dockerArgs.push('-e', `${name}=${override}`);
    } else {
      dockerArgs.push('-e', name);
    }
  }

  if (opts.needsHostNetwork) {
    if (plat === 'linux') {
      dockerArgs.push('--network', 'host');
    } else {
      dockerArgs.push('--add-host=host.docker.internal:host-gateway');
    }
  }

  dockerArgs.push(imageRef());
  dockerArgs.push(...opts.args);

  return dockerArgs;
}

export function runDocker(opts: DockerRunOptions): Promise<DockerRunResult> {
  const dockerArgs = buildDockerArgs(opts);

  return new Promise((resolve, reject) => {
    const child = spawn('docker', dockerArgs, {
      stdio: [opts.stdinPayload !== undefined ? 'pipe' : 'inherit', 'pipe', 'pipe'],
    });

    let settled = false;
    const signalHandlers = new Map<NodeJS.Signals, () => void>();
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const cleanup = (): void => {
      for (const [sig, handler] of signalHandlers) {
        process.off(sig, handler);
      }
      signalHandlers.clear();
    };

    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    for (const sig of FORWARDED_SIGNALS) {
      const handler = (): void => {
        child.kill(sig);
      };
      signalHandlers.set(sig, handler);
      process.on(sig, handler);
    }

    if (child.stdout) {
      child.stdout.on('data', (chunk: Buffer) => {
        stdoutChunks.push(chunk);
      });
    }

    // Buffer stderr instead of inheriting it: live writes during the run
    // would interleave with the ora spinner caption (issue #107). The
    // container emits stderr at end-of-run, so the buffer stays bounded.
    if (child.stderr) {
      child.stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });
    }

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        settle(() =>
          resolve({
            exitCode: ExitCode.DOCKER_MISSING,
            stdout: '',
            stderr: DOCKER_MISSING_MESSAGE,
          }),
        );
        return;
      }
      settle(() => reject(err));
    });

    child.on('close', (code, signal) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      if (signal !== null) {
        const signo = osConstants.signals[signal] ?? 0;
        settle(() => resolve({ exitCode: 128 + signo, stdout, stderr }));
        return;
      }
      if (code !== 0 && isDaemonDown(stderr)) {
        settle(() =>
          resolve({
            exitCode: ExitCode.DOCKER_MISSING,
            stdout: '',
            stderr: DOCKER_NOT_RUNNING_MESSAGE,
          }),
        );
        return;
      }
      settle(() => resolve({ exitCode: code ?? ExitCode.GENERIC_ERROR, stdout, stderr }));
    });

    if (opts.stdinPayload !== undefined && child.stdin) {
      child.stdin.on('error', () => {
        /* swallow EPIPE if container exits early */
      });
      child.stdin.end(opts.stdinPayload);
    }
  });
}
