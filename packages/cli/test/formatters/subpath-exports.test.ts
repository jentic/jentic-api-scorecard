import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Ajv } from 'ajv';
import { expect } from 'chai';

import { formatMarkdown } from '@jentic/api-scorecard-cli/formatters/markdown';
import { formatSarif } from '@jentic/api-scorecard-cli/formatters/sarif';

import { ScorecardResult } from '../../src/result.ts';

const fixturePath = fileURLToPath(new URL('../fixtures/scorecard.sample.json', import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as ScorecardResult;

const schemaPath = fileURLToPath(new URL('../fixtures/sarif-2.1.0.schema.json', import.meta.url));
const sarifSchema = JSON.parse(readFileSync(schemaPath, 'utf8'));

// The Phase 19 action helper imports these formatters through the package's
// subpath exports — never through the `score` command — to derive SARIF and
// Markdown from one captured report.json (score-once). This test resolves the
// published specifiers (not the relative src paths) so a missing or misnamed
// "./formatters/sarif" / "./formatters/markdown" exports entry fails the suite,
// not just CI.
describe('CLI subpath exports', function () {
  it('@jentic/api-scorecard-cli/formatters/sarif exposes formatSarif', function () {
    expect(formatSarif).to.be.a('function');
  });

  it('@jentic/api-scorecard-cli/formatters/markdown exposes formatMarkdown', function () {
    expect(formatMarkdown).to.be.a('function');
  });

  it('formatSarif over the fixture is schema-valid SARIF 2.1.0', function () {
    const doc = JSON.parse(formatSarif(fixture));
    const ajv = new Ajv({ strict: false, logger: false });
    expect(ajv.compile(sarifSchema)(doc)).to.equal(true);
  });

  it('formatMarkdown over the fixture renders the headline', function () {
    const output = formatMarkdown(fixture);
    expect(output).to.include('# API Readiness Scorecard');
  });
});
