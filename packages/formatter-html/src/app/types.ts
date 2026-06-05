// Data model for the engine scorecard JSON, typed against what the components read.
// The engine may emit additional keys; these interfaces capture only the consumed shape.

export interface EngineMetadata {
  version?: string;
  releaseDate?: string | null;
  engine?: {
    name?: string;
    version?: string;
  };
  disclaimer?: string;
}

export interface ApiMetadata {
  name: string;
  operationCount: number;
  schemaCount: number;
  tagCount: number;
  securitySchemeCount: number;
  securitySchemeTypes?: string[];
}

export interface SummaryDimension {
  kind: string;
  name: string;
  intention?: string;
  score: number;
  grade: string;
}

export interface Summary {
  score: number;
  level: string;
  grade: string;
  dimensions: SummaryDimension[];
}

// Provenance drives which diagnostics a signal's expandable panel surfaces.
export interface Provenance {
  diagnostics?: {
    severity?: number[];
    code?: string[];
    source?: string[];
  };
}

export interface Signal {
  kind: string;
  name: string;
  description: string;
  score: number;
  metadata?: Record<string, unknown> & { provenance?: Provenance };
}

export interface Dimension {
  kind: string;
  name: string;
  intention?: string;
  score: number;
  grade: string;
  signals?: Signal[];
}

export interface DetailGroup {
  kind: string;
  name: string;
  description?: string;
  score: number;
  grade: string;
  dimensions: Dimension[];
}

export interface DiagnosticData {
  fixable?: boolean;
  target?: string;
  path?: unknown[];
  paths?: unknown[][];
}

export interface Diagnostic {
  code: string;
  message: string;
  severity: number;
  source: string;
  data?: DiagnosticData;
}

export interface ScorecardData {
  metadata?: EngineMetadata;
  apiMetadata: ApiMetadata;
  summary: Summary;
  details: DetailGroup[];
  diagnostics?: Diagnostic[];
}
