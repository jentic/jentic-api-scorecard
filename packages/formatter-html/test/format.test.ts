import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';

import { injectScorecard, type ScorecardResult } from '../src/index.ts';

const TEMPLATE = [
  '<!doctype html><html><head></head><body>',
  '<div id="root"></div>',
  '<script id="__SCORECARD_DATA__">window.__SCORECARD__ = null;</script>',
  '</body></html>',
].join('\n');

// Pull the value assigned to window.__SCORECARD__ back out of the rendered island.
function readInjected(html: string): unknown {
  const m = html.match(/<script id="__SCORECARD_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m || m[1] === undefined) throw new Error('data island not found in output');
  const assignment = m[1].replace(/^\s*window\.__SCORECARD__\s*=\s*/, '').replace(/;\s*$/, '');
  return JSON.parse(assignment);
}

describe('injectScorecard', function () {
  it('assigns the result to window.__SCORECARD__', function () {
    const out = injectScorecard(TEMPLATE, { summary: { score: 66.5 } });
    expect(out).to.contain('window.__SCORECARD__ = {');
    expect(out).to.not.contain('window.__SCORECARD__ = null;');
  });

  it('round-trips the result through the data island', function () {
    const result: ScorecardResult = {
      apiMetadata: { name: 'Sample API' },
      summary: { score: 66.52, grade: 'B' },
      nested: { list: [1, 2, 3], flag: true, nothing: null },
    };
    expect(readInjected(injectScorecard(TEMPLATE, result))).to.deep.equal(result);
  });

  it('escapes </script> so the payload cannot break out of the island', function () {
    const evil: ScorecardResult = { x: '</script><script>alert(1)</script>' };
    const out = injectScorecard(TEMPLATE, evil);
    const island = out.match(/<script id="__SCORECARD_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    expect(island, 'exactly one island close is matched').to.not.equal(null);
    expect(island?.[1] ?? '').to.not.contain('</script');
    expect(readInjected(out)).to.deep.equal(evil);
  });

  it('preserves unicode line separators through round-trip', function () {
    const result: ScorecardResult = { note: 'line and para' };
    expect(readInjected(injectScorecard(TEMPLATE, result))).to.deep.equal(result);
  });

  it('preserves $ replacement-pattern sequences in the payload', function () {
    // String.replace interprets $1/$&/$`/$' in a replacement *string*; spec content
    // routinely contains `$`. The payload must survive verbatim regardless.
    const result: ScorecardResult = {
      price: 'costs $5 and $1 each',
      a: 'see $`example',
      b: 'A & B $&',
      c: "tail $' here",
    };
    expect(readInjected(injectScorecard(TEMPLATE, result))).to.deep.equal(result);
  });
});

const DIST = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const TEMPLATE_BUILT = fileURLToPath(new URL('../dist/app/index.html', import.meta.url));

// format() reads the Vite-built template, so it only works against a build. Exercise
// the BUILT entry (dist/index.js) — running format() from TS source would resolve the
// template relative to src/, which has no index.html. Skips when no build is present.
const built = existsSync(DIST) && existsSync(TEMPLATE_BUILT);

describe('format (built template)', function () {
  it('produces a self-contained document with no external scripts or stylesheets', async function () {
    if (!built) this.skip();
    const { format } = (await import(DIST)) as { format: (r: ScorecardResult) => string };
    const html = format({ apiMetadata: { name: 'X' }, summary: { score: 1 }, details: [] });
    expect(html).to.contain('window.__SCORECARD__ = {');
    // No external resource references — only inlined data: URIs are allowed.
    const externalSrc = html.match(/<script[^>]+src="(?!data:)[^"]+"/i);
    const externalHref = html.match(/<link[^>]+href="(?!data:)[^"]+"/i);
    expect(externalSrc, 'no external <script src>').to.equal(null);
    expect(externalHref, 'no external <link href>').to.equal(null);
  });
});
