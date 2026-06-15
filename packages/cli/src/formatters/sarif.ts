import { Diagnostic, ScorecardResult } from '../result.ts';

// GitHub code-scanning recognizes this schemastore URI for SARIF 2.1.0.
const SARIF_SCHEMA_URI = 'https://json.schemastore.org/sarif-2.1.0.json';

interface SarifLogicalLocation {
  fullyQualifiedName: string;
}

interface SarifLocation {
  logicalLocations: SarifLogicalLocation[];
}

interface SarifResult {
  ruleId?: string;
  level: string;
  message: { text: string };
  locations?: SarifLocation[];
}

interface SarifRun {
  tool: { driver: { name: string } };
  results: SarifResult[];
}

interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

// The engine declares a 1–4 severity scale; SARIF has three usable levels. Hint (4)
// collapses into note alongside info (3); unknown severities fall back to note.
function severityToLevel(severity: number): string {
  switch (severity) {
    case 1:
      return 'error';
    case 2:
      return 'warning';
    default:
      return 'note';
  }
}

// RFC 6901 JSON Pointer: leading '/', segments joined by '/', with '~'→'~0' and
// '/'→'~1' escaped within each segment so a segment that itself contains a slash
// (e.g. '/health', 'application/json') round-trips unambiguously.
export function toJsonPointer(segments: (string | number)[]): string {
  return segments
    .map((segment) => String(segment).replaceAll('~', '~0').replaceAll('/', '~1'))
    .map((segment) => `/${segment}`)
    .join('');
}

function nonEmptyArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

function locationsFor(diagnostic: Diagnostic): SarifLocation[] | undefined {
  const data = diagnostic.data;
  if (data === undefined) {
    return undefined;
  }
  // Precedence: a non-empty data.paths (array of pointers) wins, then a non-empty
  // data.path (one pointer). Both are often present and either may be [] meaning
  // "no pointer", so we key off non-emptiness, not key presence.
  const paths = data['paths'];
  if (nonEmptyArray(paths)) {
    return paths.map((pointer) => ({
      logicalLocations: [{ fullyQualifiedName: toJsonPointer(pointer as (string | number)[]) }],
    }));
  }
  const path = data['path'];
  if (nonEmptyArray(path)) {
    return [
      { logicalLocations: [{ fullyQualifiedName: toJsonPointer(path as (string | number)[]) }] },
    ];
  }
  return undefined;
}

function toSarifResult(diagnostic: Diagnostic): SarifResult {
  const result: SarifResult = {
    level: severityToLevel(diagnostic.severity),
    message: { text: diagnostic.message },
  };
  if (diagnostic.code !== undefined) {
    result.ruleId = diagnostic.code;
  }
  const locations = locationsFor(diagnostic);
  if (locations !== undefined) {
    result.locations = locations;
  }
  return result;
}

export function formatSarif(result: ScorecardResult): string {
  const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics : [];

  // One run per distinct validator source, preserving the engine's provenance and
  // matching how multi-tool SARIF is conventionally structured. Insertion order of
  // first appearance keeps the output deterministic.
  const runsBySource = new Map<string, SarifResult[]>();
  for (const diagnostic of diagnostics) {
    const source = diagnostic.source;
    let results = runsBySource.get(source);
    if (results === undefined) {
      results = [];
      runsBySource.set(source, results);
    }
    results.push(toSarifResult(diagnostic));
  }

  const runs: SarifRun[] = [...runsBySource].map(([source, results]) => ({
    tool: { driver: { name: source } },
    results,
  }));

  const log: SarifLog = {
    $schema: SARIF_SCHEMA_URI,
    version: '2.1.0',
    runs,
  };

  return JSON.stringify(log, null, 2) + '\n';
}
