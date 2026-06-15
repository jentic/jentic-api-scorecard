---
name: jentic-api-scorecard
description: Use the @jentic/api-scorecard-cli to score an OpenAPI document against the Jentic API AI Readiness Framework (JAIRF). Use this skill whenever the user wants to score, grade, lint, or assess the AI-readiness / agent-readiness / quality of an OpenAPI (Swagger) spec — by local file or URL — or asks how to run the jentic-api-scorecard CLI, wire it into CI, produce a JSON or HTML scorecard, enable LLM-backed analysis, or interpret its score, dimensions, signals, or exit codes.
---

# Scoring OpenAPI documents with @jentic/api-scorecard-cli

`@jentic/api-scorecard-cli` is a zero-install CLI that scores an OpenAPI document
against the Jentic API AI Readiness Framework (JAIRF) and prints a scorecard.
It runs the scoring engine locally in a Docker container that the CLI manages for
you — the spec never leaves the machine (the one exception is `--with-llm`, which
sends spec context to an LLM provider you choose).

**Requirements:** Node.js (≥ 20.19) and a running Docker daemon. The engine image
is pulled automatically on first run.

## The one rule: don't invent flags

This CLI has exactly **one command (`score`) and six options** (`--with-llm`,
`--bundle`, `-d/--detail`, `-f/--format`, `-o/--output`, `-q/--quiet`), plus the
built-in `-h/--help` and `-V/--version` — all listed in full below. It does **not**
have flags for multiple-file output directories, config files, watch mode,
batch/glob input, custom rulesets, or thresholds — do not guess or fabricate any of
these. If you are unsure whether something is supported, run
`npx @jentic/api-scorecard-cli score --help` and trust its output over memory.

## Install / invoke

```bash
# Zero-install (recommended for one-off scoring and CI):
npx @jentic/api-scorecard-cli@latest score <input> [options]

# Or install globally, then call the binary directly:
npm install -g @jentic/api-scorecard-cli
jentic-api-scorecard score <input> [options]

# Pin a version for reproducibility (CI) — replace <version> with a real release:
npx @jentic/api-scorecard-cli@<version> score <input> [options]
```

`<input>` is **either** an `https://` URL **or** a local file path to an OpenAPI
document. Anything that is neither a URL nor an existing file exits with code 1.

## Authentication: when a key is required

Set the key as an environment variable — never on the command line:

```bash
export JENTIC_API_KEY=<your-key>   # from https://app.jentic.com/scorecard?tab=api-keys
```

| Input | Key required? |
|---|---|
| A [Jentic Public APIs (OAK)](https://github.com/jentic/jentic-public-apis) raw URL (`https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/...`) | **No** — free and uncapped. |
| Any other `https://` URL | **Yes** |
| A local file | **Yes** |
| Any input with `--bundle` | **Yes** |

Free keys allow **100 scorings per calendar month**. A missing/invalid key or an
exhausted quota surfaces as a distinct exit code (see Exit codes below).

## Common tasks

```bash
# Score an allowlisted OAK URL — no key needed:
npx @jentic/api-scorecard-cli@latest score \
  https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/swagger-api/petstore/1.0.27/openapi.json

# Score any other URL (key required):
JENTIC_API_KEY=$KEY npx @jentic/api-scorecard-cli@latest score https://petstore3.swagger.io/api/v3/openapi.json

# Score a local file (key required):
JENTIC_API_KEY=$KEY npx @jentic/api-scorecard-cli@latest score ./openapi.yaml

# Machine-readable JSON (engine-verbatim, filtered by --detail):
JENTIC_API_KEY=$KEY npx @jentic/api-scorecard-cli@latest score ./openapi.yaml --format json

# Full evidence bundle as JSON to a file:
JENTIC_API_KEY=$KEY npx @jentic/api-scorecard-cli@latest score ./openapi.yaml \
  --format json --detail diagnostics --output report.json

# Self-contained HTML report (must write to a file or redirect — refuses an interactive terminal):
JENTIC_API_KEY=$KEY npx @jentic/api-scorecard-cli@latest score ./openapi.yaml --format html -o scorecard.html

# Fetch + bundle a host-only URL (internal/VPN/auth-gated) on the host, then score (key required):
JENTIC_API_KEY=$KEY npx @jentic/api-scorecard-cli@latest score https://internal.example.com/openapi.yaml --bundle
```

## The `score` command surface (complete)

```
jentic-api-scorecard score <input> [options]
```

| Flag | Default | Choices | What it does |
|---|---|---|---|
| `--with-llm` | off | — | Enable LLM-backed signals. Requires an LLM provider — see `references/llm-analysis.md`. |
| `--bundle` | off | — | Fetch + Redocly-bundle a URL **on the host**, then pipe to the engine over stdin. For URLs only the host can reach. Requires `JENTIC_API_KEY`. No-op for local files. |
| `-d, --detail <level>` | `dimensions` | `summary`, `dimensions`, `signals`, `diagnostics` | Payload depth (see below). |
| `-f, --format <fmt>` | `pretty` | `pretty`, `json`, `html`, `markdown`, `sarif` | Output encoding. |
| `-o, --output <file>` | stdout | — | Write the formatted report to `<file>`. The progress spinner stays on stderr. |
| `-q, --quiet` | off | — | Suppress the stderr spinner regardless of TTY. |
| `-h, --help` | — | — | Show usage for `score`. |

**Detail levels** (cumulative depth): `summary` = headline score + grade only;
`dimensions` = adds the per-dimension breakdown (**default**); `signals` = adds
the per-signal breakdown; `diagnostics` = adds the full evidence/findings bundle.
In `pretty` format, `diagnostics` renders a severity tally plus the top 5 findings
per severity; use `--format json --detail diagnostics` for the complete bundle.

**Format notes:** `pretty` is human-readable (ANSI color on a TTY, plain text when
piped or written to a file). `json` is engine-verbatim, filtered by `--detail`.
`html` is a single self-contained document — it **refuses to print to an
interactive terminal**, so always pair it with `-o <file>` or redirect stdout.
`markdown` is a GitHub-flavored Markdown projection (headline + dimension table,
plus per-signal and diagnostics tables at higher `--detail`); it is plain text,
safe to a terminal, and made for `$GITHUB_STEP_SUMMARY` and PR comments. `sarif`
projects `diagnostics[]` only as a SARIF 2.1.0 document for GitHub code-scanning
(one run per validator source, logical locations only — no inline PR-diff
annotations); it always emits full diagnostics regardless of `--detail` and warns
on stderr if an explicit non-`diagnostics` `--detail` is combined with it.

## CI integration

In CI, provide the key as a secret and choose a machine-readable format. The process
exit code is the pass/fail signal — `0` means scoring completed (it does **not**
assert any minimum score; the CLI has no threshold flag, so gate on the score
yourself by parsing the JSON). For reproducible CI runs, pin `@<version>` to a fixed
release instead of `@latest` so a new publish can't shift results mid-pipeline.

```yaml
# GitHub Actions example
- name: Score the OpenAPI document
  env:
    JENTIC_API_KEY: ${{ secrets.JENTIC_API_KEY }}
  run: |
    npx @jentic/api-scorecard-cli@latest score ./openapi.yaml \
      --format json --output scorecard.json --quiet
```

For an HTML artifact to upload, swap to `--format html -o scorecard.html`.

## LLM-backed analysis

`--with-llm` enables additional signals that an LLM evaluates. It requires LLM
provider credentials + routing variables in the environment; without them the run
fails fast with guidance. The full provider matrix (cloud providers and a local
Ollama/OpenAI-compatible recipe) and the failure semantics are in
**`references/llm-analysis.md`** — read it before constructing a `--with-llm`
invocation.

## Exit codes

Check these to react correctly to failures — they are a stable contract.

| Code | Meaning | Typical fix |
|---|---|---|
| 0 | Scoring completed (regardless of the score value). | — |
| 1 | Generic error: bad input, unexpected container failure, write failure. | Check `<input>` is a real URL or existing file. |
| 2 | Auth: `JENTIC_API_KEY` unrecognized, or a local/stdin input ran without a key. | Set a valid `JENTIC_API_KEY`. |
| 3 | Gate rejected: a non-OAK URL with no key set. | Set a key, or use an OAK URL. |
| 4 | Docker not installed or daemon unreachable. | Start Docker. |
| 5 | Spec fetch, parse, or host-side bundling failure (local files and `--bundle` URLs). | Verify the spec is reachable and valid OpenAPI. |
| 6 | Engine invocation failure. | Re-run; inspect stderr. |
| 7 | Rate limited: key valid but over the monthly quota. | Wait for reset (see `Retry-After`) or upgrade. |
| 8 | LLM analysis failed under `--with-llm`. | Fix provider credentials, or re-run **without** `--with-llm`. |

## Troubleshooting

- **Exit 4 / "Docker" errors** — the engine runs in Docker; ensure the daemon is
  running. There is no non-Docker mode.
- **Exit 2 on a local file** — local files always need `JENTIC_API_KEY`. Export it.
- **Exit 3 on a URL** — that URL is not on the OAK allowlist; it needs a key.
- **HTML "refuses to print to a terminal"** — add `-o file.html` or redirect stdout.
- **A URL the engine can't reach (internal/VPN/auth-gated)** — add `--bundle` so the
  CLI fetches it host-side (needs a key).
- **Exit 8 with `--with-llm`** — provider credentials are wrong/unreachable; the run
  is suppressed so a falsely-perfect score isn't reported. Re-run without `--with-llm`
  for a valid non-LLM score, or fix the provider per `references/llm-analysis.md`.
- **When in doubt** — run `npx @jentic/api-scorecard-cli score --help`. Don't invent
  flags that aren't in the table above.
