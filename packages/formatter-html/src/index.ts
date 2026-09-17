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

// Dark mode script injected before </head>. The script runs synchronously to
// avoid a flash of unstyled content: it applies the .dark class before the
// browser paints the first frame. The toggle button is appended to <body> after
// DOMContentLoaded to avoid blocking the parser.
const DARK_MODE_SCRIPT = `<script>
(function () {
  var STORAGE_KEY = 'jentic-scorecard-dark';
  function store(val) {
    try { localStorage.setItem(STORAGE_KEY, val); } catch (_e) {}
  }
  function readStore() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (_e) { return null; }
  }
  function applyDark(on) {
    if (on) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
  var mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var stored = readStore();
  applyDark(stored !== null ? stored === '1' : (mq ? mq.matches : false));
  if (mq) {
    var onChange = function (e) {
      if (readStore() === null) {
        applyDark(e.matches);
      }
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(onChange);
    }
  }
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.createElement('button');
    btn.id = 'dark-mode-toggle';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.style.cssText =
      'position:fixed;bottom:1rem;right:1rem;z-index:9999;width:2.25rem;height:2.25rem;' +
      'border-radius:9999px;border:1px solid rgba(128,128,128,.3);cursor:pointer;' +
      'display:flex;align-items:center;justify-content:center;font-size:1rem;' +
      'background:rgba(128,128,128,.1);backdrop-filter:blur(4px);';
    function syncIcon() {
      btn.textContent = document.documentElement.classList.contains('dark') ? '\\u2600\\uFE0F' : '\\uD83C\\uDF19';
    }
    syncIcon();
    btn.addEventListener('click', function () {
      var nowDark = document.documentElement.classList.toggle('dark');
      store(nowDark ? '1' : '0');
      syncIcon();
    });
    document.body.appendChild(btn);
  });
})();
</script>`;

/**
 * Inject a synchronous dark-mode bootstrap script before `</head>`. The script
 * reads localStorage for a manual override and falls back to the OS
 * `prefers-color-scheme` media query. It also registers a system-preference
 * change listener and appends a fixed-position sun/moon toggle button to
 * `<body>` on DOMContentLoaded.
 */
function injectDarkMode(html: string): string {
  return html.replace('</head>', `${DARK_MODE_SCRIPT}</head>`);
}

/**
 * Inject the result JSON into a template's data island. Pure (no I/O) so the
 * injection + escaping contract is unit-testable without a built template.
 */
export function injectScorecard(template: string, result: ScorecardResult): string {
  const payload = escapeForScript(JSON.stringify(result));
  // Use a replacement function, not a replacement string: a string would have its
  // `$` sequences ($1, $&, $`, $') interpreted by String.replace, and spec content
  // routinely contains `$` (prices, templates). The function's return value is
  // inserted verbatim, so the payload is immune to that interpretation.
  return injectDarkMode(
    template.replace(
      DATA_ISLAND_PATTERN,
      (_match, open: string, _body: string, close: string) =>
        `${open}window.__SCORECARD__ = ${payload};${close}`,
    ),
  );
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
