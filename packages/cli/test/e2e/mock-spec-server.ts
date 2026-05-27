import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SAMPLE_SPEC_PATH = fileURLToPath(
  new URL('../../../../docker/.build/sample.yaml', import.meta.url),
);
const SAMPLE_SPEC_BODY = readFileSync(SAMPLE_SPEC_PATH, 'utf8');

export function startMockSpecServer(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/yaml' });
      res.end(SAMPLE_SPEC_BODY);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      resolve({ server, port });
    });
  });
}
