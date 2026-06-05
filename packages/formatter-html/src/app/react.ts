// Public React entry (`@jentic/api-scorecard-formatter-html/react`).
// Consumers render <Scorecard data={result} /> with their own React; the components
// are styled with stock Tailwind utility classes, so a Tailwind pipeline must be
// present (a `<script src="https://cdn.tailwindcss.com"></script>` tag is enough).
// The internal building blocks (SummaryCard, DimensionCard, …) stay unexported until
// there's a concrete consumer — adding them later is non-breaking; removing is not.
export { default as Scorecard } from './components/Scorecard.tsx';

export type {
  ScorecardData,
  ApiMetadata,
  EngineMetadata,
  Summary,
  SummaryDimension,
  DetailGroup,
  Dimension,
  Signal,
  Diagnostic,
  DiagnosticData,
  Provenance,
} from './types.ts';
