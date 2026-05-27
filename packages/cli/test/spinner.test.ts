import { expect } from 'chai';

import { clearSpinner, done, setQuiet, spin } from '../src/spinner.ts';

function captureStderr(fn: () => void): string {
  const original = process.stderr.write.bind(process.stderr);
  let captured = '';
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stderr.write;
  try {
    fn();
  } finally {
    process.stderr.write = original;
  }
  return captured;
}

describe('spinner', function () {
  afterEach(function () {
    clearSpinner();
    setQuiet(false);
  });

  describe('quiet mode', function () {
    it('done() emits nothing to stderr when no spinner is active', function () {
      setQuiet(true);
      const stderr = captureStderr(() => {
        done('Scoring done in 1.0s');
      });
      expect(stderr).to.equal('');
    });

    it('spin() emits nothing to stderr', function () {
      setQuiet(true);
      const stderr = captureStderr(() => {
        spin('Bundling…');
      });
      expect(stderr).to.equal('');
    });
  });

  describe('non-quiet mode', function () {
    it('done() falls back to a stderr write when no spinner is active', function () {
      const stderr = captureStderr(() => {
        done('Scoring done in 1.0s');
      });
      expect(stderr).to.equal('Scoring done in 1.0s\n');
    });
  });
});
