# Jentic API Scorecard CLI

`@jentic/api-scorecard-cli` is the public, zero-install CLI that scores an OpenAPI document against the Jentic API AI-Readiness Framework (JAIRF). It registers as the `jentic-api-scorecard` binary and provides a single command: `score`.

The CLI runs the scoring engine locally in a Docker container that it manages for you — the spec never leaves the machine, with one exception: `--with-llm` sends targeted spec context (not the full spec) to an LLM provider you configure. This is the public counterpart of the internal score CLI; the improve skill uses it for all scoring and semantic analysis.

## Prerequisites

- **Node.js ≥ 20.19** with `npm`/`npx`.
- **Docker installed and running.** The CLI spawns Docker itself and pulls the engine image from `ghcr.io` on first run (a one-time latency cost). There is no non-Docker mode.
- **`JENTIC_API_KEY`** exported in the environment (see Authentication). Required for any local-file input, which is what the improve workflow always scores.
- **Network access** to pull the engine image and reach the metered backend.
- **LLM provider credentials and routing** when using `--with-llm` (see LLM Configuration).

## Authentication and quota

Get a key from the Jentic Scorecard API Keys page (`https://app.jentic.com/scorecard?tab=api-keys`) and set it as an environment variable — **never on the command line**:

```bash
export JENTIC_API_KEY=<your-key>
```

| Input | Key required? |
|---|---|
| A raw URL from the Jentic Public APIs collection (OAK) | No — free and uncapped |
| Any other `https://` URL | Yes |
| A local file | Yes |
| Any input with `--bundle` | Yes |

The improve workflow scores a **local working copy**, so a valid `JENTIC_API_KEY` is effectively mandatory.

Free keys allow **100 scorings per calendar month**. Each `score` invocation consumes **one** quota unit **regardless of `--with-llm`** — the `--with-llm` flag adds latency and LLM-provider cost but does **not** consume extra scorecard quota. The improve loop runs one baseline plus up to two in-loop re-scores, so budget at least three units per run (more if the user continues for additional rounds).

## Installation and invocation

The recommended form is zero-install via `npx`:

```bash
# Zero-install (recommended). Use -y in automated/unattended runs to skip the
# first-run install prompt:
npx -y @jentic/api-scorecard-cli@latest score <input> [options]

# Or install globally, then call the binary directly:
npm install -g @jentic/api-scorecard-cli
jentic-api-scorecard score <input> [options]

# Pin a version for reproducibility (CI) — replace <version> with a real release:
npx -y @jentic/api-scorecard-cli@<version> score <input> [options]
```

`<input>` is either an `https://` URL or a local file path to an OpenAPI document.

## The `score` command

There is exactly one command, `score`, and six options (plus the built-in `-h/--help` and `-V/--version`). Do not invent flags for multi-file output directories, config files, watch mode, batch/glob input, custom rulesets, or thresholds — none exist. When unsure, run `npx @jentic/api-scorecard-cli score --help` and trust its output.

```
jentic-api-scorecard score <input> [options]
```

| Flag | Default | Choices | What it does |
|---|---|---|---|
| `--with-llm` | off | — | Enable LLM-backed semantic signals (produces `POOR_OPERATION_SEMANTICS` diagnostics). Requires an LLM provider — see below. |
| `--bundle` | off | — | Fetch and Redocly-bundle a URL on the host, then pipe to the engine. For URLs only the host can reach. Requires `JENTIC_API_KEY`. No-op for local files. |
| `-d, --detail <level>` | `dimensions` | `summary`, `dimensions`, `signals`, `diagnostics` | Payload depth (cumulative — see below). |
| `-f, --format <fmt>` | `pretty` | `pretty`, `json`, `html`, `markdown`, `sarif` | Output encoding. |
| `-o, --output <file>` | stdout | — | Write the formatted report to a file. |
| `-q, --quiet` | off | — | Suppress the stderr progress spinner. |

The improve skill always uses **`--with-llm --format json --detail diagnostics -o <file> -q`**. The detail levels are cumulative: `summary` is the headline score and grade; `dimensions` (default) adds the per-dimension breakdown; `signals` adds the per-signal breakdown; `diagnostics` adds the full evidence/findings bundle. Because `diagnostics` is a strict superset that still includes `summary.dimensions[]`, a single `score --detail diagnostics --format json` call yields both the per-dimension scores used to choose improvement targets and the diagnostics used to apply them — there is no separate `analyze` command.

## Output JSON shape

With `--format json`, the engine emits verbatim JSON (filtered by `--detail`). At `--detail diagnostics` the top-level keys are `metadata`, `apiMetadata`, `summary`, `details`, and `diagnostics`.

```
summary
  score        number   (0–100)
  level        string   slug — e.g. "not-ready", "foundational", "ai-aware", "ai-ready", "agent-optimized"
  grade        string   letter grade — e.g. "B"
  dimensions[] { kind, name, intention, score, grade }   # 6 entries: FC, DXJ, ARAX, AU, SEC, AID
diagnostics[]  { code, message, severity, source, data }
```

Note two differences from the internal CLI's output:

- `summary.level` is a **slug string** (such as `"ai-aware"`), not a numeric 0–4 level.
- `diagnostics[].severity` is a **number**: `1` = error, `2` = warning, `3` = note. (Filter errors with `select(.severity == 1)`.)

When `score` is run with `--with-llm`, the diagnostics include `POOR_OPERATION_SEMANTICS` entries with ready-to-use suggestions under `data`:

```
data.operation_id            the operation to improve
data.issues_found[]          quality issues (e.g. "vague_description", "missing_input_details")
data.path[]                  path to the operation in the spec
data.description_suggestion  suggested replacement description
data.summary_suggestion      suggested replacement summary (when present)
```

## LLM Configuration

`--with-llm` turns on extra JAIRF signals evaluated by an LLM. When it is off, those signals hold a perfect-score baseline and no provider is contacted. The CLI scans the host environment for credentials plus routing variables and forwards them into the container; if no usable provider is found it exits **before** scoring with a guidance message (see exit code 8). It does not read a config file.

| Provider | Credential | Routing |
|---|---|---|
| `OPENAI` | `OPENAI_API_KEY` | `LLM_PROVIDER=OPENAI`, `LIGHT_LLM_PROVIDER=OPENAI`, `LLM_LIGHT_MODEL` (e.g. `gpt-4o-mini`) |
| `ANTHROPIC` | `ANTHROPIC_API_KEY` | `LLM_PROVIDER=ANTHROPIC`, `LIGHT_LLM_PROVIDER=ANTHROPIC`, `LLM_LIGHT_MODEL` (e.g. `claude-haiku-4-5-20251001`) |
| `GEMINI` | `GEMINI_API_KEY` | `LLM_PROVIDER=GEMINI`, `LIGHT_LLM_PROVIDER=GEMINI`, `LLM_LIGHT_MODEL` |
| `BEDROCK` (default) | AWS credentials (`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`, or `AWS_BEARER_TOKEN_BEDROCK`) | `LLM_LIGHT_MODEL` (e.g. `eu.anthropic.claude-haiku-4-5-20251001-v1:0`); routing vars optional since Bedrock is the default |

The engine uses the **light** model (`LLM_LIGHT_MODEL`) exclusively for scoring. For any non-Bedrock provider, set `LLM_PROVIDER`, `LIGHT_LLM_PROVIDER`, and `LLM_LIGHT_MODEL` together, or the engine falls back to a Bedrock model ID and the run fails. A local OpenAI-compatible endpoint (Ollama, LM Studio, vLLM) works by setting `OPENAI_API_URL` alongside `LLM_PROVIDER=OPENAI` and a non-empty `OPENAI_API_KEY`. See the repo's `docs/llm-signals.md` for the full provider matrix and token-cost notes.

## Exit codes

Check the exit code **before** reading the output file — on a non-zero exit the `-o` file may be absent or partial.

| Code | Meaning | Reaction |
|---|---|---|
| 0 | Scoring completed (regardless of the score value). | Proceed; read the JSON. |
| 1 | Generic error: bad input, container failure, write failure. | Check `<input>` is a real URL or existing file. |
| 2 | Auth: `JENTIC_API_KEY` unrecognized, or a local/stdin input ran without a key. | Stop; set a valid `JENTIC_API_KEY`. |
| 3 | Gate rejected: a non-OAK URL with no key set. | Stop; set a key (or use an OAK URL). |
| 4 | Docker not installed or daemon unreachable. | Stop; start Docker and retry. |
| 5 | Spec fetch, parse, or host-side bundling failure. | The spec itself is broken — report it and stop; do not try to improve an unparseable spec. |
| 6 | Engine invocation failure. | Transient — safe to retry once, then stop. |
| 7 | Rate limited: key valid but over the monthly quota. | Stop; report work not done. Do not retry — wait for reset or upgrade. |
| 8 | LLM analysis failed under `--with-llm`. | Stop and report. Do not silently fall back to a non-LLM score (it would not be comparable to an LLM baseline). Fix provider config and retry. |
