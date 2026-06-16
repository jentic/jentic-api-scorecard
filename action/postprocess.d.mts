// Hand-written declarations for the pure exports the unit tests import. The
// helper itself is plain ESM (.mjs) so the action can run it with no build step;
// these types exist only so the TypeScript test suite can call the pure logic.

export type SarifLevel = 'error' | 'warning' | 'note';

export interface SarifPhysicalLocation {
  artifactLocation: { uri: string };
  region: { startLine: number };
}

export interface SarifLocation {
  physicalLocation?: SarifPhysicalLocation;
  logicalLocations?: { fullyQualifiedName: string }[];
}

export interface SarifResult {
  level: string;
  locations?: SarifLocation[];
}

export interface SarifRun {
  results: SarifResult[];
}

export interface SarifDoc {
  runs: SarifRun[];
}

export interface GateInputs {
  minScore: number | null;
  maxErrors: number | null;
  maxWarnings: number | null;
}

export interface GateVerdict {
  passed: boolean;
  reasons: string[];
  errorCount: number;
  warningCount: number;
  score: number | undefined;
}

export function parseLevel(value: unknown, fallback?: SarifLevel): SarifLevel;

export function parseOptionalNumber(value: unknown): number | null;

export function computeGate(result: unknown, inputs: GateInputs): GateVerdict;

export function filterSarifBySeverity(doc: SarifDoc, minLevel: string): SarifDoc;

export function sarifArtifactUri(input: unknown): string;

export function addPhysicalLocations(doc: SarifDoc, artifactUri: string): SarifDoc;

export function capFindings(
  doc: SarifDoc,
  maxFindings: number | null,
): { doc: SarifDoc; dropped: number };
