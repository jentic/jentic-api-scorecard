import { spawn } from 'node:child_process';

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

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        process.stderr.write(
          "error: 'docker' command not found.\n" +
            '  Install Docker: https://docs.docker.com/get-docker/\n',
        );
        resolve({ exitCode: 4 });
        return;
      }
      reject(err);
    });

    child.on('exit', (code, signal) => {
      if (signal !== null) {
        resolve({ exitCode: 1 });
        return;
      }
      resolve({ exitCode: code ?? 1 });
    });

    if (opts.stdinPayload !== undefined && child.stdin) {
      child.stdin.on('error', () => {
        /* swallow EPIPE if container exits early */
      });
      child.stdin.end(opts.stdinPayload);
    }
  });
}
