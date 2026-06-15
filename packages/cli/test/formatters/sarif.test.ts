import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Ajv, type ValidateFunction } from 'ajv';
import { expect } from 'chai';

import { formatSarif, toJsonPointer } from '../../src/formatters/sarif.ts';
import { Diagnostic, ScorecardResult } from '../../src/result.ts';

const fixturePath = fileURLToPath(new URL('../fixtures/scorecard.sample.json', import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as ScorecardResult;

const schemaPath = fileURLToPath(new URL('../fixtures/sarif-2.1.0.schema.json', import.meta.url));
const sarifSchema = JSON.parse(readFileSync(schemaPath, 'utf8'));

interface SarifLogicalLocation {
  fullyQualifiedName: string;
}
interface SarifResult {
  ruleId?: string;
  level: string;
  message: { text: string };
  locations?: { logicalLocations: SarifLogicalLocation[] }[];
}
interface SarifLog {
  $schema: string;
  version: string;
  runs: { tool: { driver: { name: string } }; results: SarifResult[] }[];
}

function allResults(doc: SarifLog): SarifResult[] {
  return doc.runs.flatMap((run) => run.results);
}

// The fixture lists every diagnostic in order; find the first matching a predicate
// so the per-case location assertions track the real engine shapes.
function findDiagnostic(predicate: (d: Diagnostic) => boolean): Diagnostic {
  const diagnostics = fixture.diagnostics ?? [];
  const match = diagnostics.find(predicate);
  if (match === undefined) {
    throw new Error('fixture is missing an expected diagnostic shape');
  }
  return match;
}

function resultForCode(doc: SarifLog, code: string): SarifResult {
  const match = allResults(doc).find((result) => result.ruleId === code);
  if (match === undefined) {
    throw new Error(`no SARIF result for code ${code}`);
  }
  return match;
}

describe('formatSarif', function () {
  let doc: SarifLog;
  let validate: ValidateFunction;

  before(function () {
    doc = JSON.parse(formatSarif(fixture)) as SarifLog;
    // logger: false silences "unknown format" notices — the SARIF schema declares
    // uri/date-time formats ajv does not know; ignoring them is correct here.
    const ajv = new Ajv({ strict: false, allErrors: true, logger: false });
    validate = ajv.compile(sarifSchema);
  });

  it('emits a document that validates against the SARIF 2.1.0 schema', function () {
    const valid = validate(doc);
    expect(valid, JSON.stringify(validate.errors?.slice(0, 3))).to.equal(true);
  });

  it('declares SARIF version 2.1.0 and the schemastore $schema', function () {
    expect(doc.version).to.equal('2.1.0');
    expect(doc.$schema).to.equal('https://json.schemastore.org/sarif-2.1.0.json');
  });

  it('emits one run per distinct diagnostic source', function () {
    const sources = new Set((fixture.diagnostics ?? []).map((d) => d.source));
    expect(doc.runs).to.have.lengthOf(sources.size);
    const runNames = doc.runs.map((run) => run.tool.driver.name);
    expect(new Set(runNames)).to.deep.equal(sources);
  });

  it('emits one result per diagnostic', function () {
    expect(allResults(doc)).to.have.lengthOf((fixture.diagnostics ?? []).length);
  });

  it('sets ruleId from code, and omits it when the diagnostic has no code', function () {
    const result = {
      summary: { score: 0, level: 'unknown', grade: 'F' },
      diagnostics: [
        { source: 'loader', severity: 2, message: 'with code', code: 'HAS_CODE' },
        { source: 'loader', severity: 2, message: 'no code' },
      ],
    } as unknown as ScorecardResult;
    const [withCode, withoutCode] = allResults(JSON.parse(formatSarif(result)) as SarifLog);
    expect(withCode?.ruleId).to.equal('HAS_CODE');
    expect(withoutCode).to.not.have.property('ruleId');
  });

  describe('severity → level mapping', function () {
    it('maps severity 1 to error', function () {
      const code = findDiagnostic((d) => d.severity === 1).code as string;
      expect(resultForCode(doc, code).level).to.equal('error');
    });

    it('maps severity 2 to warning', function () {
      const code = findDiagnostic((d) => d.severity === 2).code as string;
      expect(resultForCode(doc, code).level).to.equal('warning');
    });

    it('maps severity 3 to note', function () {
      const code = findDiagnostic((d) => d.severity === 3).code as string;
      expect(resultForCode(doc, code).level).to.equal('note');
    });
  });

  describe('locations key off non-empty pointers', function () {
    it('emits one logical location for a non-empty data.path with no data.paths', function () {
      const diagnostic = findDiagnostic(
        (d) =>
          Array.isArray(d.data?.['path']) &&
          (d.data['path'] as unknown[]).length > 0 &&
          !(Array.isArray(d.data?.['paths']) && (d.data['paths'] as unknown[]).length > 0),
      );
      const result = resultForCode(doc, diagnostic.code as string);
      expect(result.locations).to.have.lengthOf(1);
      expect(result.locations?.[0]?.logicalLocations).to.have.lengthOf(1);
    });

    it('emits one location per pointer for a non-empty data.paths', function () {
      const diagnostic = findDiagnostic(
        (d) => Array.isArray(d.data?.['paths']) && (d.data['paths'] as unknown[]).length > 1,
      );
      const pointerCount = (diagnostic.data?.['paths'] as unknown[]).length;
      const result = resultForCode(doc, diagnostic.code as string);
      expect(result.locations).to.have.lengthOf(pointerCount);
    });

    it('takes locations from data.paths when data.path is an empty array', function () {
      const diagnostic = findDiagnostic(
        (d) =>
          Array.isArray(d.data?.['path']) &&
          (d.data['path'] as unknown[]).length === 0 &&
          Array.isArray(d.data?.['paths']) &&
          (d.data['paths'] as unknown[]).length > 0,
      );
      const pointerCount = (diagnostic.data?.['paths'] as unknown[]).length;
      const result = resultForCode(doc, diagnostic.code as string);
      expect(result.locations).to.have.lengthOf(pointerCount);
    });

    it('omits the locations key when both pointer arrays are empty or absent', function () {
      const diagnostic = findDiagnostic(
        (d) =>
          !(Array.isArray(d.data?.['path']) && (d.data['path'] as unknown[]).length > 0) &&
          !(Array.isArray(d.data?.['paths']) && (d.data['paths'] as unknown[]).length > 0),
      );
      const result = resultForCode(doc, diagnostic.code as string);
      expect(result.locations).to.equal(undefined);
    });
  });

  it('drops malformed pointer entries within data.paths without throwing', function () {
    const result = {
      summary: { score: 0, level: 'unknown', grade: 'F' },
      diagnostics: [
        {
          source: 'speclynx-validator',
          severity: 3,
          message: 'mixed pointers',
          code: 'MIXED',
          // A non-array entry and an empty-array entry must be skipped; the one
          // valid pointer survives.
          data: { paths: ['not-an-array', [], ['paths', 'get']] },
        },
      ],
    } as unknown as ScorecardResult;
    const built = JSON.parse(formatSarif(result)) as SarifLog;
    const sarifResult = built.runs[0]?.results[0];
    expect(sarifResult?.locations).to.have.lengthOf(1);
    expect(sarifResult?.locations?.[0]?.logicalLocations[0]?.fullyQualifiedName).to.equal(
      '/paths/get',
    );
  });

  it('omits locations when every data.paths entry is malformed', function () {
    const result = {
      summary: { score: 0, level: 'unknown', grade: 'F' },
      diagnostics: [
        {
          source: 'speclynx-validator',
          severity: 3,
          message: 'all bad pointers',
          code: 'ALLBAD',
          data: { paths: ['not-an-array', []] },
        },
      ],
    } as unknown as ScorecardResult;
    const built = JSON.parse(formatSarif(result)) as SarifLog;
    expect(built.runs[0]?.results[0]?.locations).to.equal(undefined);
  });

  it('produces a schema-valid document when diagnostics is absent', function () {
    const minimal = {
      summary: { score: 0, level: 'unknown', grade: 'F' },
    } as ScorecardResult;
    const minimalDoc = JSON.parse(formatSarif(minimal)) as SarifLog;
    expect(minimalDoc.runs).to.deep.equal([]);
    const ajv = new Ajv({ strict: false, logger: false });
    expect(ajv.compile(sarifSchema)(minimalDoc)).to.equal(true);
  });
});

describe('toJsonPointer', function () {
  it('encodes segments as an RFC 6901 JSON Pointer with a leading slash', function () {
    expect(toJsonPointer(['paths', 'get'])).to.equal('/paths/get');
  });

  it('escapes a slash within a segment to ~1', function () {
    expect(toJsonPointer(['paths', '/health', 'get'])).to.equal('/paths/~1health/get');
  });

  it('escapes a tilde within a segment to ~0', function () {
    expect(toJsonPointer(['a~b'])).to.equal('/a~0b');
  });

  it('escapes tilde before slash so ~1 is unambiguous', function () {
    expect(toJsonPointer(['~/'])).to.equal('/~0~1');
  });
});
