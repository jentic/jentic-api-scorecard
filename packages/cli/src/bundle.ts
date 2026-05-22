import { bundle, createConfig } from '@redocly/openapi-core';

export async function bundleLocalSpec(path: string): Promise<string> {
  const config = await createConfig({});
  const result = await bundle({ ref: path, config, dereference: false });
  return JSON.stringify(result.bundle.parsed);
}
