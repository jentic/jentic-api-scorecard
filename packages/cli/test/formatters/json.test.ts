import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';

import { DetailLevel, filterByDetail } from '../../src/detail.ts';
import { formatJson } from '../../src/formatters/json.ts';
import { ScorecardResult } from '../../src/result.ts';

const fixturePath = fileURLToPath(new URL('../fixtures/scorecard.sample.json', import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as ScorecardResult;

describe('formatJson', function () {
  describe('default detail (dimensions)', function () {
    let output: string;
    let parsed: ScorecardResult;

    before(function () {
      output = formatJson(filterByDetail(fixture, DetailLevel.DIMENSIONS));
      parsed = JSON.parse(output) as ScorecardResult;
    });

    it('produces parseable JSON', function () {
      expect(() => JSON.parse(output)).to.not.throw();
    });

    it('ends with a newline', function () {
      expect(output.endsWith('\n')).to.equal(true);
    });

    it('uses 2-space indentation', function () {
      expect(output).to.include('\n  ');
    });

    it('keeps summary; omits details and diagnostics', function () {
      expect(parsed).to.have.property('summary');
      expect(parsed.details).to.equal(undefined);
      expect(parsed.diagnostics).to.equal(undefined);
    });

    it('preserves summary.dimensions', function () {
      expect(parsed.summary.dimensions).to.be.an('array').with.length(6);
    });

    it('passes summary.score through verbatim', function () {
      expect(parsed.summary.score).to.equal(66.52);
    });

    it('passes engine version through verbatim', function () {
      expect(parsed.metadata?.engine?.version).to.equal('0.4.1+jairf.1.0.0');
    });

    it('passes dimension kinds through verbatim', function () {
      const kinds = (parsed.summary.dimensions ?? []).map((d) => d.kind);
      expect(kinds).to.deep.equal(['FC', 'DXJ', 'ARAX', 'AU', 'SEC', 'AID']);
    });
  });

  describe('detail = summary', function () {
    let parsed: ScorecardResult;

    before(function () {
      parsed = JSON.parse(
        formatJson(filterByDetail(fixture, DetailLevel.SUMMARY)),
      ) as ScorecardResult;
    });

    it('omits summary.dimensions', function () {
      expect(parsed.summary.dimensions).to.equal(undefined);
    });

    it('omits details and diagnostics', function () {
      expect(parsed.details).to.equal(undefined);
      expect(parsed.diagnostics).to.equal(undefined);
    });

    it('keeps the headline summary fields', function () {
      expect(parsed.summary.score).to.equal(66.52);
      expect(parsed.summary.grade).to.equal('B');
      expect(parsed.summary.level).to.equal('ai-aware');
    });
  });

  describe('detail = signals', function () {
    let parsed: ScorecardResult;

    before(function () {
      parsed = JSON.parse(
        formatJson(filterByDetail(fixture, DetailLevel.SIGNALS)),
      ) as ScorecardResult;
    });

    it('keeps summary.dimensions', function () {
      expect(parsed.summary.dimensions).to.be.an('array').with.length(6);
    });

    it('adds details', function () {
      expect(parsed.details).to.be.an('array');
    });

    it('still omits diagnostics', function () {
      expect(parsed.diagnostics).to.equal(undefined);
    });
  });

  describe('detail = diagnostics', function () {
    it('includes both details and diagnostics', function () {
      const parsed = JSON.parse(
        formatJson(filterByDetail(fixture, DetailLevel.DIAGNOSTICS)),
      ) as ScorecardResult;
      expect(parsed.details).to.be.an('array');
      expect(parsed.diagnostics).to.be.an('array');
    });
  });

  describe('shape robustness', function () {
    it('produces parseable JSON for a minimal ScorecardResult', function () {
      const minimal: ScorecardResult = {
        summary: {
          score: fixture.summary.score,
          level: fixture.summary.level,
          grade: fixture.summary.grade,
        },
      };
      const output = formatJson(minimal);
      expect(() => JSON.parse(output)).to.not.throw();
      const parsed = JSON.parse(output) as ScorecardResult;
      expect(parsed.summary.score).to.equal(fixture.summary.score);
    });
  });
});
