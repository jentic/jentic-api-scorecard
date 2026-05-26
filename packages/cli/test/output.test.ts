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

import { Format } from '../src/format.ts';
import { writeReport } from '../src/output.ts';

describe('writeReport', function () {
  let workDir: string;

  beforeEach(function () {
    workDir = mkdtempSync(join(tmpdir(), 'jentic-output-'));
  });

  afterEach(function () {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('writes pretty content to the target path', function () {
    const target = join(workDir, 'report.txt');
    writeReport('hello world\n', target, Format.PRETTY);
    expect(readFileSync(target, 'utf8')).to.equal('hello world\n');
  });

  it('strips ANSI escapes from pretty output', function () {
    const target = join(workDir, 'report.txt');
    writeReport('\x1B[36mteal\x1B[39m text', target, Format.PRETTY);
    expect(readFileSync(target, 'utf8')).to.equal('teal text');
  });

  it('preserves JSON content byte-for-byte (engine-verbatim)', function () {
    const target = join(workDir, 'report.json');
    // Pathological: a JSON string value containing what looks like an ANSI
    // sequence. JSON is engine-verbatim per docs/architecture.md §7, so the
    // bytes must round-trip.
    const payload = '{"note":"\\u001b[36mfrom engine\\u001b[39m"}';
    writeReport(payload, target, Format.JSON);
    expect(readFileSync(target, 'utf8')).to.equal(payload);
  });

  it('overwrites an existing file', function () {
    const target = join(workDir, 'report.json');
    writeFileSync(target, 'stale contents');
    writeReport('fresh', target, Format.JSON);
    expect(readFileSync(target, 'utf8')).to.equal('fresh');
  });

  it('leaves no temp file behind on success', function () {
    const target = join(workDir, 'report.json');
    writeReport('payload', target, Format.JSON);
    const leftovers = readdirSync(workDir).filter((name) => name.startsWith('report.json.tmp-'));
    expect(leftovers).to.deep.equal([]);
  });

  it('throws a wrapped error when the parent directory does not exist', function () {
    const target = join(workDir, 'missing-dir', 'report.json');
    expect(() => writeReport('payload', target, Format.JSON)).to.throw(
      /failed to write .*report\.json/,
    );
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
      expect(() => writeReport('new', blocked, Format.JSON)).to.throw(/failed to write/);
      expect(readFileSync(blocked, 'utf8')).to.equal('pre-existing');
    } finally {
      chmodSync(unwritableDir, 0o700);
    }
  });
});
