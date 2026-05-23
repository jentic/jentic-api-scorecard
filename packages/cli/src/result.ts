export interface Dimension {
  kind: string;
  name: string;
  score: number;
  grade: string;
}

export interface ScorecardSummary {
  score: number;
  level: string;
  grade: string;
  dimensions?: Dimension[];
}

export interface ApiMetadata {
  name?: string;
  apiDescriptionVersion?: string;
  operationCount?: number;
  schemaCount?: number;
  tagCount?: number;
  securitySchemeCount?: number;
  securitySchemeTypes?: string[];
}

export interface EngineMetadata {
  version?: string;
}

export interface Metadata {
  engine?: EngineMetadata;
}

export interface Signal {
  kind: string;
  name: string;
  score: number;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface DetailDimension {
  kind: string;
  name: string;
  score?: number;
  grade?: string;
  signals?: Signal[];
}

export interface DetailGroup {
  kind: string;
  name: string;
  score?: number;
  grade?: string;
  dimensions?: DetailDimension[];
}

export interface Diagnostic {
  source: string;
  severity: number;
  message: string;
  code?: string;
  data?: Record<string, unknown>;
}

export interface ScorecardResult {
  summary: ScorecardSummary;
  apiMetadata?: ApiMetadata;
  metadata?: Metadata;
  details?: DetailGroup[];
  diagnostics?: Diagnostic[];
}
