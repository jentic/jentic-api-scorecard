import { expect } from 'chai';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import App from '../src/app/App.tsx';

// App reads window.__SCORECARD__ (set by format()'s injection). In this test env
// import.meta.env.DEV is falsy, so the dev-fixture fallback is inactive and we see
// the production read path directly.
function renderWith(payload: unknown): string {
  (globalThis as { window?: unknown }).window = globalThis;
  (globalThis as unknown as { __SCORECARD__: unknown }).__SCORECARD__ = payload;
  return renderToStaticMarkup(createElement(App));
}

const EMPTY_STATE = 'No scorecard data';

describe('App graceful degradation', function () {
  // format() accepts engine-verbatim JSON, so a malformed payload must degrade to the
  // empty state rather than crash the SPA to a blank screen.
  const malformed: [string, unknown][] = [
    ['null', null],
    ['empty object', {}],
    ['summary without apiMetadata', { summary: {} }],
    // Containers present but their load-bearing scalars are missing: must NOT be
    // treated as renderable (SummaryCard would crash on apiMetadata.name.charAt).
    ['empty summary + apiMetadata objects', { summary: {}, apiMetadata: {} }],
    [
      'apiMetadata without a name',
      { summary: { score: 1, level: 'x', grade: 'A' }, apiMetadata: {} },
    ],
    ['summary missing scalars', { summary: {}, apiMetadata: { name: 'n' } }],
    ['a number', 42],
  ];

  for (const [label, payload] of malformed) {
    it(`renders the empty state for ${label}`, function () {
      expect(renderWith(payload)).to.contain(EMPTY_STATE);
    });
  }

  it('renders the scorecard for a minimally-valid payload', function () {
    const valid = {
      details: [],
      summary: { score: 1, level: 'ai-aware', grade: 'A', dimensions: [] },
      apiMetadata: {
        name: 'n',
        operationCount: 0,
        schemaCount: 0,
        tagCount: 0,
        securitySchemeCount: 0,
      },
    };
    expect(renderWith(valid)).to.not.contain(EMPTY_STATE);
  });

  it('tolerates a non-array details field (renders, does not crash)', function () {
    const junkDetails = {
      details: 'unexpected',
      summary: { score: 1, level: 'ai-aware', grade: 'A' },
      apiMetadata: {
        name: 'n',
        operationCount: 0,
        schemaCount: 0,
        tagCount: 0,
        securitySchemeCount: 0,
      },
    };
    expect(renderWith(junkDetails)).to.not.contain(EMPTY_STATE);
    expect(renderWith(junkDetails)).to.contain('n');
  });

  // The CLI's --detail filter produces progressively richer payloads: summary and
  // dimensions levels omit `details`; signals/diagnostics include it. The formatter
  // must render at EVERY level, not just the richest — regression guard for the
  // "No scorecard data" bug where requiring details[] broke the default level.
  it('renders at every --detail shape (with and without details/diagnostics)', function () {
    const base = {
      summary: {
        score: 66,
        level: 'ai-aware',
        grade: 'B',
        dimensions: [{ kind: 'FC', name: 'Foundational', score: 70, grade: 'A-' }],
      },
      apiMetadata: {
        name: 'Sample',
        operationCount: 1,
        schemaCount: 2,
        tagCount: 0,
        securitySchemeCount: 0,
      },
    };
    const shapes: Record<string, object> = {
      summary: { ...base, summary: { ...base.summary, dimensions: undefined } },
      dimensions: { ...base },
      signals: {
        ...base,
        details: [{ kind: 'FDX', name: 'F', score: 70, grade: 'A-', dimensions: [] }],
      },
      diagnostics: {
        ...base,
        details: [{ kind: 'FDX', name: 'F', score: 70, grade: 'A-', dimensions: [] }],
        diagnostics: [{ source: 's', severity: 1, message: 'm', code: 'C' }],
      },
    };
    for (const [level, payload] of Object.entries(shapes)) {
      expect(renderWith(payload), `${level} renders`).to.not.contain(EMPTY_STATE);
      expect(renderWith(payload), `${level} shows headline`).to.contain('Sample');
    }
  });
});
