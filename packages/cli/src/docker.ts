import { spawn } from 'node:child_process';
import { constants as osConstants } from 'node:os';

import { ExitCode } from './exit-codes.js';
import { cliVersion } from './version.js';

export const IMAGE_NAME = 'ghcr.io/jentic/jentic-api-scorecard';

export function imageRef(): string {
  return `${IMAGE_NAME}:${cliVersion}`;
}

export interface DockerRunOptions {
  args: string[];
  stdinPayload?: string;
  forwardJenticKey: boolean;
}

export interface DockerRunResult {
  exitCode: number;
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

  dockerArgs.push(imageRef());
  dockerArgs.push(...opts.args);

  return new Promise((resolve, reject) => {
    const child = spawn('docker', dockerArgs, {
      stdio: [
        opts.stdinPayload !== undefined ? 'pipe' : 'inherit',
        'inherit',
        'inherit',
      ],
    });

    let settled = false;
    const signalHandlers = new Map<NodeJS.Signals, () => void>();

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

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        process.stderr.write(
          "error: 'docker' command not found.\n" +
            '  Install Docker: https://docs.docker.com/get-docker/\n',
        );
        settle(() => resolve({ exitCode: ExitCode.DOCKER_MISSING }));
        return;
      }
      settle(() => reject(err));
    });

    child.on('exit', (code, signal) => {
      if (signal !== null) {
        const signo = osConstants.signals[signal] ?? 0;
        settle(() => resolve({ exitCode: 128 + signo }));
        return;
      }
      settle(() => resolve({ exitCode: code ?? ExitCode.GENERIC_ERROR }));
    });

    if (opts.stdinPayload !== undefined && child.stdin) {
      child.stdin.on('error', () => {
        /* swallow EPIPE if container exits early */
      });
      child.stdin.end(opts.stdinPayload);
    }
  });
}
