import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';

import { DetailLevel, filterByDetail, isDetailLevel } from '../src/detail.ts';
import { ScorecardResult } from '../src/result.ts';

const fixturePath = fileURLToPath(new URL('./fixtures/scorecard.sample.json', import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as ScorecardResult;

describe('filterByDetail', function () {
  describe('summary', function () {
    let out: ScorecardResult;

    before(function () {
      out = filterByDetail(fixture, DetailLevel.SUMMARY);
    });

    it('keeps summary headline fields', function () {
      expect(out.summary.score).to.equal(fixture.summary.score);
      expect(out.summary.level).to.equal(fixture.summary.level);
      expect(out.summary.grade).to.equal(fixture.summary.grade);
    });

    it('strips summary.dimensions', function () {
      expect(out.summary.dimensions).to.equal(undefined);
    });

    it('strips details and diagnostics', function () {
      expect(out.details).to.equal(undefined);
      expect(out.diagnostics).to.equal(undefined);
    });

    it('preserves apiMetadata', function () {
      expect(out.apiMetadata).to.deep.equal(fixture.apiMetadata);
    });
  });

  describe('dimensions', function () {
    let out: ScorecardResult;

    before(function () {
      out = filterByDetail(fixture, DetailLevel.DIMENSIONS);
    });

    it('keeps summary.dimensions', function () {
      expect(out.summary.dimensions).to.deep.equal(fixture.summary.dimensions);
    });

    it('strips details and diagnostics', function () {
      expect(out.details).to.equal(undefined);
      expect(out.diagnostics).to.equal(undefined);
    });
  });

  describe('signals', function () {
    let out: ScorecardResult;

    before(function () {
      out = filterByDetail(fixture, DetailLevel.SIGNALS);
    });

    it('keeps details', function () {
      expect(out.details).to.deep.equal(fixture.details);
    });

    it('strips diagnostics', function () {
      expect(out.diagnostics).to.equal(undefined);
    });

    it('keeps summary.dimensions', function () {
      expect(out.summary.dimensions).to.deep.equal(fixture.summary.dimensions);
    });
  });

  describe('diagnostics', function () {
    let out: ScorecardResult;

    before(function () {
      out = filterByDetail(fixture, DetailLevel.DIAGNOSTICS);
    });

    it('keeps details and diagnostics', function () {
      expect(out.details).to.deep.equal(fixture.details);
      expect(out.diagnostics).to.deep.equal(fixture.diagnostics);
    });

    it('keeps summary.dimensions', function () {
      expect(out.summary.dimensions).to.deep.equal(fixture.summary.dimensions);
    });
  });

  describe('shape robustness', function () {
    it('omits diagnostics field when input has none', function () {
      const input: ScorecardResult = { summary: fixture.summary, details: fixture.details };
      const out = filterByDetail(input, DetailLevel.DIAGNOSTICS);
      expect('diagnostics' in out).to.equal(false);
    });

    it('omits details field when input has none', function () {
      const input: ScorecardResult = { summary: fixture.summary, diagnostics: fixture.diagnostics };
      const out = filterByDetail(input, DetailLevel.SIGNALS);
      expect('details' in out).to.equal(false);
    });

    it('does not mutate the input', function () {
      const snapshot = JSON.parse(JSON.stringify(fixture)) as ScorecardResult;
      filterByDetail(fixture, DetailLevel.SUMMARY);
      expect(fixture).to.deep.equal(snapshot);
    });
  });
});

describe('isDetailLevel', function () {
  it('accepts the four canonical levels', function () {
    expect(isDetailLevel('summary')).to.equal(true);
    expect(isDetailLevel('dimensions')).to.equal(true);
    expect(isDetailLevel('signals')).to.equal(true);
    expect(isDetailLevel('diagnostics')).to.equal(true);
  });

  it('rejects unknown values', function () {
    expect(isDetailLevel('verbose')).to.equal(false);
    expect(isDetailLevel('')).to.equal(false);
    expect(isDetailLevel('SUMMARY')).to.equal(false);
  });
});
