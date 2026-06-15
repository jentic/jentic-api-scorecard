import { expect } from 'chai';

import { DetailLevel } from '../src/detail.ts';
import { Format } from '../src/format.ts';
import { validateScoreOptions } from '../src/validate.ts';

describe('validateScoreOptions', function () {
  describe('TTY refusal', function () {
    it('rejects --format html to a TTY without -o', function () {
      const verdict = validateScoreOptions({ format: Format.HTML }, true);
      expect(verdict.error).to.be.a('string');
      expect(verdict.error).to.contain('--format html');
    });

    it('allows --format html when stdout is piped (not a TTY)', function () {
      expect(validateScoreOptions({ format: Format.HTML }, false).error).to.equal(null);
    });

    it('allows --format html to a TTY when -o is set', function () {
      expect(
        validateScoreOptions({ format: Format.HTML, output: 'out.html' }, true).error,
      ).to.equal(null);
    });

    it('never blocks pretty or json, even to a TTY', function () {
      expect(validateScoreOptions({ format: Format.PRETTY }, true).error).to.equal(null);
      expect(validateScoreOptions({ format: Format.JSON }, true).error).to.equal(null);
    });

    it('never blocks sarif (plain JSON text, TTY-safe like json)', function () {
      expect(validateScoreOptions({ format: Format.SARIF }, true).error).to.equal(null);
      expect(validateScoreOptions({ format: Format.SARIF }, false).error).to.equal(null);
      expect(
        validateScoreOptions({ format: Format.SARIF, output: 'out.sarif' }, true).error,
      ).to.equal(null);
    });
  });

  describe('SARIF --detail warning', function () {
    it('warns when an explicit non-diagnostics --detail is combined with sarif', function () {
      const verdict = validateScoreOptions(
        { format: Format.SARIF, detail: DetailLevel.SUMMARY, detailIsExplicit: true },
        false,
      );
      expect(verdict.error).to.equal(null);
      expect(verdict.warning).to.be.a('string');
      expect(verdict.warning).to.contain('--format sarif');
    });

    it('does not warn when --detail is left at its default', function () {
      const verdict = validateScoreOptions(
        { format: Format.SARIF, detail: DetailLevel.DIMENSIONS, detailIsExplicit: false },
        false,
      );
      expect(verdict.warning).to.equal(null);
    });

    it('does not warn when --detail is explicitly diagnostics', function () {
      const verdict = validateScoreOptions(
        { format: Format.SARIF, detail: DetailLevel.DIAGNOSTICS, detailIsExplicit: true },
        false,
      );
      expect(verdict.warning).to.equal(null);
    });

    it('does not warn for non-sarif formats regardless of --detail', function () {
      const verdict = validateScoreOptions(
        { format: Format.JSON, detail: DetailLevel.SUMMARY, detailIsExplicit: true },
        false,
      );
      expect(verdict.warning).to.equal(null);
    });
  });
});
