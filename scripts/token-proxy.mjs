#!/usr/bin/env node
/**
 * token-proxy.mjs
 *
 * A minimal OpenAI-compatible forwarding proxy that tallies LLM token usage.
 * The scorecard engine's `--with-llm` analysis is pointed at this proxy (via the
 * documented local-provider recipe — LLM_PROVIDER=OPENAI, OPENAI_API_URL=<this>);
 * the proxy forwards each `POST /v1/chat/completions` to a real upstream and
 * accumulates the `usage` block so the engine surface's token cost can be measured.
 * The scorecard result JSON does NOT expose token usage, so this proxy is the only
 * way to capture engine-side tokens — see specs/2026-07-05-benchmark-improve-cost.
 *
 * This is a *forwarding measurement* proxy against a real upstream, not a mock.
 *
 * Usage (standalone):
 *   PROXY_UPSTREAM_URL=<url> PROXY_UPSTREAM_KEY=<key> \
 *     node scripts/token-proxy.mjs --port 11434
 *
 * Programmatic (from the harness):
 *   import { startProxy } from './token-proxy.mjs';
 *   const proxy = await startProxy({ port: 0, upstreamUrl, upstreamKey });
 *   // ... drive the engine at proxy.url ...
 *   const { promptTokens, completionTokens, requests } = proxy.usage();
 *   await proxy.stop();
 *
 * The proxy also exposes `GET /__usage` returning the running tally as JSON, for
 * out-of-process reads.
 */

import http from 'http';

/**
 * Extract a `usage` object from a parsed OpenAI-style response body.
 * Returns { prompt, completion } with numbers, or null when absent/unparseable.
 */
function readUsage(body) {
  const usage = body && typeof body === 'object' ? body.usage : null;
  if (!usage || typeof usage !== 'object') return null;
  const prompt = usage.prompt_tokens;
  const completion = usage.completion_tokens;
  if (typeof prompt !== 'number' || typeof completion !== 'number') return null;
  return { prompt, completion };
}

/**
 * Start the proxy. Resolves once it is listening.
 *
 * @param {object} opts
 * @param {number} [opts.port]        Port to listen on (0 = ephemeral).
 * @param {string} opts.upstreamUrl   Real OpenAI-compatible chat-completions URL.
 * @param {string} [opts.upstreamKey] Bearer key forwarded to the upstream.
 * @param {(req: object) => Promise<{status: number, body: object}>} [opts.upstreamHandler]
 *        Test seam: when provided, replaces the real fetch (used by --dry-run
 *        self-check with a canned response); never set in a real measurement run.
 */
export function startProxy({ port = 0, upstreamUrl, upstreamKey, upstreamHandler } = {}) {
  let promptTokens = 0;
  let completionTokens = 0;
  let requests = 0;
  let unknownUsageResponses = 0;

  const forward =
    upstreamHandler ??
    (async (requestBody) => {
      const res = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(upstreamKey ? { authorization: `Bearer ${upstreamKey}` } : {}),
        },
        body: JSON.stringify(requestBody),
      });
      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
      return { status: res.status, body };
    });

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/__usage') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ promptTokens, completionTokens, requests, unknownUsageResponses }));
      return;
    }

    if (req.method !== 'POST' || !req.url.startsWith('/v1/chat/completions')) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }

    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', async () => {
      let requestBody;
      try {
        requestBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid JSON request body' }));
        return;
      }
      // The engine may request streaming; force non-streaming so the upstream
      // returns a single JSON body carrying `usage`. A streamed response that
      // omits `usage` is recorded as unknown (never counted as zero).
      requestBody.stream = false;
      try {
        const { status, body } = await forward(requestBody);
        const usage = readUsage(body);
        requests += 1;
        if (usage) {
          promptTokens += usage.prompt;
          completionTokens += usage.completion;
        } else {
          unknownUsageResponses += 1;
        }
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      } catch (err) {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: `upstream request failed: ${err.message}` }));
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const actualPort = server.address().port;
      resolve({
        port: actualPort,
        url: `http://127.0.0.1:${actualPort}/v1/chat/completions`,
        usage: () => ({
          promptTokens,
          completionTokens,
          requests,
          // null (unknown) when any response lacked a usage block, so a missing
          // count is never silently read as free.
          unknown: unknownUsageResponses > 0,
        }),
        stop: () =>
          new Promise((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}

/** Standalone CLI: start the proxy and keep it running until killed. */
async function main() {
  const args = process.argv.slice(2);
  const portIdx = args.indexOf('--port');
  const port = portIdx >= 0 ? Number(args[portIdx + 1]) : 11434;
  const upstreamUrl = process.env.PROXY_UPSTREAM_URL;
  const upstreamKey = process.env.PROXY_UPSTREAM_KEY;
  if (!upstreamUrl) {
    console.error('❌  PROXY_UPSTREAM_URL is required (the real OpenAI-compatible endpoint)');
    process.exit(1);
  }
  const proxy = await startProxy({ port, upstreamUrl, upstreamKey });
  console.log(`✅  token-proxy listening at ${proxy.url} → forwarding to ${upstreamUrl}`);
  const shutdown = async () => {
    const usage = proxy.usage();
    console.log(
      `token-proxy usage: prompt=${usage.promptTokens} completion=${usage.completionTokens} requests=${usage.requests}`,
    );
    await proxy.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Only run the CLI when invoked directly, not when imported by the harness.
if (process.argv[1] && process.argv[1].endsWith('token-proxy.mjs')) {
  main();
}
