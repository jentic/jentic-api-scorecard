import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import chalk from 'chalk';
import { expect } from 'chai';

import { DetailLevel } from '../../src/detail.ts';
import { formatPretty } from '../../src/formatters/pretty.ts';
import { ScorecardResult } from '../../src/result.ts';

const fixturePath = fileURLToPath(new URL('../fixtures/scorecard.sample.json', import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as ScorecardResult;

const SOURCE = 'docker/.build/sample.yaml';

function strip(s: string): string {
  // chalk.level=0 already disables ANSI in the formatter's chalk instance, but
  // belt-and-suspenders for any process-level chalk overrides in test runners.
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1B\[[0-9;]*m/g, '');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('formatPretty', function () {
  before(function () {
    chalk.level = 0;
  });

  describe('default detail (dimensions)', function () {
    let output: string;

    before(function () {
      output = strip(formatPretty(fixture, SOURCE));
    });

    it('renders the JENTIC banner', function () {
      expect(output).to.include('██╗███████╗███╗');
      expect(output).to.include('API Readiness Scorecard');
    });

    it('reports the engine + framework versions from metadata.engine.version', function () {
      expect(output).to.include('Scoring Framework 1.0.0');
      expect(output).to.include('Scoring Engine 0.4.1');
    });

    it('renders the API metadata heading', function () {
      expect(output).to.include('Sample API v0.0.1');
    });

    it('echoes the source argument verbatim', function () {
      expect(output).to.include(`OpenAPI Document: ${SOURCE}`);
    });

    it('reports the rounded final score and grade', function () {
      expect(output).to.include('Final score:');
      expect(output).to.include('67');
      expect(output).to.include('/ 100');
      expect(output).to.include('Readiness:');
      expect(output).to.include('AI-AWARE');
      expect(output).to.include('(B)');
    });

    it('renders one row per dimension with kind, name, and grade', function () {
      const dims: { kind: string; name: string; grade: string }[] = [
        { kind: 'FC', name: 'Foundational Compliance', grade: 'A-' },
        { kind: 'DXJ', name: 'Developer Experience & Jentic Compatibility', grade: 'C' },
        { kind: 'ARAX', name: 'AI-Readiness & Agent Experience', grade: 'D' },
        { kind: 'AU', name: 'Agent Usability', grade: 'A+' },
        { kind: 'SEC', name: 'Security', grade: 'A+' },
        { kind: 'AID', name: 'AI Discoverability', grade: 'A+' },
      ];
      for (const d of dims) {
        const lineRegex = new RegExp(
          `${escapeRegex(d.kind)}\\s+${escapeRegex(d.name)}\\s+[▄ ]+\\s+\\d+\\s+${escapeRegex(d.grade)}`,
        );
        expect(output).to.match(lineRegex);
      }
    });

    it('renders the API stats row from apiMetadata counts', function () {
      expect(output).to.include('1 operations');
      expect(output).to.include('2 schemas');
    });

    it('hints at --detail signals', function () {
      expect(output).to.include('--detail signals');
    });

    it('hints at --format json --detail diagnostics', function () {
      expect(output).to.include('--format json --detail diagnostics');
    });

    it('does not render the Signals or Diagnostics sections', function () {
      expect(output).to.not.include('Signals');
      expect(output).to.not.include('Diagnostics');
    });
  });

  describe('detail = summary', function () {
    let output: string;

    before(function () {
      output = strip(formatPretty(fixture, SOURCE, { detail: DetailLevel.SUMMARY }));
    });

    it('omits the Dimensions table', function () {
      expect(output).to.not.include('Dimensions');
    });

    it('still renders headline + readiness', function () {
      expect(output).to.include('Final score:');
      expect(output).to.include('Readiness:');
    });

    it('hints at --detail dimensions', function () {
      expect(output).to.include('--detail dimensions');
    });

    it('hints at --format json --detail diagnostics', function () {
      expect(output).to.include('--format json --detail diagnostics');
    });
  });

  describe('detail = signals', function () {
    let output: string;

    before(function () {
      output = strip(formatPretty(fixture, SOURCE, { detail: DetailLevel.SIGNALS }));
    });

    it('renders the Signals section', function () {
      expect(output).to.include('Signals');
    });

    it('renders signal rows with percentage scores', function () {
      expect(output).to.match(/\d+%/);
    });

    it('does not render Diagnostics', function () {
      expect(output).to.not.include('Diagnostics');
    });

    it('hints at --detail diagnostics', function () {
      expect(output).to.include('--detail diagnostics');
    });

    it('hints at --format json --detail diagnostics', function () {
      expect(output).to.include('--format json --detail diagnostics');
    });
  });

  describe('detail = diagnostics', function () {
    let output: string;

    before(function () {
      output = strip(formatPretty(fixture, SOURCE, { detail: DetailLevel.DIAGNOSTICS }));
    });

    it('renders the Diagnostics section with the total count', function () {
      expect(output).to.match(/Diagnostics\s+34/);
    });

    it('renders the severity tally pluralised by count', function () {
      expect(output).to.include('2 errors');
      expect(output).to.include('8 warnings');
      expect(output).to.include('24 info');
    });

    it('previews up to 5 findings per severity bucket', function () {
      const moreLines = output.match(/… \+\d+ more/g) ?? [];
      expect(moreLines.length).to.be.greaterThan(0);
      expect(output).to.include('+3 more');
      expect(output).to.include('+19 more');
    });

    it('renders a real diagnostic code from the fixture', function () {
      expect(output).to.include('MISSING_SERVER_URL');
    });

    it('renders both the Signals and Diagnostics sections together', function () {
      expect(output).to.include('Signals');
      expect(output).to.include('Diagnostics');
    });
  });

  describe('shape robustness', function () {
    it('tolerates a result with no apiMetadata', function () {
      const minimal: ScorecardResult = { summary: fixture.summary };
      const output = strip(formatPretty(minimal, SOURCE));
      expect(output).to.include('Final score:');
      expect(output).to.not.include('Sample API');
    });

    it('tolerates a result with no dimensions', function () {
      const flat: ScorecardResult = {
        summary: {
          score: fixture.summary.score,
          level: fixture.summary.level,
          grade: fixture.summary.grade,
        },
      };
      const output = strip(formatPretty(flat, SOURCE));
      expect(output).to.include('Final score:');
      expect(output).to.not.include('Dimensions');
    });

    it('renders Diagnostics 0 when diagnostics is empty', function () {
      const noDiag: ScorecardResult = { ...fixture, diagnostics: [] };
      const output = strip(formatPretty(noDiag, SOURCE, { detail: DetailLevel.DIAGNOSTICS }));
      expect(output).to.match(/Diagnostics\s+0/);
    });
  });
});
