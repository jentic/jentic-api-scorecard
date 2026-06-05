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
    ['summary only', { summary: {} }],
    ['details not an array', { details: 'x', summary: {}, apiMetadata: {} }],
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
});
