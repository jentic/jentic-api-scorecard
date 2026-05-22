#!/usr/bin/env node

import { main } from '../dist/index.js';

main().catch((err) => {
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
