import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';

import { detectLlmFailure, formatLlmFailureWarning } from '../src/llm-warning.ts';
import { ScorecardResult } from '../src/result.ts';

const failedPath = fileURLToPath(new URL('./fixtures/scorecard.llm-failed.json', import.meta.url));
const okPath = fileURLToPath(new URL('./fixtures/scorecard.sample.json', import.meta.url));

const failed = JSON.parse(readFileSync(failedPath, 'utf8')) as ScorecardResult;
const ok = JSON.parse(readFileSync(okPath, 'utf8')) as ScorecardResult;

describe('detectLlmFailure', function () {
  it('returns null when no llm-analysis-error diagnostic is present', function () {
    expect(detectLlmFailure(ok)).to.equal(null);
  });

  it('detects the failure and names the LLM-derived signals that defaulted', function () {
    const warning = detectLlmFailure(failed);
    expect(warning).to.not.equal(null);
    const signals = warning!.affectedSignals.map((s) => s.signal);
    expect(signals).to.include('Descriptive Richness');
    for (const affected of warning!.affectedSignals) {
      expect(affected.dimension).to.be.a('string').and.not.empty;
    }
  });

  it('carries the engine cause message', function () {
    const warning = detectLlmFailure(failed);
    expect(warning!.cause).to.be.a('string').and.contain('LLM analysis failed');
  });
});

describe('formatLlmFailureWarning', function () {
  it('renders a stderr-style warning naming each affected signal and dimension', function () {
    const warning = detectLlmFailure(failed)!;
    const text = formatLlmFailureWarning(warning);
    expect(text).to.match(/^warning: LLM analysis failed/);
    expect(text).to.include('Descriptive Richness (AI Discoverability)');
    expect(text).to.include('default to 100');
    expect(text).to.include('NOT a true --with-llm result');
    expect(text.endsWith('\n')).to.equal(true);
  });

  it('renders without a signal list when none could be enumerated', function () {
    const text = formatLlmFailureWarning({ affectedSignals: [] });
    expect(text).to.match(/^warning: LLM analysis failed/);
    expect(text).to.not.include('  - ');
  });
});
