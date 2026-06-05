import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';
import type { ComponentType } from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ScorecardData, Signal } from '../src/app/types.ts';
import AuthStrengthMetadata from '../src/app/components/signals/AuthStrengthMetadata.tsx';
import ComplexityComfortMetadata from '../src/app/components/signals/ComplexityComfortMetadata.tsx';
import DescriptionCoverageMetadata from '../src/app/components/signals/DescriptionCoverageMetadata.tsx';
import DescriptiveRichnessMetadata from '../src/app/components/signals/DescriptiveRichnessMetadata.tsx';
import ErrorStandardizationMetadata from '../src/app/components/signals/ErrorStandardizationMetadata.tsx';
import ExampleDensityMetadata from '../src/app/components/signals/ExampleDensityMetadata.tsx';
import ExampleValidityMetadata from '../src/app/components/signals/ExampleValidityMetadata.tsx';
import LintResultsMetadata from '../src/app/components/signals/LintResultsMetadata.tsx';
import OpidQualityMetadata from '../src/app/components/signals/OpidQualityMetadata.tsx';
import ResolutionCompletenessMetadata from '../src/app/components/signals/ResolutionCompletenessMetadata.tsx';
import ResponseCoverageMetadata from '../src/app/components/signals/ResponseCoverageMetadata.tsx';
import SpecValidityMetadata from '../src/app/components/signals/SpecValidityMetadata.tsx';
import StructuralIntegrityMetadata from '../src/app/components/signals/StructuralIntegrityMetadata.tsx';
import SummaryCoverageMetadata from '../src/app/components/signals/SummaryCoverageMetadata.tsx';
import ToolingReadinessMetadata from '../src/app/components/signals/ToolingReadinessMetadata.tsx';

type PanelComponent = ComponentType<{ metadata: never; diagnostics?: never; score?: number }>;

// Every signal kind the engine currently emits maps to exactly one metadata panel.
const PANELS: Record<string, PanelComponent> = {
  spec_validity: SpecValidityMetadata as PanelComponent,
  resolution_completeness: ResolutionCompletenessMetadata as PanelComponent,
  lint_results: LintResultsMetadata as PanelComponent,
  structural_integrity: StructuralIntegrityMetadata as PanelComponent,
  example_density: ExampleDensityMetadata as PanelComponent,
  example_validity: ExampleValidityMetadata as PanelComponent,
  response_coverage: ResponseCoverageMetadata as PanelComponent,
  tooling_readiness: ToolingReadinessMetadata as PanelComponent,
  summary_coverage: SummaryCoverageMetadata as PanelComponent,
  description_coverage: DescriptionCoverageMetadata as PanelComponent,
  error_standardization: ErrorStandardizationMetadata as PanelComponent,
  opid_quality: OpidQualityMetadata as PanelComponent,
  complexity_comfort: ComplexityComfortMetadata as PanelComponent,
  auth_strength: AuthStrengthMetadata as PanelComponent,
  descriptive_richness: DescriptiveRichnessMetadata as PanelComponent,
};

const fixturePath = fileURLToPath(new URL('../src/app/scorecard.fixture.json', import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as ScorecardData;

// First-seen signal (with metadata) per kind, from the real engine capture.
const signalsByKind = new Map<string, Signal>();
for (const detail of fixture.details ?? []) {
  for (const dimension of detail.dimensions) {
    for (const signal of dimension.signals ?? []) {
      if (!signalsByKind.has(signal.kind) && signal.metadata) {
        signalsByKind.set(signal.kind, signal);
      }
    }
  }
}

describe('signal metadata panels', function () {
  it('the fixture exercises every panel kind', function () {
    for (const kind of Object.keys(PANELS)) {
      expect(signalsByKind.has(kind), `fixture has a ${kind} signal`).to.equal(true);
    }
  });

  it('renders a panel component for every signal kind the engine emits', function () {
    for (const kind of signalsByKind.keys()) {
      expect(PANELS[kind], `panel registered for ${kind}`).to.not.equal(undefined);
    }
  });

  for (const [kind, Component] of Object.entries(PANELS)) {
    describe(kind, function () {
      let html = '';

      before(function () {
        const signal = signalsByKind.get(kind);
        if (!signal) this.skip();
        html = renderToStaticMarkup(
          createElement(Component, {
            metadata: signal!.metadata as never,
            diagnostics: undefined as never,
            score: signal!.score,
          }),
        );
      });

      // Catches string-coerced drift: a missing field interpolated into a template
      // literal or `.join()` renders the literal text `undefined`. (A bare `{value}`
      // of undefined renders empty, so this is a partial guard — the per-signal value
      // assertions below are the real field-drift coverage.) The "request response
      // undefined" category label is prose, not a value, so the patterns exclude it.
      it('renders no undefined value', function () {
        expect(html, 'undefined between tags').to.not.match(/>\s*undefined\s*</);
        expect(html, 'undefined after a colon-space').to.not.match(/:\s*undefined\b/);
      });

      it('renders no NaN value', function () {
        expect(html).to.not.contain('NaN');
      });

      it('produces non-empty markup', function () {
        expect(html.length).to.be.greaterThan(0);
      });
    });
  }

  // Positive field-drift coverage: render each drift-prone panel with the real
  // fixture metadata and assert the expected values appear. If a component reads a
  // renamed/missing engine field, its expected value is absent and the test fails —
  // this is what would have caught the complexity_comfort/opid_quality drift bugs.
  describe('renders expected values from the fixture', function () {
    function render(kind: string): string {
      const signal = signalsByKind.get(kind);
      if (!signal) throw new Error(`fixture missing ${kind}`);
      const Component = PANELS[kind]!;
      return renderToStaticMarkup(
        createElement(Component, {
          metadata: signal.metadata as never,
          diagnostics: undefined as never,
          score: signal.score,
        }),
      );
    }

    it('complexity_comfort surfaces schema fields and the baseline range', function () {
      const html = render('complexity_comfort');
      expect(html, 'schema count').to.contain('64');
      expect(html, 'endpoint baseline range 50–200').to.contain('50–200');
      expect(html).to.contain('Schema Count');
      expect(html).to.contain('Schemas Exceeding Threshold');
    });

    it('descriptive_richness surfaces the total descriptive score', function () {
      const html = render('descriptive_richness');
      expect(html).to.contain('Total Descriptive Score');
    });

    it('opid_quality surfaces coverage, uniqueness and the dominant casing', function () {
      const html = render('opid_quality');
      expect(html, 'coverage 19/19').to.contain('19');
      expect(html, 'percentages').to.contain('100%');
      expect(html, 'dominant casing chip').to.contain('camelCase');
    });

    it('response_coverage shows the coverage donut percentage and points', function () {
      const html = render('response_coverage');
      expect(html, 'donut percentage').to.contain('70%');
      expect(html, 'coverage points').to.contain('13.25');
    });

    it('tooling_readiness shows the interpretation and error count', function () {
      const html = render('tooling_readiness');
      expect(html).to.contain('Easily ingested');
      expect(html).to.contain('Ingestion Errors');
    });

    it('auth_strength shows the scheme count and per-scheme strength', function () {
      const html = render('auth_strength');
      expect(html).to.contain('Security Schemes');
      expect(html, 'oauth2 strength 35%').to.contain('35%');
    });

    // CountBasedMetadata coerces missing fields to 0 (renders 0/N, not `undefined`),
    // so the undefined-guard alone can't catch a numerator/denominator field rename.
    // Assert the real numerator + denominator render so a rename fails the test.
    const COUNT_EXPECTATIONS: Record<string, [string, string]> = {
      resolution_completeness: ['43', '43'],
      example_density: ['16', '128'],
      example_validity: ['16', '16'],
      description_coverage: ['117', '198'],
      error_standardization: ['0', '19'],
      summary_coverage: ['19', '32'],
    };

    for (const [kind, [numerator, denominator]] of Object.entries(COUNT_EXPECTATIONS)) {
      it(`${kind} renders its numerator/denominator from the fixture`, function () {
        const html = render(kind);
        expect(html, `numerator ${numerator}`).to.contain(numerator);
        expect(html, `denominator ${denominator}`).to.contain(denominator);
      });
    }
  });
});
