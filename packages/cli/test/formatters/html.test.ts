import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';

import { DetailLevel, filterByDetail } from '../../src/detail.ts';
import { formatHtml } from '../../src/formatters/html.ts';
import { ScorecardResult } from '../../src/result.ts';

const fixturePath = fileURLToPath(new URL('../fixtures/scorecard.sample.json', import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as ScorecardResult;

describe('formatHtml', function () {
  let output: string;

  before(function () {
    output = formatHtml(filterByDetail(fixture, DetailLevel.DIMENSIONS));
  });

  it('produces a single self-contained HTML document', function () {
    expect(output).to.match(/^<!doctype html>/i);
    // No external resource references — only inlined data: URIs are allowed.
    expect(output, 'no external <script src>').to.not.match(/<script[^>]+src="(?!data:)[^"]+"/i);
    expect(output, 'no external <link href>').to.not.match(/<link[^>]+href="(?!data:)[^"]+"/i);
  });

  it('injects the filtered result into window.__SCORECARD__', function () {
    expect(output).to.contain('window.__SCORECARD__ = {');
    const island = output.match(/<script id="__SCORECARD_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    expect(island, 'data island present').to.not.equal(null);
    const assignment = (island?.[1] ?? '')
      .replace(/^\s*window\.__SCORECARD__\s*=\s*/, '')
      .replace(/;\s*$/, '');
    const parsed = JSON.parse(assignment) as ScorecardResult;
    expect(parsed.summary.score).to.equal(fixture.summary.score);
    expect(parsed.summary.grade).to.equal(fixture.summary.grade);
  });
});
