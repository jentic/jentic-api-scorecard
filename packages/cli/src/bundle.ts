import { BaseResolver, bundle, createConfig } from '@redocly/openapi-core';

export const DEFAULT_BUNDLE_TIMEOUT_MS = 60_000;

export async function bundleSpec(
  ref: string,
  timeoutMs: number = DEFAULT_BUNDLE_TIMEOUT_MS,
): Promise<string> {
  const config = await createConfig({});
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`bundling timed out after ${Math.round(timeoutMs / 1000)}s`));
  }, timeoutMs);
  const customFetch = (url: string, init?: RequestInit): Promise<Response> =>
    fetch(url, { ...init, signal: controller.signal });
  const externalRefResolver = new BaseResolver({ http: { headers: [], customFetch } });
  try {
    const result = await bundle({ ref, config, externalRefResolver, dereference: false });
    return JSON.stringify(result.bundle.parsed);
  } catch (err) {
    if (controller.signal.aborted) {
      throw controller.signal.reason instanceof Error
        ? controller.signal.reason
        : new Error(String(controller.signal.reason));
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
