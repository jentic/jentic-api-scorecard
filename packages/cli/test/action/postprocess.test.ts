import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';

import {
  addPhysicalLocations,
  capFindings,
  computeGate,
  filterSarifBySeverity,
  parseLevel,
  parseOptionalNumber,
  sarifArtifactUri,
} from '../../../../action/postprocess.mjs';
import { ScorecardResult } from '../../src/result.ts';

const fixturePath = fileURLToPath(new URL('../fixtures/scorecard.sample.json', import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as ScorecardResult;

// A minimal SARIF doc with a known level mix for the filter / cap tests, so the
// assertions don't depend on the engine's exact diagnostic counts.
function sarifWith(levels: string[]): { runs: { results: { level: string }[] }[] } {
  return { runs: [{ results: levels.map((level) => ({ level })) }] };
}

describe('postprocess helper', function () {
  describe('parseOptionalNumber', function () {
    it('returns null for unset / empty so the gate is skipped', function () {
      expect(parseOptionalNumber(undefined)).to.equal(null);
      expect(parseOptionalNumber('')).to.equal(null);
      expect(parseOptionalNumber('   ')).to.equal(null);
    });

    it('returns null for a non-numeric value rather than NaN', function () {
      expect(parseOptionalNumber('abc')).to.equal(null);
    });

    it('parses a numeric string, including 0', function () {
      expect(parseOptionalNumber('0')).to.equal(0);
      expect(parseOptionalNumber('70')).to.equal(70);
    });
  });

  describe('parseLevel', function () {
    it('accepts error / warning / note case-insensitively', function () {
      expect(parseLevel('ERROR')).to.equal('error');
      expect(parseLevel('Warning')).to.equal('warning');
      expect(parseLevel('note')).to.equal('note');
    });

    it('falls back to warning for an unknown level', function () {
      expect(parseLevel('bogus')).to.equal('warning');
      expect(parseLevel(undefined)).to.equal('warning');
    });
  });

  describe('computeGate', function () {
    // The fixture scores 66.52 with 2 severity-1 and 8 severity-2 diagnostics.
    it('passes when no gate inputs are set', function () {
      const gate = computeGate(fixture, { minScore: null, maxErrors: null, maxWarnings: null });
      expect(gate.passed).to.equal(true);
      expect(gate.reasons).to.deep.equal([]);
    });

    it('fails when score is strictly below min-score', function () {
      const gate = computeGate(fixture, { minScore: 67, maxErrors: null, maxWarnings: null });
      expect(gate.passed).to.equal(false);
      expect(gate.reasons.join(' ')).to.include('below min-score 67');
    });

    it('passes when score equals min-score (guards against <=)', function () {
      const exact = { summary: { score: 70, level: 'x', grade: 'C' }, diagnostics: [] };
      const gate = computeGate(exact as unknown as ScorecardResult, {
        minScore: 70,
        maxErrors: null,
        maxWarnings: null,
      });
      expect(gate.passed).to.equal(true);
    });

    it('passes when score is above min-score', function () {
      const gate = computeGate(fixture, { minScore: 50, maxErrors: null, maxWarnings: null });
      expect(gate.passed).to.equal(true);
    });

    it('counts errors and warnings against the full diagnostics', function () {
      const gate = computeGate(fixture, { minScore: null, maxErrors: null, maxWarnings: null });
      expect(gate.errorCount).to.equal(2);
      expect(gate.warningCount).to.equal(8);
    });

    it('treats max-errors: 0 as a real gate — the engine fixture carries severity-1 diagnostics', function () {
      // Guards against max-errors: 0 silently being a no-op: a real engine capture
      // includes severity-1 (error) diagnostics, so a zero tolerance must trip.
      const counted = computeGate(fixture, { minScore: null, maxErrors: null, maxWarnings: null });
      expect(counted.errorCount).to.be.greaterThan(0);
      const verdict = computeGate(fixture, { minScore: null, maxErrors: 0, maxWarnings: null });
      expect(verdict.passed).to.equal(false);
    });

    it('fails when error-severity count exceeds max-errors', function () {
      const gate = computeGate(fixture, { minScore: null, maxErrors: 0, maxWarnings: null });
      expect(gate.passed).to.equal(false);
      expect(gate.reasons.join(' ')).to.include('max-errors 0');
    });

    it('fails when warning-severity count exceeds max-warnings', function () {
      const gate = computeGate(fixture, { minScore: null, maxErrors: null, maxWarnings: 5 });
      expect(gate.passed).to.equal(false);
      expect(gate.reasons.join(' ')).to.include('max-warnings 5');
    });

    it('passes when counts are within limits', function () {
      const gate = computeGate(fixture, { minScore: null, maxErrors: 2, maxWarnings: 8 });
      expect(gate.passed).to.equal(true);
    });
  });

  describe('filterSarifBySeverity', function () {
    it('keeps warning and error when minimum is warning', function () {
      const filtered = filterSarifBySeverity(
        sarifWith(['error', 'warning', 'note', 'note']),
        'warning',
      );
      const levels = filtered.runs[0]!.results.map((r) => r.level);
      expect(levels).to.deep.equal(['error', 'warning']);
    });

    it('keeps only error when minimum is error', function () {
      const filtered = filterSarifBySeverity(sarifWith(['error', 'warning', 'note']), 'error');
      const levels = filtered.runs[0]!.results.map((r) => r.level);
      expect(levels).to.deep.equal(['error']);
    });

    it('keeps everything when minimum is note', function () {
      const filtered = filterSarifBySeverity(sarifWith(['error', 'warning', 'note']), 'note');
      expect(filtered.runs[0]!.results).to.have.lengthOf(3);
    });

    it('preserves the run structure even when a run is emptied', function () {
      const filtered = filterSarifBySeverity(sarifWith(['note', 'note']), 'error');
      expect(filtered.runs).to.have.lengthOf(1);
      expect(filtered.runs[0]!.results).to.deep.equal([]);
    });
  });

  describe('capFindings', function () {
    it('returns the doc unchanged and dropped=0 when under the cap', function () {
      const doc = sarifWith(['error', 'warning']);
      const { dropped } = capFindings(doc, 5);
      expect(dropped).to.equal(0);
    });

    it('drops lowest-severity-first down to the cap', function () {
      const doc = sarifWith(['error', 'error', 'warning', 'warning', 'note', 'note', 'note']);
      const { doc: capped, dropped } = capFindings(doc, 4);
      expect(dropped).to.equal(3);
      const levels = capped.runs[0]!.results.map((r) => r.level);
      // All 3 notes drop first; the 2 errors and 2 warnings survive.
      expect(levels.filter((l) => l === 'note')).to.have.lengthOf(0);
      expect(levels.filter((l) => l === 'error')).to.have.lengthOf(2);
      expect(levels.filter((l) => l === 'warning')).to.have.lengthOf(2);
    });

    it('drops into the next level up when notes alone are not enough', function () {
      const doc = sarifWith(['error', 'warning', 'warning', 'note']);
      const { doc: capped, dropped } = capFindings(doc, 2);
      expect(dropped).to.equal(2);
      const levels = capped.runs[0]!.results.map((r) => r.level);
      // The 1 note drops, then 1 warning, leaving error + 1 warning.
      expect(levels).to.include('error');
      expect(levels.filter((l) => l === 'note')).to.have.lengthOf(0);
      expect(levels.filter((l) => l === 'warning')).to.have.lengthOf(1);
    });

    it('treats a null cap as no cap', function () {
      const doc = sarifWith(['note', 'note', 'note']);
      const { dropped } = capFindings(doc, null);
      expect(dropped).to.equal(0);
    });
  });

  describe('sarifArtifactUri', function () {
    it('uses a local path as-is, stripping a leading ./', function () {
      expect(sarifArtifactUri('api/openapi.yaml')).to.equal('api/openapi.yaml');
      expect(sarifArtifactUri('./openapi.yaml')).to.equal('openapi.yaml');
    });

    it('collapses a URL to its basename', function () {
      expect(sarifArtifactUri('https://example.com/specs/openapi.json')).to.equal('openapi.json');
      expect(sarifArtifactUri('https://example.com/specs/openapi.json?ref=main')).to.equal(
        'openapi.json',
      );
    });

    it('falls back to "openapi" for an empty input or path-less URL', function () {
      expect(sarifArtifactUri('')).to.equal('openapi');
      expect(sarifArtifactUri(undefined)).to.equal('openapi');
      expect(sarifArtifactUri('https://example.com/')).to.equal('openapi');
    });
  });

  describe('addPhysicalLocations', function () {
    // Code Scanning rejects logical-only results ("expected a physical location").
    it('attaches a physicalLocation to a result that had none', function () {
      const doc = { runs: [{ results: [{ level: 'warning' }] }] };
      const out = addPhysicalLocations(doc, 'openapi.yaml');
      const loc = out.runs[0]!.results[0]!.locations![0]!;
      expect(loc.physicalLocation!.artifactLocation.uri).to.equal('openapi.yaml');
      expect(loc.physicalLocation!.region.startLine).to.equal(1);
    });

    it('preserves existing logicalLocations alongside the physicalLocation', function () {
      const doc = {
        runs: [
          {
            results: [
              {
                level: 'error',
                locations: [{ logicalLocations: [{ fullyQualifiedName: '/paths' }] }],
              },
            ],
          },
        ],
      };
      const out = addPhysicalLocations(doc, 'openapi.yaml');
      const loc = out.runs[0]!.results[0]!.locations![0]!;
      expect(loc.logicalLocations![0]!.fullyQualifiedName).to.equal('/paths');
      expect(loc.physicalLocation!.artifactLocation.uri).to.equal('openapi.yaml');
    });

    it('gives every result a physical location', function () {
      const doc = sarifWith(['error', 'warning', 'note']);
      const out = addPhysicalLocations(doc, 'openapi.yaml');
      for (const result of out.runs[0]!.results) {
        expect(result.locations![0]!.physicalLocation!.artifactLocation.uri).to.equal(
          'openapi.yaml',
        );
      }
    });
  });
});
