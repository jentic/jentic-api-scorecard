import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export type ScorecardResult = Record<string, unknown>;

const TEMPLATE_URL = new URL('./app/index.html', import.meta.url);

// The built SPA carries a data-island <script> that initializes window.__SCORECARD__.
// `format(result)` rewrites that assignment with the engine result JSON; the SPA reads
// window.__SCORECARD__ on mount. Keep this id in sync with index.html and app/App.tsx.
const DATA_ISLAND_ID = '__SCORECARD_DATA__';
const DATA_ISLAND_PATTERN = new RegExp(
  `(<script id="${DATA_ISLAND_ID}"[^>]*>)([\\s\\S]*?)(</script>)`,
);

// Inside a <script> element the HTML parser ends the element on the literal
// substring `</script>` regardless of JS syntax, and `<!--` / `<script` can also
// shift its state — every such sequence starts with `<`. Spec content (descriptions,
// examples, diagnostic messages) can contain these, so escaping `<` is what prevents
// a breakout. JSON.stringify already handles quotes, backslashes, and control chars;
// `>`/`&` are inert in script-data context, and U+2028/U+2029 are legal in JS string
// literals since ES2019 — so `<` is the only escape this context needs.
function escapeForScript(json: string): string {
  return json.replace(/</g, '\\u003c');
}

/**
 * Inject the result JSON into a template's data island. Pure (no I/O) so the
 * injection + escaping contract is unit-testable without a built template.
 */
export function injectScorecard(template: string, result: ScorecardResult): string {
  const payload = escapeForScript(JSON.stringify(result));
  return template.replace(DATA_ISLAND_PATTERN, `$1window.__SCORECARD__ = ${payload};$3`);
}

let cachedTemplate: string | undefined;

function loadTemplate(): string {
  if (cachedTemplate === undefined) {
    return (cachedTemplate = readFileSync(fileURLToPath(TEMPLATE_URL), 'utf8'));
  }
  return cachedTemplate;
}

/**
 * Render a scorecard result as a single self-contained HTML document: an
 * interactive React SPA with its JS and CSS inlined and the result JSON assigned
 * to `window.__SCORECARD__`. No external assets, works offline.
 */
export function format(result: ScorecardResult): string {
  return injectScorecard(loadTemplate(), result);
}
