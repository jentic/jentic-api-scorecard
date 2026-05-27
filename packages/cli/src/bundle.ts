import { bundle, createConfig } from '@redocly/openapi-core';

export const DEFAULT_BUNDLE_TIMEOUT_MS = 60_000;

export async function bundleSpec(
  ref: string,
  timeoutMs: number = DEFAULT_BUNDLE_TIMEOUT_MS,
): Promise<string> {
  const config = await createConfig({});
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`bundling timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
  });
  try {
    const result = await Promise.race([bundle({ ref, config, dereference: false }), timeout]);
    return JSON.stringify(result.bundle.parsed);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
