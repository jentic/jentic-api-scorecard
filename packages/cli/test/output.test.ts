import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect } from 'chai';

import { writeReport } from '../src/output.ts';

describe('writeReport', function () {
  let workDir: string;

  beforeEach(function () {
    workDir = mkdtempSync(join(tmpdir(), 'jentic-output-'));
  });

  afterEach(function () {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('writes content to the target path', function () {
    const target = join(workDir, 'report.json');
    writeReport('{"hello":"world"}\n', target);
    expect(readFileSync(target, 'utf8')).to.equal('{"hello":"world"}\n');
  });

  it('overwrites an existing file', function () {
    const target = join(workDir, 'report.json');
    writeFileSync(target, 'stale contents');
    writeReport('fresh', target);
    expect(readFileSync(target, 'utf8')).to.equal('fresh');
  });

  it('leaves no temp file behind on success', function () {
    const target = join(workDir, 'report.json');
    writeReport('payload', target);
    const leftovers = readdirSync(workDir).filter((name) => name.startsWith('report.json.tmp-'));
    expect(leftovers).to.deep.equal([]);
  });

  it('throws a wrapped error when the parent directory does not exist', function () {
    const target = join(workDir, 'missing-dir', 'report.json');
    expect(() => writeReport('payload', target)).to.throw(/failed to write .*report\.json/);
  });

  it('does not partially overwrite the target when the temp open fails', function () {
    if (process.platform === 'win32' || process.getuid?.() === 0) {
      this.skip();
    }
    const unwritableDir = join(workDir, 'ro');
    mkdirSync(unwritableDir);
    const blocked = join(unwritableDir, 'report.json');
    writeFileSync(blocked, 'pre-existing');
    chmodSync(unwritableDir, 0o500);
    try {
      expect(() => writeReport('new', blocked)).to.throw(/failed to write/);
      expect(readFileSync(blocked, 'utf8')).to.equal('pre-existing');
    } finally {
      chmodSync(unwritableDir, 0o700);
    }
  });
});
