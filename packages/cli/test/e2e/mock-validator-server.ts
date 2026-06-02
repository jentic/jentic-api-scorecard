import { createServer, type Server } from 'node:http';

export interface MockValidatorResponse {
  status: number;
  body?: string;
  contentType?: string;
  retryAfter?: string;
}

export function startMockValidatorServer(
  response: MockValidatorResponse,
): Promise<{ server: Server; port: number; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      const headers: Record<string, string> = {};
      if (response.contentType !== undefined) {
        headers['Content-Type'] = response.contentType;
      }
      if (response.retryAfter !== undefined) {
        headers['Retry-After'] = response.retryAfter;
      }
      res.writeHead(response.status, headers);
      res.end(response.body ?? '');
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      resolve({ server, port, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}
