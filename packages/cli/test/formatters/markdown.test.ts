import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';

import { DetailLevel, filterByDetail } from '../../src/detail.ts';
import { formatMarkdown } from '../../src/formatters/markdown.ts';
import { ScorecardResult } from '../../src/result.ts';

const fixturePath = fileURLToPath(new URL('../fixtures/scorecard.sample.json', import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as ScorecardResult;

describe('formatMarkdown', function () {
  describe('default detail (dimensions)', function () {
    let output: string;

    before(function () {
      output = formatMarkdown(filterByDetail(fixture, DetailLevel.DIMENSIONS), {
        detail: DetailLevel.DIMENSIONS,
      });
    });

    it('renders an H1 headline', function () {
      expect(output).to.include('# API Readiness Scorecard');
    });

    it('renders the rounded score, upper-cased level, and grade', function () {
      expect(output).to.include('Score **67** / 100 — AI-AWARE (B)');
    });

    it('renders the API metadata name and version', function () {
      expect(output).to.include('**Sample API** v0.0.1');
    });

    it('renders a GFM dimension table with a header and separator row', function () {
      expect(output).to.include('| Kind | Name | Score | Grade |');
      expect(output).to.include('| --- | --- | --- | --- |');
    });

    it('renders one row per dimension with the expected kinds', function () {
      const kinds = ['FC', 'DXJ', 'ARAX', 'AU', 'SEC', 'AID'];
      for (const kind of kinds) {
        expect(output).to.match(new RegExp(`\\| ${kind} \\|`));
      }
      const dataRows = output.split('\n').filter((l) => /^\| (FC|DXJ|ARAX|AU|SEC|AID) \|/.test(l));
      expect(dataRows).to.have.length(6);
    });

    it('renders dimension scores as rounded integers', function () {
      expect(output).to.include('| FC | Foundational Compliance | 74 | A- |');
    });

    it('renders the API stats line', function () {
      expect(output).to.include('**1** operations');
      expect(output).to.include('**2** schemas');
    });

    it('does not render the Signals or Diagnostics sections', function () {
      expect(output).to.not.include('## Signals');
      expect(output).to.not.include('## Diagnostics');
    });
  });

  describe('detail = summary', function () {
    let output: string;

    before(function () {
      output = formatMarkdown(filterByDetail(fixture, DetailLevel.SUMMARY), {
        detail: DetailLevel.SUMMARY,
      });
    });

    it('renders the headline', function () {
      expect(output).to.include('# API Readiness Scorecard');
      expect(output).to.include('Score **67** / 100');
    });

    it('omits the dimension table', function () {
      expect(output).to.not.include('## Dimensions');
    });

    it('omits the Signals and Diagnostics sections', function () {
      expect(output).to.not.include('## Signals');
      expect(output).to.not.include('## Diagnostics');
    });
  });

  describe('detail = signals', function () {
    let output: string;

    before(function () {
      output = formatMarkdown(filterByDetail(fixture, DetailLevel.SIGNALS), {
        detail: DetailLevel.SIGNALS,
      });
    });

    it('renders the dimension table', function () {
      expect(output).to.include('## Dimensions');
    });

    it('renders the Signals section with per-dimension sub-headings', function () {
      expect(output).to.include('## Signals');
      expect(output).to.include('### FC — Foundational Compliance');
    });

    it('renders signal scores as percentages', function () {
      expect(output).to.match(/\| Lint Results \| \d+% \|/);
    });

    it('does not render the Diagnostics section', function () {
      expect(output).to.not.include('## Diagnostics');
    });
  });

  describe('detail = diagnostics', function () {
    let output: string;

    before(function () {
      output = formatMarkdown(filterByDetail(fixture, DetailLevel.DIAGNOSTICS), {
        detail: DetailLevel.DIAGNOSTICS,
      });
    });

    it('renders both the Signals and Diagnostics sections', function () {
      expect(output).to.include('## Signals');
      expect(output).to.include('## Diagnostics');
    });

    it('renders the severity tally with the total count', function () {
      expect(output).to.include('**34** diagnostics');
      expect(output).to.include('2 errors');
      expect(output).to.include('8 warnings');
      expect(output).to.include('24 info');
    });

    it('renders a diagnostics table with a real code from the fixture', function () {
      expect(output).to.include('| Code | Severity | Message |');
      expect(output).to.include('| MISSING_SERVER_URL | error |');
    });
  });

  describe('shape robustness', function () {
    it('renders a headline for a minimal result without throwing', function () {
      const minimal: ScorecardResult = {
        summary: {
          score: fixture.summary.score,
          level: fixture.summary.level,
          grade: fixture.summary.grade,
        },
      };
      const output = formatMarkdown(minimal);
      expect(output).to.include('# API Readiness Scorecard');
      expect(output).to.include('Score **67** / 100');
    });

    it('emits no dimension table when dimensions are absent', function () {
      const minimal: ScorecardResult = {
        summary: {
          score: fixture.summary.score,
          level: fixture.summary.level,
          grade: fixture.summary.grade,
        },
      };
      const output = formatMarkdown(minimal, { detail: DetailLevel.DIMENSIONS });
      expect(output).to.not.include('## Dimensions');
      expect(output).to.not.include('| Kind | Name | Score | Grade |');
    });

    it('renders "0 diagnostics" when diagnostics is empty', function () {
      const noDiag: ScorecardResult = { ...fixture, diagnostics: [] };
      const output = formatMarkdown(noDiag, { detail: DetailLevel.DIAGNOSTICS });
      expect(output).to.include('## Diagnostics');
      expect(output).to.include('0 diagnostics');
    });

    it('omits the em dash when no diagnostic falls in the 1–4 severity order', function () {
      const result: ScorecardResult = {
        summary: { score: 50, level: 'ai-aware', grade: 'C' },
        diagnostics: [{ source: 'test', severity: 9, message: 'out of range' }],
      };
      const output = formatMarkdown(result, { detail: DetailLevel.DIAGNOSTICS });
      expect(output).to.include('**1** diagnostics');
      expect(output).to.not.match(/\*\*1\*\* diagnostics —\s*$/m);
      expect(output).to.not.include('diagnostics — \n');
    });
  });

  describe('cell escaping', function () {
    it('escapes a literal pipe and collapses a newline in a diagnostic message', function () {
      const result: ScorecardResult = {
        summary: { score: 50, level: 'ai-aware', grade: 'C' },
        diagnostics: [
          {
            source: 'test',
            severity: 1,
            code: 'PIPE_TEST',
            message: 'left | right\nsecond line',
          },
        ],
      };
      const output = formatMarkdown(result, { detail: DetailLevel.DIAGNOSTICS });
      const row = output.split('\n').find((l) => l.includes('PIPE_TEST'));
      expect(row).to.be.a('string');
      expect(row).to.include('left \\| right second line');
      // The only unescaped pipes in the row are the GFM cell delimiters.
      expect(row).to.not.match(/[^\\]\| right/);
      expect(row).to.not.include('\n');
    });

    it('escapes a backslash before a pipe so the pipe stays escaped', function () {
      const result: ScorecardResult = {
        summary: { score: 50, level: 'ai-aware', grade: 'C' },
        diagnostics: [
          {
            source: 'test',
            severity: 1,
            code: 'BACKSLASH_TEST',
            message: 'a\\|b',
          },
        ],
      };
      const output = formatMarkdown(result, { detail: DetailLevel.DIAGNOSTICS });
      const row = output.split('\n').find((l) => l.includes('BACKSLASH_TEST'));
      expect(row).to.be.a('string');
      // Backslash escaped first (→ `\\`), then the pipe (→ `\|`), so the cell
      // content is `\\\|` — a GFM-literal backslash followed by a GFM-literal,
      // non-cell-breaking pipe. Three content cells plus two delimiters means
      // exactly five `|` once the escaped pipe is removed from the count.
      expect(row).to.include('a\\\\\\|b');
      const unescapedPipes = (row as string).replace(/\\\|/g, '').match(/\|/g) ?? [];
      expect(unescapedPipes).to.have.length(4);
    });
  });
});
