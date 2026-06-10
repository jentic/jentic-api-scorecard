#!/usr/bin/env node
// Assert the published @jentic/api-scorecard-cli tarball includes the agent
// skill files. The skill is copied from the repo-root canonical skills/ tree
// into the package at prepack time (see packages/cli prepack), so this also
// proves that copy step works. `npm pack --dry-run --json` runs the package's
// prepack/postpack lifecycle, so the reported file list reflects the real
// publish artifact without leaving a tarball on disk.

import { execFileSync } from 'node:child_process';

const REQUIRED = [
  'skills/jentic-api-scorecard/SKILL.md',
  'skills/jentic-api-scorecard/references/llm-analysis.md',
];

const raw = execFileSync(
  'npm',
  ['pack', '--dry-run', '--json', '-w', '@jentic/api-scorecard-cli'],
  { encoding: 'utf8' },
);

// `npm pack --json` emits a one-element array (one per packed workspace).
const entries = JSON.parse(raw).flatMap((pkg) => pkg.files.map((f) => f.path));
const missing = REQUIRED.filter((p) => !entries.includes(p));

if (missing.length > 0) {
  console.error('Skill files missing from the @jentic/api-scorecard-cli tarball:');
  for (const p of missing) console.error(`  - ${p}`);
  console.error('\nPacked files:');
  for (const p of entries) console.error(`  ${p}`);
  process.exit(1);
}

console.log('Skill files present in the @jentic/api-scorecard-cli tarball:');
for (const p of REQUIRED) console.log(`  ✓ ${p}`);
