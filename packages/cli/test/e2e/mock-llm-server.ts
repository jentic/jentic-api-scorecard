import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FIXTURE_PATH = fileURLToPath(
  new URL('../fixtures/llm-chat-completion.json', import.meta.url),
);
const FIXTURE_BODY = readFileSync(FIXTURE_PATH, 'utf8');

export function startMockLlmServer(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(FIXTURE_BODY);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      resolve({ server, port });
    });
  });
}
