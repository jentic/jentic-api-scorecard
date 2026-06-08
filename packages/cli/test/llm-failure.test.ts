import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';

import { detectLlmFailure, formatLlmFailureError } from '../src/llm-failure.ts';
import { ScorecardResult } from '../src/result.ts';

const failedPath = fileURLToPath(new URL('./fixtures/scorecard.llm-failed.json', import.meta.url));
const unreachablePath = fileURLToPath(
  new URL('./fixtures/scorecard.llm-unreachable.json', import.meta.url),
);
const okPath = fileURLToPath(new URL('./fixtures/scorecard.sample.json', import.meta.url));

const failed = JSON.parse(readFileSync(failedPath, 'utf8')) as ScorecardResult;
const unreachable = JSON.parse(readFileSync(unreachablePath, 'utf8')) as ScorecardResult;
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

  it('detects a connectivity failure that emits no llm-analysis-error', function () {
    // An unreachable endpoint produces no llm-analysis-error — only a
    // semantic-analysis-summary reporting batches attempted but 0 operations
    // analyzed. The detector must catch this too, or connection failures exit 0.
    const hasError = (unreachable.diagnostics ?? []).some((d) => d.code === 'llm-analysis-error');
    expect(hasError).to.equal(false);
    const warning = detectLlmFailure(unreachable);
    expect(warning).to.not.equal(null);
    expect(warning!.cause).to.equal(undefined);
  });
});

describe('formatLlmFailureError', function () {
  it('renders an error naming each affected signal and the no-print rationale', function () {
    const failure = detectLlmFailure(failed)!;
    const text = formatLlmFailureError(failure);
    expect(text).to.match(/^error: LLM analysis failed/);
    expect(text).to.include('no usable result');
    expect(text).to.include('Descriptive Richness (AI Discoverability)');
    expect(text).to.include('scorecard was not printed');
    expect(text).to.include('re-run without --with-llm');
    expect(text).to.include('Cause:');
    expect(text.endsWith('\n')).to.equal(true);
  });

  it('renders without an affected list when none could be enumerated', function () {
    const text = formatLlmFailureError({ affectedSignals: [] });
    expect(text).to.match(/^error: LLM analysis failed/);
    expect(text).to.not.include('Affected:');
  });
});
