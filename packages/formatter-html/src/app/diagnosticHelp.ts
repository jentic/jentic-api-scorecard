export interface DiagnosticHelpEntry {
  description: string;
}

// Short descriptions for known diagnostic codes. Keyed by the `code` string emitted
// in the scorecard JSON. Codes absent from this map render without a tooltip.
// Pending: full authoritative definitions from jentic/api-ai-readiness-framework#42.
export const DIAGNOSTIC_HELP: Readonly<Record<string, DiagnosticHelpEntry>> = {
  // Example coverage — see jentic/api-ai-readiness-framework#42 for full definitions
  present_examples: {
    description:
      'Count of schema elements (properties, parameters, bodies) that carry at least one example value.',
  },
  total_examples: {
    description: 'Total number of individual example values present across the document.',
  },
  expected_examples: {
    description: 'Expected count of examples based on the number of example-bearing elements.',
  },

  // Description / summary coverage
  describable_elements: {
    description: 'Number of operations, schemas, and parameters that accept a description field.',
  },
  described_elements: {
    description: 'Number of elements that have a non-empty description.',
  },
  summaries_expected: {
    description: 'Number of operations expected to carry a summary.',
  },
  summaries_present: {
    description: 'Number of operations that have a non-empty summary.',
  },

  // Operations
  total_operations: {
    description: 'Total number of operations (path × HTTP-method pairs) in the document.',
  },
  operations_with_operationId: {
    description: 'Number of operations that declare an operationId.',
  },
  operation_response_coverage: {
    description: 'Ratio of operations that document at least one response.',
  },
  operations_using_RFC9457: {
    description: 'Fraction of error responses that follow the RFC 9457 Problem Details format.',
  },

  // $ref resolution
  resolved_refs: {
    description: 'Number of $ref references that resolve successfully after bundling.',
  },
  relative_refs: {
    description: 'Number of relative $ref references in the document.',
  },
  absolute_http_refs: {
    description: 'Number of $ref references that use an absolute http/https URL.',
  },
  total_refs: {
    description: 'Total number of $ref references in the document.',
  },

  // Schema metrics
  max_schema_depth: {
    description: 'Maximum nesting depth of schema objects within the document.',
  },
  schema_count: {
    description: 'Total number of schema definitions in the document.',
  },

  // Tags and security
  tag_count: {
    description: 'Total number of tags declared at the document level.',
  },
  security_scheme_count: {
    description: 'Total number of security scheme definitions in components.securitySchemes.',
  },
  security_scheme_types: {
    description: 'Security scheme type names used (e.g. apiKey, oauth2, http).',
  },
  security_schemes: {
    description: 'Whether the document declares at least one security scheme.',
  },

  // Linting rules
  operation_id_casing: {
    description: 'Operation IDs must follow a consistent casing convention (camelCase by default).',
  },
  'operation-4xx-response': {
    description: 'Operations should define at least one 4xx error response.',
  },
  RELATIVE_SERVER_URL: {
    description: 'Server URLs should be absolute; relative URLs may cause resolution issues.',
  },
  'no-unused-components': {
    description:
      'All components (schemas, parameters, etc.) should be referenced by at least one operation.',
  },
  'oas3-unused-component': {
    description: 'An OAS3 component is declared but not referenced anywhere in the document.',
  },
  UNUSED_SECURITY_SCHEME_DEFINED: {
    description:
      'A security scheme is defined in components.securitySchemes but not applied in any security requirement.',
  },
  'no-errors-without-content': {
    description: 'Error responses (4xx/5xx) should include a response body schema.',
  },
  'no-x-response-headers': {
    description: 'Response headers prefixed with X- are discouraged; prefer standard header names.',
  },
  'hosts-https-only-oas3': {
    description: 'All server URLs should use https to enforce secure transport.',
  },
  'params-must-include-examples': {
    description: 'Parameters should include at least one example value.',
  },
  'security-defined': {
    description: 'Operations (or the document globally) should declare security requirements.',
  },
  'api-health': {
    description: 'The API should expose a health or liveness endpoint.',
  },
  'monite-openapi-number-boundaries': {
    description: 'Numeric fields should declare minimum and maximum constraints.',
  },
  'monite-security-no-secrets-in-path-or-query-parameters': {
    description:
      'Sensitive values (passwords, tokens, secrets) must not appear in path or query parameters.',
  },
};
