import { createServer, type Server } from 'node:http';

import { expect } from 'chai';

import { bundleSpec } from '../src/bundle.ts';

function startStuckServer(): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer(() => {
      /* accept the connection but never respond */
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}/openapi.yaml` });
    });
  });
}

describe('bundleSpec', function () {
  it('rejects with a clear error when the fetch exceeds the timeout', async function () {
    const { server, url } = await startStuckServer();
    try {
      let err: Error | undefined;
      try {
        await bundleSpec(url, 500);
      } catch (e) {
        err = e as Error;
      }
      expect(err, 'expected bundleSpec to reject').to.be.instanceOf(Error);
      expect(err?.message).to.match(/timed out/i);
    } finally {
      server.closeAllConnections?.();
      server.close();
    }
  });
});
