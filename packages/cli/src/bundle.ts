import { bundle, createConfig } from '@redocly/openapi-core';

export async function bundleSpec(ref: string): Promise<string> {
  const config = await createConfig({});
  const result = await bundle({ ref, config, dereference: false });
  return JSON.stringify(result.bundle.parsed);
}
