import { execFile, spawn } from 'node:child_process';
import { constants as osConstants, platform } from 'node:os';

import { ExitCode } from './exit-codes.ts';
import { cliVersion } from './version.ts';

export const IMAGE_NAME = 'ghcr.io/jentic/jentic-api-scorecard';

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
      const exitCode = err.code === 'ENOENT' ? ExitCode.DOCKER_MISSING : ExitCode.GENERIC_ERROR;
      resolve({ exitCode, stderr: err.message });
    });
    child.on('close', (code) => {
      resolve({
        exitCode: code ?? ExitCode.GENERIC_ERROR,
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      });
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
}

const FORWARDED_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];

export function runDocker(opts: DockerRunOptions): Promise<DockerRunResult> {
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
    if (platform() === 'linux') {
      dockerArgs.push('--network', 'host');
    } else {
      dockerArgs.push('--add-host=host.docker.internal:host-gateway');
    }
  }

  dockerArgs.push(imageRef());
  dockerArgs.push(...opts.args);

  return new Promise((resolve, reject) => {
    const child = spawn('docker', dockerArgs, {
      stdio: [opts.stdinPayload !== undefined ? 'pipe' : 'inherit', 'pipe', 'inherit'],
    });

    let settled = false;
    const signalHandlers = new Map<NodeJS.Signals, () => void>();
    const stdoutChunks: Buffer[] = [];

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

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        process.stderr.write(
          "error: 'docker' command not found.\n" +
            '  Install Docker: https://docs.docker.com/get-docker/\n',
        );
        settle(() => resolve({ exitCode: ExitCode.DOCKER_MISSING, stdout: '' }));
        return;
      }
      settle(() => reject(err));
    });

    child.on('close', (code, signal) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      if (signal !== null) {
        const signo = osConstants.signals[signal] ?? 0;
        settle(() => resolve({ exitCode: 128 + signo, stdout }));
        return;
      }
      settle(() => resolve({ exitCode: code ?? ExitCode.GENERIC_ERROR, stdout }));
    });

    if (opts.stdinPayload !== undefined && child.stdin) {
      child.stdin.on('error', () => {
        /* swallow EPIPE if container exits early */
      });
      child.stdin.end(opts.stdinPayload);
    }
  });
}
