import { platform } from 'node:os';

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
}

export function needsDockerHostRewrite(value: string): boolean {
  try {
    const url = new URL(value);
    return isLoopbackHostname(url.hostname) || url.hostname === 'host.docker.internal';
  } catch {
    return false;
  }
}

export function rewriteUrlForContainer(value: string): string {
  try {
    const url = new URL(value);
    if (platform() === 'linux') {
      if (url.hostname === 'host.docker.internal') {
        url.hostname = 'localhost';
      }
    } else {
      if (isLoopbackHostname(url.hostname)) {
        url.hostname = 'host.docker.internal';
      }
    }
    return url.toString();
  } catch {
    return value;
  }
}
