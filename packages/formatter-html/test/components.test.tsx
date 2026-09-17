import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ApiMetadata, DetailGroup, Diagnostic, Dimension, Summary } from '../src/app/types.ts';
import {
  ApiMetadataCard,
  CircularProgress,
  DimensionCard,
  DiagnosticsSection,
  GradeBadge,
  SummaryCard,
} from '../src/app/react.ts';

const fixturePath = fileURLToPath(new URL('../src/app/scorecard.fixture.json', import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

const apiMetadata = fixture.apiMetadata as ApiMetadata;
const summary = fixture.summary as Summary;
const detailGroup = fixture.details[0] as DetailGroup;
const dimension = detailGroup.dimensions[0] as Dimension;
const diagnostics = fixture.diagnostics as Diagnostic[];

describe('component SSR smoke tests', function () {
  it('SummaryCard renders API name and score', function () {
    const html = renderToStaticMarkup(createElement(SummaryCard, { apiMetadata, summary }));
    expect(html).to.include('Swagger Petstore');
    expect(html).to.include('69'); // Math.round(68.62)
  });

  it('SummaryCard hides stats bar when showApiMetadata=false', function () {
    const html = renderToStaticMarkup(
      createElement(SummaryCard, { apiMetadata, summary, showApiMetadata: false }),
    );
    expect(html).to.not.include('OPERATIONS');
  });

  it('SummaryCard shows stats bar by default', function () {
    const html = renderToStaticMarkup(createElement(SummaryCard, { apiMetadata, summary }));
    expect(html).to.include('OPERATIONS');
  });

  it('DimensionCard renders dimension name and grade', function () {
    const html = renderToStaticMarkup(createElement(DimensionCard, { dimension }));
    expect(html).to.include(dimension.name);
    expect(html).to.include(dimension.grade);
  });

  it('DiagnosticsSection renders diagnostics count', function () {
    const html = renderToStaticMarkup(createElement(DiagnosticsSection, { diagnostics }));
    expect(html).to.include('136 total');
  });

  it('DiagnosticsSection renders empty state when no diagnostics', function () {
    const html = renderToStaticMarkup(createElement(DiagnosticsSection, {}));
    expect(html).to.include('No diagnostics found');
  });

  it('CircularProgress renders score label', function () {
    const html = renderToStaticMarkup(createElement(CircularProgress, { score: 75 }));
    expect(html).to.include('75');
  });

  it('GradeBadge renders grade text', function () {
    const html = renderToStaticMarkup(createElement(GradeBadge, { grade: 'A+' }));
    expect(html).to.include('A+');
  });

  it('ApiMetadataCard renders operation count', function () {
    const html = renderToStaticMarkup(createElement(ApiMetadataCard, { apiMetadata }));
    expect(html).to.include('OPERATIONS');
    expect(html).to.include('19');
  });
});

describe('dark mode CSS variable coverage', function () {
  it('SummaryCard references --sc-bg', function () {
    const html = renderToStaticMarkup(createElement(SummaryCard, { apiMetadata, summary }));
    expect(html).to.include('var(--sc-bg');
  });

  it('DimensionCard references --sc-bg', function () {
    const html = renderToStaticMarkup(createElement(DimensionCard, { dimension }));
    expect(html).to.include('var(--sc-bg');
  });

  it('DiagnosticsSection references --sc-border', function () {
    const html = renderToStaticMarkup(createElement(DiagnosticsSection, { diagnostics }));
    expect(html).to.include('var(--sc-border');
  });

  it('CircularProgress references --cp-track', function () {
    const html = renderToStaticMarkup(createElement(CircularProgress, { score: 75 }));
    expect(html).to.include('var(--cp-track');
  });

  it('GradeBadge includes dark mode grade class', function () {
    const html = renderToStaticMarkup(createElement(GradeBadge, { grade: 'A+' }));
    expect(html).to.include('dark:bg-green-900/30');
  });

  it('ApiMetadataCard references --sc-section', function () {
    const html = renderToStaticMarkup(createElement(ApiMetadataCard, { apiMetadata }));
    expect(html).to.include('var(--sc-section');
  });
});
