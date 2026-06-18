# Jentic API Scorecard — Architecture (Delivery 1)

> Status: Draft. Architecture for the initial public release.
> Framework: Jentic API AI Readiness Framework (JAIRF) v0.2.0 — see https://github.com/jentic/api-ai-readiness-framework

## 1. What this is

A zero-install CLI that scores an OpenAPI document against JAIRF and prints a Jentic API Readiness Scorecard. Users run it via `npx`. The scoring engine is a Python implementation of JAIRF, packaged as a public Docker image. The CLI orchestrates the image. Auth is env-var only (`JENTIC_API_KEY`); the container validates real keys live against `api.jentic.com`, which doubles as the per-key usage / rate-limit accounting call (§9).

URLs under [`jentic/jentic-public-apis`](https://github.com/jentic/jentic-public-apis) score for free without a key and bypass the validator entirely.

```
$ JENTIC_API_KEY=<your-key> npx @jentic/api-scorecard-cli score https://petstore3.swagger.io/api/v3/openapi.json
# or with --format json -o report.json for machine output
⏳ Pulling ghcr.io/jentic/jentic-api-scorecard:1.0.0…
⏳ Scoring…
✓ done in 8.2s

Jentic API Readiness Scorecard
Source: https://petstore3.swagger.io/api/v3/openapi.json

  Final score:    68.62 / 100
  Readiness:      ai-aware  (B+)

  Dimensions
    FC    Foundational Compliance                          99.51  A+
    DXJ   Developer Experience & Jentic Compatibility      68.89  B+
    ARAX  AI-Readiness & Agent Experience                  54.62  C
    AU    Agent Usability                                  93.70  A+
    SEC   Security                                         42.50  D-
    AID   AI Discoverability                              100.00  A+

  Run with --detail signals for signal breakdown.
  Full report: --format json --detail diagnostics
```

## 2. Architectural decisions at a glance

| Topic | Decision |
|---|---|
| Repo layout | `packages/` (Lerna monorepo of npm deliverables — CLI today, HTML formatter next) + `docker/` (everything that goes into the public image: Dockerfile, uv-managed Python runner, build-time sample spec). Layout reflects *what we ship*, not *what languages we use*. |
| Distribution | npm package `@jentic/api-scorecard-cli` (CLI) + GHCR image `ghcr.io/jentic/jentic-api-scorecard` |
| JS language | TypeScript across all packages; `tsc` → ESM |
| Lerna versioning | Fixed/locked: every package shares one version |
| Version coupling | CLI npm version = image tag. Engine (`jentic-apitools-pipelines` + `jentic-apitools-common`) versions independently and is pinned exactly inside each image. Pinning one CLI version reproduces the full stack. |
| Image flow | CLI fully abstracts image management. It pulls `ghcr.io/jentic/jentic-api-scorecard:<cli-version>` automatically. No user-facing image flags. |
| Tagging | Exact-version GHCR tags only (e.g. `:1.0.0`). The CLI consumes only exact tags, so no floating `:latest` is published on the docker side. The one floating tag is `:unstable`, which rolls on every green `main` for direct `docker run` users. |
| Docker mode | Shell out to `docker` CLI via `child_process.spawn`. No `dockerode`. |
| Input dispatch | Local path → CLI bundles via Redocly → pipes to container stdin. URL → CLI passes `--url` to container, engine fetches directly. URL + `--bundle` → CLI fetches and bundles host-side, pipes via stdin (escape hatch for internal/auth-gated URLs). |
| Anonymous gate | URL must match `^https://raw\.githubusercontent\.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/`. Enforced container-side. Local files require a key. |
| Auth | `JENTIC_API_KEY` env var only. CLI forwards it to the container as `-e JENTIC_API_KEY`. The container validates real keys live against `POST https://api.jentic.com/api/v1/usage/api-scoring`; jentic-public-apis URLs skip the call entirely (always free). No login subcommand or creds file. |
| Engine | [`jentic-apitools-pipelines`](https://pypi.org/project/jentic-apitools-pipelines/) + [`jentic-apitools-common`](https://pypi.org/project/jentic-apitools-common/) on PyPI, called in-process from the runner. Image bundles Python 3.14 + Node 24 (engine spawns Redocly / Spectral / Speclynx via npx). |
| LLM analysis | Off by default. Opt-in via `--with-llm`; CLI forwards present provider credentials and routing variables (OpenAI / Anthropic / Gemini / AWS cloud, or OpenAI-compatible local endpoints via `OPENAI_API_URL`) to the container, which passes `--enable-llm-analysis` to the engine. See §5 "Bring your own LLM". |
| Usage tracking | The same `POST /api/v1/usage/api-scoring` call that authenticates a real key also increments the user's per-key scoring counter. Allowlisted (jentic-public-apis) URLs do not increment. |
| Default output | Headline + dimensions on stdout; spinner phases on stderr. `--detail` controls payload depth (summary → dimensions → signals → diagnostics). `--format json` for machine-readable output. |
| Out of scope (Delivery 1) | HTML formatter wired in (formatter package scaffolded only); user-facing image flags (image management is fully abstracted by the CLI); subcommands beyond `score` (no `login` / `whoami` / etc.); creds file persistence. |

## 3. Component diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                  user shell                                   │
└──────────────────────────────────────────────┬───────────────────────────────┘
                                               │ npx @jentic/api-scorecard-cli …
                                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  @jentic/api-scorecard-cli  (CLI, TypeScript, npm)                                │
│                                                                               │
│  score   ── input is path? ── yes ── Redocly bundle ────────────────────┐   │
│            input is URL?  ── yes ── (no bundle)                          │   │
│                                                                          │   │
│  auth resolve: JENTIC_API_KEY env  →  forwarded to container             │   │
│                                                                          │   │
│  docker driver: spawn('docker', ['run', '-i', '--rm', …])  ◄────────────┘   │
│                          │                                                    │
│  output:    stderr ── spinner phases (pulling/bundling/scoring/done)         │
│             stdout ── pretty table  OR  JSON (--format json)  OR  -o FILE   │
└──────────────────────────────────────────────┬───────────────────────────────┘
                                               │ docker run -i --rm
                                               │   -e JENTIC_API_KEY
                                               │   ghcr.io/jentic/jentic-api-scorecard:<v>
                                               │   score [--url <url>]
                                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  ghcr.io/jentic/jentic-api-scorecard  (Docker image, Python, uv)              │
│                                                                               │
│  jentic_scorecard_runner                                                      │
│    ├── arg parse:  --url <url>  |  read stdin                                 │
│    ├── gate check:  if no key, URL must match jentic-public-apis allowlist    │
│    ├── prepare:    URL → pass through  |  stdin → write to tempfile           │
│    ├── score:  in-process call into                                           │
│    │           jentic.apitools.pipelines.score_openapi(...)                   │
│    └── stdout: scorecard.json contents                                        │
│                                                                               │
│  stderr: progress / engine warnings                                           │
└──────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ engine fetches URL inputs
                              ▼
              raw.githubusercontent.com  /  any reachable URL
```

## 4. Repository layout

```
jentic-api-scorecard/
├── README.md
├── .claude-plugin/                           (Claude Code plugin marketplace catalog)
│   └── marketplace.json                      (one plugin entry, source: "./", strict: false, explicit skills[])
├── docs/
│   └── architecture.md                       (this file)
├── package.json                              (npm workspaces root: packages/*)
├── lerna.json                                (fixed versioning)
├── tsconfig.base.json                        (shared TS config for all packages)
├── packages/                                 (npm-distributed deliverables)
│   ├── cli/                                  (@jentic/api-scorecard-cli)
│   │   ├── package.json                      (bin: jentic-api-scorecard)
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts                      (entry; subcommand dispatch)
│   │   │   ├── commands/
│   │   │   │   └── score.ts
│   │   │   ├── auth.ts                       (read JENTIC_API_KEY env)
│   │   │   ├── bundle.ts                     (@redocly/openapi-core)
│   │   │   ├── docker.ts                     (spawn('docker', …))
│   │   │   ├── formatters/                   (pretty / json / markdown formatters; --format + --detail)
│   │   │   └── spinner.ts                    (stderr phase spinner)
│   │   └── test/fixtures/sample.yaml         (tiny OpenAPI doc used as an e2e test fixture)
│   └── formatter-html/                       (@jentic/api-scorecard-formatter-html)
│       ├── package.json                      (dual export: "." → format(); "./react" → components)
│       ├── src/index.ts                      (export format(result): string — self-contained HTML)
│       ├── src/app/                          (React SPA: ported scorecard components + react.ts entry)
│       ├── index.html                        (Vite entry; window.__SCORECARD__ data island)
│       └── vite.config.ts                    (singlefile build → dist/app/index.html, CSS inlined)
├── skills/                                   (canonical agent-skill source — shipped in the CLI tarball)
│   └── jentic-api-scorecard/
│       ├── SKILL.md                          (name/description frontmatter + CLI usage guidance)
│       └── references/llm-analysis.md        (progressive-disclosure: --with-llm provider recipes)
├── docker/                                   (image internals; not a deliverable on its own)
│   ├── Dockerfile                            (python:3.14-slim + Node 24, uv install)
│   ├── .dockerignore
│   ├── pyproject.toml                        (uv; deps: jentic-apitools-pipelines + -common)
│   ├── uv.lock
│   └── src/jentic_scorecard_runner/
│       ├── __main__.py                       (image entry inside container)
│       ├── gate.py                           (URL allowlist enforcement)
│       └── score/                            (in-process call into jentic.apitools.pipelines.score_openapi)
└── .github/workflows/
    ├── ci.yml                                (lint + test on PRs; also callable via workflow_call)
    ├── docker-publish.yml                    (build + push :unstable to GHCR on main; gated on ci.yml)
    ├── skill-security.yml                    (SkillSpector static scan, matrixed over every skills/* dir; gates each skill on a SAFE recommendation)
    └── release.yml                           (workflow_dispatch — bump via Conventional Commits, build versioned image, npm publish at @latest)
```

A few layout notes worth calling out:

- `packages/` and `docker/` are siblings at the repo root. Lerna's workspace globs are `packages/*`; the Dockerfile is built with `docker build ./docker`. Neither tree depends on the other at build time — they only compose at runtime when the host CLI invokes the container.
- The Python code under `docker/src/jentic_scorecard_runner/` is *image-internal* — it's never published to PyPI, never imported from anywhere outside the image. Treating it as part of the docker artifact (rather than a peer "Python project") avoids the false impression that Python is a parallel deliverable to JS.
- `tsconfig.base.json` and `lerna.json` live at the repo root because Lerna and TypeScript expect monorepo metadata to be top-level. There's no `javascript/` wrapper because there's no symmetric `python/` to balance against — JS is the only language we publish.
- **`skills/` is the single canonical source for the agent skill**, consumed by three distribution paths that share the same `skills/<name>/SKILL.md` + `name`/`description`-frontmatter convention: [TanStack Intent](https://tanstack.com/intent) (`npx @tanstack/intent install`, which discovers the skill from the installed npm package — recognized via the `tanstack-intent` keyword and `skills/` `files` entry on `packages/cli/package.json`), the [Vercel `skills` CLI](https://github.com/vercel-labs/skills) (`npx skills add jentic/jentic-api-scorecard --skill jentic-api-scorecard`, which reads the skill straight from this repo), and the [Claude Code plugin marketplace](https://docs.claude.com/en/docs/claude-code/plugins) (`/plugin marketplace add jentic/jentic-api-scorecard` then `/plugin install api-scorecard@jentic-api-scorecard`, driven by `.claude-plugin/marketplace.json`). The repo-root `skills/` tree is copied into `packages/cli/` at `prepack` (alongside `LICENSE`/`NOTICE`/`README.md`, via `copyfiles`) and removed at `postpack`, so the published CLI tarball carries a real copy while git keeps exactly one canonical source. Intent needs no devDependency or validation step on our side — the `tanstack-intent` keyword plus the shipped `skills/` tree are all it reads when discovering the skill from a consumer's `node_modules`.
- **The Claude Code plugin marketplace reads the repo directly, not the npm tarball.** `marketplace.json` declares one plugin with `source: "./"` (the plugin root is the repo root), `strict: false`, and an explicit `skills: ["./skills/jentic-api-scorecard"]` array that names exactly what ships — so there is no `plugin.json` (under `strict: false` the marketplace entry is the entire definition; a `plugin.json` declaring components would conflict) and no reliance on auto-discovery. There is no central registry or submission/approval; `/plugin marketplace add` is a pull-based fetch of this public repo. The repo-dev harness under `.claude/` is **not** referenced by the entry and is not a plugin-discoverable directory, so it never leaks to installers. The explicit `skills` array is also the growth path: a second skill is one more array entry (a distinct *plugin*, by contrast, would get its own `marketplace.json` entry, and — if it needs its own component layout — its own subdirectory `source` rather than `./`).
- **`pretty`, `json`, and `markdown` formatters live inside `packages/cli/src/formatters/`** because they're plain TS string-projections of the engine result with no toolchain weight. **`formatter-html` is a separate package** because its implementation is an interactive React SPA (single self-contained HTML, bundle inlined into `<script>` and `<style>` blocks) — pulling React + a bundler into `packages/cli/` would burden every `pretty`/`json` user with weight they never use. The decision rule: a formatter gets its own package iff its build/runtime toolchain materially exceeds the CLI's; otherwise it lives in the CLI.
  - The package exposes **two entry points**. `"."` exports `format(result): string` — the CLI's consumption path, which reads the pre-built single-file SPA and injects the result into `window.__SCORECARD__`; this entry pulls **zero React** into the CLI (React/Vite/Tailwind are devDependencies, bundled into the output string). `"./react"` exports the scorecard React components (`Scorecard`, `SummaryCard`, … plus the `ScorecardData` types) for consumers embedding the scorecard in their own React app; React is a (optional) **peerDependency** there, and styling relies on the consumer's Tailwind pipeline (a `cdn.tailwindcss.com` tag suffices) rather than shipped CSS. So per-toolchain weight remains the load-bearing axis for *why the package is split out*, and the `"./react"` entry adds component re-use across surfaces as a deliberate second consumption mode — without imposing any React/bundler cost on the `format()`/CLI path.

## 5. CLI specification

### Subcommand

The CLI exposes a single subcommand for Delivery 1: `score <input>`. Scoring an OpenAPI doc is the only thing the CLI does; auth comes from the environment, not from a CLI verb.

### `score <input>` flags

| Flag | Default | Behavior |
|---|---|---|
| `--format <fmt>` / `-f` | `pretty` | Output encoding. Default: `pretty` (unconditional). Values: `pretty`, `json`. `markdown` and `html` are reserved for later phases. |
| `--detail <level>` / `-d` | `dimensions` | Controls payload depth — how much of the scoring result is included in output. Values form a graduated hierarchy: `summary` (score + grade + level only), `dimensions` (+ dimension table), `signals` (+ per-signal breakdown), `diagnostics` (+ raw diagnostics array). Each level includes everything below it. Applies uniformly to all formats (pretty, json, markdown, html). |
| `--verbose` / `-v` | off | (deferred — Phase 7) Increase stderr logging verbosity. Shows engine progress, validator invocation details, timing breakdowns, and internal debug info. Does not affect the report payload (stdout) — use `--detail` for that. Orthogonal to `--quiet` (which suppresses the spinner). |
| `--quiet` / `-q` | off | (deferred — Phase 9) Suppress stderr spinner. Engine warnings still pass through stderr (they're a small, bounded signal). Pretty/JSON stdout unchanged. The spinner ALSO auto-suppresses when stderr is not a TTY (CI logs, redirected stderr) — `--quiet` is the explicit override for interactive shells. |
| `--output` / `-o` `<file>` | stdout | Write report output to `<file>` instead of stdout. Useful for CI artifacts, Windows scripts, and future HTML/Markdown outputs where shell redirection is awkward. When set, spinner still goes to stderr. |
| `--with-llm` | off | Enable LLM-backed analysis in the engine (sets `OASProcessConfiguration.enable_llm_analysis=True` on the in-process pipeline call). Requires at least one supported provider credential (cloud) or `LLM_PROVIDER=OPENAI` + `OPENAI_API_URL` (local endpoint); CLI exits `1` with guidance if none are present. Forwards all detected credentials and routing variables to the container via `-e <NAME>` (passthrough form). See §5 "Bring your own LLM" for the full env-var contract. |
| `--bundle` | off | Force CLI-side bundling. For URL inputs, the CLI fetches the URL on the host and Redocly-bundles it before piping bundled JSON to the container via stdin — use this for URLs only the host can reach (internal networks, VPN-gated specs, auth-required URLs). Implies key-required, since the anonymous allowlist does not apply once the source URL stops reaching the container. For local paths the flag is a no-op: bundling is always how local files are handled. Safe to leave on in scripts where `$INPUT` could be either type. **Note**: `--bundle` follows HTTP redirects from any URL the user types — this is the user's host doing the fetching, so this is not SSRF-relevant in the usual sense, but typing arbitrary URLs into a tool that fetches them is the user's responsibility. |

### Input dispatch

The CLI inspects `<input>` and chooses one of three paths:

- **Local mode** (path that exists). CLI bundles the spec with `@redocly/openapi-core` — resolving local `$ref`s and copying remote `$ref` content into a single self-contained JSON document — and writes that JSON string to the container's stdin via `docker run -i`. Inside the container, the runner reads stdin to a temp file and forwards its `file://` URI to the engine. Local mode requires `JENTIC_API_KEY`.
- **URL mode** (`http://` / `https://`, default for URLs). CLI does not fetch and does not bundle. It passes `--url <url>` to the container, which enforces the anonymous gate on the URL string and then forwards the URL to the engine — the engine handles fetching and `$ref` resolution. URL mode is anonymous-allowed for jentic-public-apis URLs, key-required for everything else.
- **Bundled-URL mode** (`--bundle` set, input is a URL). CLI fetches the URL on the host, runs Redocly bundling, and pipes bundled JSON to the container's stdin — exactly like local mode, just with an HTTP source. Use this when the URL is only reachable from the host (internal network, VPN-gated, auth-required). Bundled-URL mode requires `JENTIC_API_KEY`; the anonymous allowlist does not apply because the source URL never reaches the container.

The split is deliberate. The default URL path keeps the gate authoritative — the container scores the same URL string it gates on, no spoofable env-var coupling. Local mode and bundled-URL mode handle the cases where the container cannot reach the source.

| Input | `--bundle` | Path taken |
|---|---|---|
| local file | (any) | Local: CLI bundles → stdin → container → engine |
| public URL | off (default) | URL: container fetches via engine, gate enforced |
| public URL | on | Bundled-URL: CLI fetches + bundles → stdin → container → engine; key required |
| internal URL | off | URL: engine attempts fetch from container, likely fails |
| internal URL | on | Bundled-URL: CLI fetches + bundles → stdin → container → engine; key required |

### Auth

The CLI reads `JENTIC_API_KEY` from its environment and forwards it to the container as `-e JENTIC_API_KEY=<value>`. If the env var is unset, the CLI runs in anonymous mode — only URL inputs matching the jentic-public-apis allowlist are accepted.

```
export JENTIC_API_KEY=<your-key>
npx @jentic/api-scorecard-cli score ./openapi.yaml
```

No `login` subcommand, no credentials file, no token persistence — those are post-Delivery-1 UX additions on top of an env-var foundation that already works (see §10).

#### Key validation and rate limiting

The container validates real keys live against `POST https://api.jentic.com/api/v1/usage/api-scoring`, sending the key in the `X-Jentic-API-Key` header. The HTTP client sets `allow_redirects=False` so a 3xx response cannot bounce the request — and the `X-Jentic-API-Key` header — to a different host than the one the runner intended to reach (`requests` does not strip custom headers on cross-host redirects). The endpoint is the same call that increments the user's scoring counter, so a single round-trip both authenticates the request and enforces the per-key rate limit. Responses are interpreted as:

- **2xx** — key valid and within quota; scoring proceeds.
- **429** — key valid but the user is over quota. The body is a Jentic ProblemDetails JSON (per the [Jentic API problem-details domain](https://raw.githubusercontent.com/jentic/api-problem-details/refs/heads/main/openapi-domain.yaml)); the container surfaces the `detail` string and the `Retry-After` header (when present) on stderr and exits with `RATE_LIMITED` (7).
- **401 / 403** — server-side key rejection. Container exits with `AUTH_INVALID_KEY` (2) and prints the server's `detail`.
- **Anything else (3xx, unexpected 4xx, 5xx, network error, timeout, malformed body)** — the container fails open: it prints a one-line warning to stderr and lets scoring proceed. **Policy**: validator unreachability fails open. This is intentional and PO-confirmed — an outage on Jentic's side must not block scoring.

URLs matching the jentic-public-apis allowlist (see "Anonymous gate" above) are always free and **skip the validation call entirely**, regardless of whether a key is set. This keeps OAK contributions zero-friction even after rate limits ship.

**Free quota**: 100 scorings per calendar month per key, resetting at the start of each month. Keys exceeding the quota receive a 429 with the upgrade link in the ProblemDetails `detail` field. Subscribed keys carry their own quota terms surfaced by the same endpoint.

### LLM provider keys (only when `--with-llm` is set)

When `score` is invoked with `--with-llm`, the CLI scans its own environment for known provider credentials and routing variables, then forwards each that is present to the container using docker's passthrough form (`-e NAME` with no value, which copies the value from the CLI's environment at run time).

**Cloud credentials** (at least one must be present for a cloud recipe):

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_REGION`, `AWS_BEARER_TOKEN_BEDROCK` (Bedrock — `AWS_SESSION_TOKEN` is required when using temporary credentials, e.g. from `aws sts assume-role` or AWS SSO)

**Routing variables** (forwarded when present; required for non-Bedrock providers):

- `LLM_PROVIDER`, `LIGHT_LLM_PROVIDER`, `LLM_MODEL`, `LLM_LIGHT_MODEL`, `LLM_MAX_TOKENS`
- `OPENAI_API_URL`, `ANTHROPIC_API_URL`, `GEMINI_API_URL`

If `--with-llm` is set but no usable provider is detected (no credential present, and `LLM_PROVIDER=OPENAI` + `OPENAI_API_URL` not set together), the CLI exits `1` (`GENERIC_ERROR`) before invoking docker, with a guidance message covering both cloud and local recipes. Without `--with-llm`, the CLI never forwards LLM keys or routing variables, even if they are set on the host. The container treats `--enable-llm-analysis` as off unless the CLI explicitly turns it on (see §6).

**Note on key visibility**: provider keys passed via `-e <NAME>` show up in `docker inspect <container-id>` for the duration of the run. This is standard Docker behavior on every host that uses Docker — it's not a CLI-introduced exposure. Anyone with access to the user's Docker daemon already had that level of access. We do NOT log keys in spinner output, error messages, or telemetry.

#### Bring your own LLM

The upstream engine supports both cloud LLM providers and OpenAI-compatible local endpoints (Ollama, LM Studio, llama.cpp, vLLM, …). The CLI's job is to detect configuration and forward it — the engine handles provider selection.

**Cloud recipe** — export one credential plus routing variables:

```bash
export OPENAI_API_KEY=<key>        # or ANTHROPIC_API_KEY / GEMINI_API_KEY / AWS_ACCESS_KEY_ID
export LLM_PROVIDER=OPENAI          # must match the credential
export LIGHT_LLM_PROVIDER=OPENAI    # lightweight model provider
export LLM_LIGHT_MODEL=gpt-4o-mini  # lightweight model ID
```

Without `LLM_LIGHT_MODEL` the engine falls back to a Bedrock model ID and the run will fail for non-Bedrock providers. The engine defaults `LLM_PROVIDER=BEDROCK`, `LIGHT_LLM_PROVIDER=BEDROCK`, and `LLM_LIGHT_MODEL=global.anthropic.claude-haiku-4-5-20251001-v1:0` — all three are Bedrock-shaped, so non-Bedrock users must override the full triple.

**Local recipe** — OpenAI-compatible endpoint (e.g. Ollama):

```bash
export LLM_PROVIDER=OPENAI
export LIGHT_LLM_PROVIDER=OPENAI
export OPENAI_API_URL=http://localhost:11434/v1/chat/completions
export OPENAI_API_KEY=ollama          # any non-empty value
export LLM_MODEL=llama3.1:8b
export LLM_LIGHT_MODEL=llama3.1:8b
```

**Host-network reachability**: when the CLI detects a forwarded `*_API_URL` whose hostname is `localhost`, `127.0.0.1`, `0.0.0.0`, or `host.docker.internal`, it applies platform-specific Docker networking so the container can reach the host machine. On Linux the CLI adds `--network host` (container shares the host network stack, so `localhost` just works). On macOS / Windows Docker Desktop the CLI adds `--add-host=host.docker.internal:host-gateway` (Docker Desktop already provides `host.docker.internal` natively; the flag is harmlessly idempotent). The same `npx … score --with-llm` command works on all three platforms with no per-OS user instructions.

**Security note**: credentials forwarded via `docker run -e` are visible to anyone with access to the user's Docker daemon for the duration of the run (`docker inspect` exposes them). This is standard Docker behavior, not a CLI-introduced exposure.

### Output specification

Three orthogonal concepts control output:

| Concept | Flag | Controls |
|---|---|---|
| **Format** | `--format <fmt>` / `-f` | How output is encoded: `pretty`, `json` (`markdown` / `html` reserved for later phases). |
| **Detail level** | `--detail <level>` / `-d` | How much of the scoring result is included in the payload (stdout). |
| **Verbosity** | `--verbose` / `-v` | (deferred — Phase 7) How much internal logging goes to stderr. |

Format and detail are independent axes. Any format can be combined with any detail level. Verbosity is orthogonal to both — it controls stderr logging (engine progress, validator invocations, timing), not the report payload.

#### Detail levels

Detail levels form a strict hierarchy — each level includes everything from the levels below it:

| Level | Includes | Typical use |
|---|---|---|
| `summary` | Score + grade + readiness level | CI badge, one-liner status checks |
| `dimensions` (default) | + dimension table (kind, name, score, grade) | Human "at a glance" view, lightweight CI artifacts |
| `signals` | + per-signal breakdown (~35 signals with `[0, 1]` scores) | "What should I fix?" escalation |
| `diagnostics` | + raw diagnostics array (sources: `redocly-validator`, `spectral-validator`, `speclynx-validator`, `default-validator`, `loader`; severity: LSP integers 1=error, 2=warning, 3=info, 4=hint) | Full evidence bundle, debugging |

#### Detail × format matrix

| Detail | `pretty` | `json` | `markdown` | `html` (post-MVP) |
|---|---|---|---|---|
| `summary` | headline only (~3 lines) | `{ metadata, apiMetadata, summary }` minus `dimensions` (~200 B) | score line only | self-contained HTML, headline only |
| `dimensions` | headline + dimension table (~12 lines) | `{ metadata, apiMetadata, summary }` with `dimensions` (~1 KB) | summary + dimension Markdown table (~30 lines) | + dimension panel |
| `signals` | + per-signal expansion (~80–150 lines) | + `details[].dimensions[].signals[]` (~5 KB) | + signal list per dimension (~80–120 lines) | + per-signal breakdown |
| `diagnostics` | + diagnostics grouped by source/severity (~150–500 lines) | + `diagnostics[]` array (~50–500 KB) | + diagnostics as Markdown list (~100–300 lines) | + diagnostics panel (virtualized for large counts) |

The dimension layout matches `summary.dimensions[]` directly (`kind`, `name`, `score`, `grade`). JAIRF weights are not surfaced in the engine's `summary` payload, so the pretty formatter does not show them — if we want a weight column post-MVP, we hard-code the JAIRF-spec weights in the formatter rather than asking the engine for them.

Diagnostic sources mirror the engine. Severity uses LSP integers (1=error, 2=warning, 3=info, 4=hint), surfaced as labels in pretty output.

#### Default pretty output (`--detail dimensions`)

```
Jentic API Readiness Scorecard
Source: <path or URL>

  Final score:    68.62 / 100
  Readiness:      ai-aware  (B+)

  Dimensions
    FC    Foundational Compliance                          99.51  A+
    DXJ   Developer Experience & Jentic Compatibility      68.89  B+
    ARAX  AI-Readiness & Agent Experience                  54.62  C
    AU    Agent Usability                                  93.70  A+
    SEC   Security                                         42.50  D-
    AID   AI Discoverability                              100.00  A+

  Run with --detail signals for signal breakdown.
  Full report: --format json --detail diagnostics
```

#### JSON output

The engine's result JSON to stdout (see §7). The CLI filters the payload based on `--detail`:

- `summary`: emits only `metadata`, `apiMetadata`, and `summary` (with `dimensions` array removed from `summary`).
- `dimensions` (default): emits `metadata`, `apiMetadata`, and `summary` (with `dimensions` array intact).
- `signals`: adds the `details` array (which contains `dimensions[].signals[]`).
- `diagnostics`: adds the `diagnostics` array.

Spinner still appears on stderr unless `--quiet`.

#### Other output controls

**`-o FILE` / `--output FILE`** — when set, report output is written to `<file>` instead of stdout. Spinner and engine warnings remain on stderr. Equivalent to shell redirection but portable to Windows and explicit in CI scripts. File-write errors print to stderr with a non-zero exit. For pretty output, ANSI escapes are stripped so the file stays plain text on disk; JSON output preserves the engine schema (it's re-serialized by the CLI with two-space indentation, not byte-verbatim).

**Spinner (stderr)** — replaces in place, single line:

```
⏳ Pulling ghcr.io/jentic/jentic-api-scorecard:<v>…
⏳ Bundling ./openapi.yaml…
⏳ Scoring (24 paths, 6 dimensions)…
✓ done in 8.2s
```

stdout stays clean so `--format json | jq` works without filtering.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | Scoring completed (regardless of the score itself). |
| 1 | Generic error (input not found, bundling failed, container failed, etc.). |
| 2 | Auth: `JENTIC_API_KEY` is set to a value the Jentic backend does not recognize, or a local file / stdin input was used without the key set. |
| 3 | Anonymous gate rejected: URL not in jentic-public-apis allowlist. Message includes allowlist index URL. |
| 4 | Docker not installed or daemon unreachable. Message includes install hint. |
| 5 | Spec fetch or parse failure (engine exit code 2, passed through). |
| 6 | Engine invocation failure (any other non-zero engine exit, passed through). |
| 7 | Rate limit reached: the key is valid but the user is over quota. Message includes the server-provided `detail` and the `Retry-After` header when present. |
| 8 | LLM analysis failed under `--with-llm`: the provider call failed (auth, model, connectivity, throttling, …), so the LLM-derived signals would be scored as perfect and inflate the result. The CLI suppresses the report and prints the affected signals + provider error on stderr; the non-zero exit lets CI gate on it. Only reachable with `--with-llm`. (The container still streams the scorecard so the host CLI can read it to name the affected signals — see the container exit-code table.) |

### Error UX examples

```
$ npx @jentic/api-scorecard-cli score ./local.yaml         # no key
error: scoring from stdin requires a Jentic API key.
  Get a key at https://app.jentic.com/scorecard?tab=api-keys and retry:
    export JENTIC_API_KEY=<your-key>
exit 2

$ npx @jentic/api-scorecard-cli score https://example.com/openapi.yaml   # no key
error: anonymous scoring is restricted to OpenAPI documents hosted at:
  https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/
  Browse available documents:
    https://github.com/jentic/jentic-public-apis/tree/main/apis/openapi
  Or get a key:
    https://app.jentic.com/scorecard?tab=api-keys
exit 3

$ npx @jentic/api-scorecard-cli score ./openapi.yaml      # docker not in PATH
error: 'docker' command not found.
  Install Docker: https://docs.docker.com/get-docker/
exit 4

$ JENTIC_API_KEY=<your-key> npx @jentic/api-scorecard-cli score ./local.yaml   # over quota
error: rate limit reached for your Jentic API key.
  monthly scoring quota exhausted
  Retry-After: 3600
  Manage your key at https://app.jentic.com/scorecard?tab=api-keys
exit 7
```

## 6. Docker image specification

### Base + tooling

- Base: `python:3.14-slim`.
- Adds Node.js 24 LTS. Required by the engine pipeline, which spawns Redocly / Spectral / Speclynx via `npx`. The engine documents Node ≥18 as the minimum; we ship the latest LTS so users get current security patches and modern V8 startup.
- Build via `uv` (single-stage build is fine for MVP; can be split later).
- Engine: [`jentic-apitools-pipelines`](https://pypi.org/project/jentic-apitools-pipelines/) + [`jentic-apitools-common`](https://pypi.org/project/jentic-apitools-common/) installed from PyPI. The runner imports `jentic.apitools.pipelines.score_openapi` and calls it directly; there is no separate engine console script.
- Image entry point: `python -m jentic_scorecard_runner` — a thin wrapper that parses args, enforces the anonymous gate, and calls `score_openapi(...)` in-process. It does not fetch URLs itself.

### Container entry point and process chain

The Dockerfile sets a fixed `ENTRYPOINT`; every `docker run` invocation appends arguments to it. The host CLI never overrides the entrypoint.

```dockerfile
ENTRYPOINT ["python", "-m", "jentic_scorecard_runner"]
# No CMD: every run requires an explicit verb (score …) on the docker run line.
```

End-to-end process chain for a single score:

```
host:        npx @jentic/api-scorecard-cli score ./openapi.yaml --format json
               └─ TS CLI: bundle, build docker argv, spawn:
host:        docker run -i --rm
               -e JENTIC_API_KEY
               ghcr.io/jentic/jentic-api-scorecard:1.0.0
               score                         ← appended to ENTRYPOINT
container 1: python -m jentic_scorecard_runner score
               └─ runner: auth check, gate, stdin→tempfile, then call:
                 jentic.apitools.pipelines.score_openapi(OASJsonRequest(...), spec_url=...)
                 └─ engine: spawn validators via npx, score, write scorecard.json,
                            runner reads it back and emits JSON to stdout
```

This is why the container has its own argument grammar (`score [--url <url>] [--with-llm]`) parsed by the runner — without it, `docker run … <image> <args>` would have nothing on the inside to receive `<args>`. The runner is also where pre- and post-engine concerns live: auth, gate, I/O sizing, exit-code mapping. Putting these in the runner instead of the host CLI keeps the host-side TS code small and keeps anything that touches the spec inside the same security boundary as the engine.

`docker exec` is intentionally not used: there is no long-running container to exec into, and creating one would require a daemon-lifecycle subsystem in the host CLI (idle-timeout, image-version drift detection, env-var staleness handling, crash recovery) that does not pay for itself at MVP scale. Per-score Docker overhead is ~100–300 ms vs. ~30–80 ms for `exec`; on a multi-second scoring operation, that gap is noise.

### Pre-baked dependencies (build-time invariant)

**A running container performs no package installs.** All runtime dependencies — Python wheels, JS tarballs, npm transitive deps — are baked into the image at build time.
The container's job is to read input, run the engine, write output. If a score ever triggers an npmjs or PyPI round-trip, the Dockerfile is wrong.

This matters because the engine ships JS tools as bundled tarballs inside its Python wheels (e.g. `@jentic/openapi-validator-speclynx` ships `jentic-openapi-validator-speclynx-0.1.0.tgz` inside the validator's `resources/` directory) and invokes them via `npx --yes file:<tarball-path>` at scoring time. By default, `npx` extracts the tarball, fetches transitive dependencies from npmjs, and caches the result in the user's npm cache. Combined with our `--rm` ephemeral-container model, a naive image would **repeat that install on every score** — every container starts with a fresh npm cache.

**Mitigation: warm the npm cache during `docker build` by running a real score.**

```
ENV NPM_CONFIG_CACHE=/var/cache/npm
# Engine deps installed via uv sync in an earlier builder stage; venv copied here.
RUN python -m jentic_scorecard_runner score \
        --url https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/swagger-api/petstore/1.0.27/openapi.json \
        > /dev/null
```

The score against the OAK petstore exercises every validator the engine will invoke at runtime, populating `/var/cache/npm` with extracted tarballs (`_npx/<hash>/`) and downloaded transitive deps (`_cacache/`). The cache lives in an image layer; every `--rm` container inherits it via the image's read-only layers. No network at runtime.

Bonus: this doubles as a smoke test — if the engine is broken or the image is missing a system dep, `docker build` fails rather than every user's first score failing.

Confirmed by direct test (2026-05-21, `jentic-apitools-cli==1.0.0a16`, the OSS console-script equivalent at the time): the engine pipeline runs successfully without contacting Jentic during scoring — both invariants we rely on for an offline-capable image. The cache-warm `RUN` uses an allowlisted (jentic-public-apis) URL so the gate accepts the request without a key.

**Per-`npx`-call overhead remains** (~500 ms–1 s for Node boot + npm CLI load + cache lookup, even on cache hits). For three validators that's ~1.5–3 s per score, which is acceptable on top of the actual analysis time.

**Future optimization (not MVP):** some validators expose a `*_PATH` override (Speclynx accepts `speclynx_path` in its constructor) that bypasses `npx` and runs the binary directly. If perf becomes a complaint, extract bundled tarballs into a fixed image path and set the corresponding env vars. Drops per-validator overhead to just Node startup (~100 ms). Deferred until needed.

The **invariant** ("no installs at runtime") is architectural: any deviation re-introduces per-score npmjs latency and offline-use breakage, and should be treated as a Dockerfile bug.

### I/O sizing: stdin in, tempfile out

Two large-data boundaries cross the wrapper. Both go through tempfiles, neither buffers a whole spec or result in Python memory.

**Stdin → tempfile (input side).** For local and bundled-URL modes, the wrapper reads `sys.stdin.buffer` in chunks and writes to a tempfile, then passes the path to the engine. `sys.stdin` has no hard size limit — it's a stream, kernel pipe buffers are just an in-flight window — but reading the whole spec into memory before persisting it is wasteful. Chunked read keeps RSS flat regardless of bundled-spec size.

**Engine output → scorecard.json on disk.** The runner gives `score_openapi(...)` an `output_dir` that points at a per-invocation `tempfile.TemporaryDirectory`. The pipeline writes its `scorecard.json` (and other artifacts) into that directory; the runner then opens the file in binary mode and `shutil.copyfileobj`'s it into `sys.stdout.buffer`. There is no subprocess pipe to drain, so kernel pipe-buffer deadlocks and PIPE-vs-RSS tradeoffs no longer apply. The copy is chunked (no parsing, no full-file buffer), which keeps RSS flat for large scorecards — diagnostics-rich payloads can reach ~100 MB on big specs. The temp dir is removed by the `with` block when the runner returns.

### Container CLI

```
score [--url <url>] [--with-llm]
  --url <url>    Score this URL. Container does NOT fetch; it forwards the
                 URL to the engine, which fetches and resolves $refs.
                 Mutually exclusive with stdin input.
  (no flag)      Read bundled spec JSON from stdin (local or bundled-URL mode).
                 Errors immediately if stdin is a TTY (no piped input → would
                 hang waiting for EOF).
  --with-llm     Forward to engine as `--enable-llm-analysis`.
                 Provider keys must be in env (see below).
```

The runner always invokes the engine with `--format json --include-diagnostics --quiet`; those flags are not exposed on the runner's surface because they're not optional. See Behavior step 5.

### Inputs the container reads

| Source | Used for |
|---|---|
| `--url <url>` arg | URL mode. Forwarded to engine; engine fetches + resolves `$ref`s. |
| stdin | Local mode and bundled-URL mode. Bundled spec JSON. |
| `JENTIC_API_KEY` env | Auth. Absence triggers anonymous gating. |
| LLM provider env vars | When `--with-llm` is set: credentials (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_REGION`, `AWS_BEARER_TOKEN_BEDROCK`) and routing (`LLM_PROVIDER`, `LIGHT_LLM_PROVIDER`, `LLM_MODEL`, `LLM_LIGHT_MODEL`, `LLM_MAX_TOKENS`, `OPENAI_API_URL`, `ANTHROPIC_API_URL`, `GEMINI_API_URL`). Forwarded by the host CLI; container reads whichever are present and lets the engine pick a provider. |

### Behavior

```
1. Parse args. Exactly one of {--url, stdin} must be present. If --url is
   absent AND stdin is a TTY (no piped input), exit non-zero with a clear
   error rather than blocking on stdin EOF forever.
2. Gate (in this order):
     a. If URL matches the jentic-public-apis allowlist, allow (free tier;
        no validator call).
     b. Else if JENTIC_API_KEY is empty:
          - URL mode: reject (allowlist message), exit 3.
          - stdin mode: reject (key required), exit 2.
     c. Else POST to https://api.jentic.com/api/v1/usage/api-scoring with
        X-Jentic-API-Key header. Interpret the response:
          - 2xx        → allow (call also doubles as usage increment).
          - 429        → exit 7 with server's ProblemDetails detail and
                         Retry-After header.
          - 401 / 403  → exit 2 with server's ProblemDetails detail.
          - other / network error → fail open (warn on stderr, allow).
3. Prepare engine input:
     - URL mode:  forward the URL string straight to the engine command line;
                  no fetch, no tempfile. The runner has already gated on the
                  URL, so the engine receives an authorized source.
     - stdin:     read sys.stdin.buffer in chunks to a tempfile, then pass
                  the path to the engine.
4. Score: call `jentic.apitools.pipelines.score_openapi(OASJsonRequest(...), spec_url=...)` in-process with `OASProcessConfiguration(enable_llm_analysis=<flag>, include_diagnostics_in_score=True)`. Between receiving the input and scoring it, the engine applies a fixed convert → bundle → validate sequence (see "Engine spec-processing pipeline" below). The pipeline writes `scorecard.json` plus other artifacts into a per-invocation temp directory. `include_diagnostics_in_score=True` is always set: the container produces one canonical JSON payload regardless of host-side flags. Filtering for terminal output is the host CLI's job.
5. Emit `scorecard.json` to stdout (engine output is forwarded verbatim).
```

### Engine spec-processing pipeline (in-process)

`score_openapi` is the engine's own pipeline — originally built for OAK's spec-*import* flow and reused here for scoring (the reuse bought us a battle-tested convert/bundle/validate stack for free). The runner does not configure it beyond `enable_llm_analysis=<flag>` and `include_diagnostics_in_score=True`; every other `OASProcessConfiguration` knob takes its default (`skip_bundle=False`, `bundled_spec=False`, …). So before scoring, the engine applies a fixed sequence of transformations to the document. **The scorecard describes this processed document, not necessarily the bytes the user submitted.**

1. **Convert (Swagger 2.0 / Google Discovery → OpenAPI 3.0.0).** If the input is detected as Swagger 2.0 (`is_swagger_2`) or Google Discovery (`is_google_format`), the engine shells out to `npx --yes api-spec-converter --from=<fmt> --to=openapi_3 --syntax=json`. The output is always **OpenAPI 3.0.0** — `api-spec-converter`'s `openapi_3` target stamps `openapi: 3.0.0` and has no 3.1 mode — so a Swagger 2.0 author is scored against a machine-generated 3.0.0 document whose ceiling is set by 3.0.0 plus the converter's fidelity, never the 2.0 doc they actually ship. Inputs already at OpenAPI 3.0.x / 3.1.x pass through unconverted and are scored as authored. This conversion is **unconditional** — there is no `OASProcessConfiguration` flag to disable it — and emits an informational diagnostic (`imported-spec-is-swagger-2` / `imported-spec-is-google-discovery`); a conversion failure emits `failed-to-convert-swagger-2-to-oas3` and scoring proceeds on the original.

   **Supported OpenAPI versions: 3.0.x and 3.1.x only. OpenAPI 3.2 is _not_ supported.** The failure is **partial and uneven across validators**, which is what makes it dangerous rather than merely unsupported (all verified 2026-06-18):
      - **Spectral** and **Redocly** *do* parse 3.2 — they walk the document and emit real lint findings (missing `servers`, `contact`, tags, etc.), so they'd penalize genuine problems. (Spectral additionally fires one stale-regex finding, `"openapi" property must match pattern "^3\.0\.\d…"`, but that's a single lint result, not a parse failure.)
      - **`openapi_spec_validator`** honestly *rejects* it: `Document does not appear to be a valid OpenAPI 3.0.x or 3.1.x specification` (error).
      - **SpecLynx** — the dominant count-based analyzer — *cannot parse 3.2 at all*: it emits `Document is not recognized as a valid OpenAPI 3.x document` (error) plus a dereference error, and every SpecLynx-derived metric collapses to zero (0 operations, 0 schemas, 0 examples, 0 references, 0 security schemes, …).

      Because the zeroed count-signals have nothing to penalize, they score perfect and **drown out** the real Spectral/Redocly findings, so a 3.2 document scores *higher* than the same document at 3.0.x — a minimal 3.2.0 doc scored 92.99/A+ where the identical doc at 3.0.4 scored 70.19/A-. The score is inflated and meaningless. The scoring calculators list `(OPENAPI, "3.2.*")` in their `target_specs`, but SpecLynx underneath does not honor it, and there is no version gate in the runner today — so 3.2 inputs are scored silently. Treating 3.2 as out of scope is part of the effective contract until SpecLynx adds 3.2 support (or the runner grows a version reject).
2. **Bundle (Redocly).** Because `skip_bundle`/`bundled_spec` are left at their defaults, the engine runs `OpenAPIBundler("redocly").bundle(...)` to inline external `$ref`s into one self-contained document, then scores that. For local / bundled-URL inputs the CLI has *already* Redocly-bundled host-side (§5 input dispatch), so the engine bundles a second time; the re-bundle is idempotent (no external refs remain) — redundant, not harmful. URL inputs are bundled once, by the engine.
3. **Final validation.** The bundled (or, under `skip_bundle`, unbundled) document is run through `OpenAPIAnalyzer().analyze(...)`, whose diagnostics feed the score (`include_diagnostics_in_score=True`). This produces diagnostics; it does not rewrite the document.

**Not applied in the score path.** The engine's *import* flow additionally reorders keys (`reorder_openapi_spec`) and injects an `info.x-jentic-source-url` annotation, but `score_openapi` does **neither** — those live in `import_openapi` only.

**Design status.** Bundling is a deliberate, documented scorecard decision (§5 input dispatch) — an AI consumer resolves `$ref`s anyway, so scoring the resolved form matches what a consumer sees. The Swagger-2.0 → 3.0.0 conversion, by contrast, is **inherited engine behavior we accept rather than a behavior we chose**: it has no off-switch and would need an upstream change to make opt-out. The exact convert/bundle/validate logic lives in the vendored `jentic-apitools-pipelines` package (pinned in `docker/pyproject.toml`), not in this repo, so the authoritative sequence for a given release is that package's `score_openapi` source. Until we deliberately change it upstream, treat **"Swagger 2.0 is silently converted to OpenAPI 3.0.0, and bundling always happens"** as part of the scorecard's effective contract.

### Exit codes (container)

| Code | Meaning |
|---|---|
| 0 | Result emitted on stdout. |
| 1 | Generic error (including: invocation with no `--url` and no piped stdin). |
| 2 | Auth: key rejected by `api.jentic.com` validator (401 / 403). |
| 3 | Anonymous gate rejected. |
| 5 | Reserved for spec-policy failure. Currently unreachable since the in-process pipeline does not expose a separate spec-policy exit code; kept defined to preserve the public contract. |
| 6 | Engine invocation failure (pipeline exception or `result.success == False`). |
| 7 | Rate limit reached (validator returned 429). |
| 8 | LLM analysis failed under `--with-llm`: the engine returns `result.success == True` but the LLM batches did not complete, so the affected LLM-derived signals were scored as perfect. Detected from the engine diagnostics two ways — an explicit `llm-analysis-error` (provider auth/model errors) or a `semantic-analysis-summary` reporting batches attempted (`batches_processed > 0`) but zero operations analyzed (`total_operations_analyzed == 0`, the connectivity case). The runner still streams `scorecard.json` to stdout (so the host can read it to name the affected signals) and then returns this code. Only reachable with `--with-llm`. |

The CLI passes these through verbatim and adds its own codes for host-side concerns (4 = Docker missing). The user-facing exit-code contract is §5.

## 7. Result JSON schema

The CLI does not invent a schema. It emits **whatever the engine writes to `scorecard.json`, verbatim**, filtered by `--detail` level (see §5). The container always requests full output (`include_diagnostics_in_score=True`) from the engine; the CLI strips fields the user didn't ask for based on `--detail`. Reformatting in the formatter (pretty output, Markdown) is a read-only projection — keys are not renamed, restructured, or filtered. The pretty/HTML/Markdown formatters tolerate unknown keys and absent optional keys, so engine bumps that add new fields don't break formatting.

The shape below was captured by running the petstore spec through the engine pipeline at `jentic-apitools-cli==1.0.0a16` (the OSS console-script equivalent at the time). Treat this as a sample, not a contract — the engine owns the schema.

```jsonc
{
  "metadata": {
    "version": "1.0.27",                // engine-emitted version of THIS scorecard format
    "releaseDate": null,
    "engine": {
      "name": "Jentic API Scoring Framework",
      "version": "0.4.1+jairf.1.0.0"     // framework version + JAIRF version it implements
    },
    "disclaimer": "Scores are indicative…"
  },

  "apiMetadata": {
    "apiId": "",
    "name": "Swagger Petstore - OpenAPI 3.0",
    "apiDescriptionVersion": "1.0.27",
    "specification": "openapi",
    "specificationVersion": "3.0.4",
    "sourceUrl": "https://petstore3.swagger.io/api/v3/openapi.json",
    "vendor": {
      "name": "petstore3.swagger.io",
      "domain": null,
      "contact": { "name": "", "email": "apiteam@swagger.io" }
    },
    "operationCount": 19,
    "schemaCount": 64,
    "securitySchemeCount": 2,
    "securitySchemeTypes": ["apiKey", "http"],
    "tagCount": 3
  },

  "summary": {
    "scoringDate": "2026-05-21T12:51:22Z",
    "score": 68.62,                      // overall, [0, 100]
    "level": "ai-aware",                 // categorical maturity
    "grade": "B+",                       // A+ … F
    "dimensions": [                      // 6 entries (FC, DXJ, ARAX, AU, SEC, AID)
      {
        "kind": "FC",
        "name": "Foundational Compliance",
        "intention": "Base layer of spec validity and structural soundness.",
        "score": 99.51,
        "grade": "A+"
      }
      // …
    ]
  },

  "details": [                           // 3 group entries (FDX, AIRU, TSD)
    {
      "kind": "FDX",
      "name": "Foundational & DX",
      "description": "Human-oriented and tooling alignment …",
      "score": 83.3,
      "grade": "A",
      "dimensions": [                    // 2 dimensions per group
        {
          "kind": "FC",
          "name": "Foundational Compliance",
          "intention": "…",
          "score": 99.51,
          "grade": "A+",
          "signals": [                   // ~4–8 signals per dimension
            {
              "kind": "lint_results",
              "name": "Lint Results",
              "description": "Aggregated quality score from linter diagnostics, weighted by severity.",
              "score": 0.98,             // [0, 1] — note: signal scores are NOT 0–100
              "metadata": {              // engine-defined per signal; varies
                "severity_counts": {
                  "critical": 0, "error": 0,
                  "warning": 67, "info": 69, "hint": 0
                },
                "weighted_cost": 0.2365,
                "max_cost": 25.0,
                "provenance": { "diagnostics": { "severity": [1, 2, 3, 4] } }
              }
            }
            // …
          ]
        }
        // …
      ]
    }
    // …
  ]
}
```

**Notes for formatter / consumer code:**

- Top-level: `metadata`, `apiMetadata`, `summary`, `details`, and optionally `diagnostics`. The CLI filters based on `--detail` level: `summary` strips `dimensions` from `summary` and omits `details`/`diagnostics`; `dimensions` (default) includes `summary.dimensions[]` but omits `details`/`diagnostics`; `signals` adds `details`; `diagnostics` adds `diagnostics`.
- The headline-line in our pretty formatter maps directly: `summary.score`, `summary.level`, `summary.grade`.
- The dimension table maps to `summary.dimensions[]` with `kind` / `name` / `intention` / `score` / `grade`. **Weights are not in the JSON anywhere** — they live only inside the engine's aggregation code. If a future formatter wants a "weight" column, hard-code the JAIRF-spec values (FC 0.16, DXJ 0.18, ARAX 0.24, AU 0.20, SEC 0.12, AID 0.10).
- `--detail signals` walks `details[].dimensions[].signals[]` for the per-signal breakdown.
- `signals[].score` is in `[0, 1]` (engine-normalized); group / dimension / overall scores are `[0, 100]`. Formatters must not multiply by 100 in one place and forget in another.
- `signals[].metadata` is freeform per-signal — engine adds whatever context that signal cares about. Formatters should treat it as opaque (display verbatim or omit).
- **Compatibility tactic**: the formatter reads only the keys it understands and ignores everything else. Engine version bumps that add fields (or rename signals) don't break formatting; they may cause new fields not to appear in pretty output until the formatter is updated.

## 8. Versioning & release

**Coupling**: CLI npm version = GHCR image tag. The Python engine packages (`jentic-apitools-pipelines` + `jentic-apitools-common`) version independently upstream; each image build pins one specific pair.

**Channels**: the CLI ships **stable** under the `@jentic/api-scorecard-cli@latest` npm dist-tag. There is no separate alpha or beta channel. The pre-1.0 alpha cuts (`1.0.0-alpha.0` through `1.0.0-alpha.29`) remain on npm under the legacy `alpha` dist-tag for historical reproducibility but receive no further updates.

- Each cut publishes `@jentic/api-scorecard-cli@<version>` under `latest` and `ghcr.io/jentic/jentic-api-scorecard:<version>` at the matching exact tag. No floating `:latest` is published on the docker side; the CLI consumes only exact tags.
- `@jentic/api-scorecard-formatter-html` is `"private": true` and does not publish until Phase 14 lands its real implementation.
- `docker/pyproject.toml` (used at image build time) pins `jentic-apitools-pipelines==<exact-version>` and `jentic-apitools-common==<exact-version>`.

The CLI hard-codes the image tag matching its own npm version. Users who want to reproduce yesterday's score install yesterday's CLI version (`npx @jentic/api-scorecard-cli@1.0.0`) — that pulls `:1.0.0`, which has the engine version pinned exactly. **Reproducibility = pin one CLI version**; the engine version it transitively carries is recorded in `metadata.engine.version` of the result JSON (the engine emits this directly).

When the engine releases an update we want to ship, we:
1. Bump `jentic-apitools-pipelines` and `jentic-apitools-common` in `docker/pyproject.toml`.
2. Cut a new CLI version. Release cadence is driven by [Conventional Commits](https://www.conventionalcommits.org/): `lerna version --conventional-commits --force-publish` reads the `feat:` / `fix:` / `BREAKING CHANGE:` markers since the last tag and computes the next version (patch / minor / major).
3. CI builds and pushes `ghcr.io/jentic/jentic-api-scorecard:<new-version>` containing the new engine, and publishes `@jentic/api-scorecard-cli@<new-version>` under the `latest` dist-tag.

**Continuous delivery** (CI): every push to `main` triggers `docker-publish.yml`, which gates on `ci.yml` (lint + test) and then builds and pushes `ghcr.io/jentic/jentic-api-scorecard:unstable` (multi-arch: linux/amd64 + linux/arm64). Merging to `main` does **not** publish a CLI version — it makes the change available to the next release cut.

**Release pipeline** (CI): a `workflow_dispatch` on `release.yml` runs CI, bumps the version via Conventional Commits, cuts a GitHub release marked `latest`, builds and pushes `ghcr.io/jentic/jentic-api-scorecard:<version>` to GHCR (no floating `:latest` on the docker side), and runs `lerna publish from-package` for `packages/cli` under the `latest` npm dist-tag. `packages/formatter-html` is skipped automatically while it remains `"private": true`.

**Supply chain attestations**: each release emits an SPDX 2.3 SBOM for `@jentic/api-scorecard-cli` and attaches it to the registry-served tarball as a Sigstore-signed in-toto attestation via `actions/attest@v4`. The tarball that gets attested is downloaded from npm with `npm pack @jentic/api-scorecard-cli@<version>` immediately after `lerna publish` (with a retry loop to cover registry CDN propagation lag), guaranteeing the attestation digest matches the bytes consumers actually receive — `lerna publish` injects a `gitHead` field into the manifest before its internal pack, so locally re-packing produces a different digest than what the registry serves. The SBOM is generated from the CLI's `dependencies` resolved by `npm install --omit=dev` in an isolated staging directory (the CLI's `package.json` only — no monorepo root, no workspace hoisting), so it mirrors the runtime closure of the published tarball and excludes dev tooling. The image side mirrors this — every push to `ghcr.io/jentic/jentic-api-scorecard` carries SLSA v1 provenance (against the manifest list) and per-platform SPDX 2.3 SBOMs (against each child manifest digest), via both BuildKit-native OCI referrers and Sigstore-signed equivalents in GitHub's attestation store. Operationally both pipelines authenticate via OIDC: npm publishing uses [trusted publishing](https://docs.npmjs.com/trusted-publishers) (no `NPM_TOKEN`), and image publishing uses the workflow's automatic `GITHUB_TOKEN` (no PAT) — there are no long-lived publish secrets in the repository.

> **See also**: [supply-chain-npm.md](./supply-chain-npm.md) and [supply-chain-docker.md](./supply-chain-docker.md) — verification recipes (`gh attestation verify`, `docker buildx imagetools inspect`), per-platform SBOM extraction, downstream-pipeline integration, and the threat-model framing.

**Breaking changes**: the CLI does not introduce its own schema version. The result JSON is the engine's verbatim output, and the engine versions its scorecard format independently via `metadata.version` (e.g. `"1.0.27"`). Consumers tracking schema changes should key off `metadata.version` from the engine, not anything CLI-introduced. If we need to break the result shape on our side (we shouldn't — see §7), we'd announce it via the CLI's release notes, not via an envelope key we don't actually emit.

## 9. Foundation: registration & key

The auth pipeline is wired end-to-end against the Jentic backend:

- **Real keys**: issued at `https://app.jentic.com/scorecard?tab=api-keys`. Validated live by the container against `POST https://api.jentic.com/api/v1/usage/api-scoring` (header `X-Jentic-API-Key`). The same call doubles as the per-key usage / rate-limit accounting hit, so a single round-trip both authenticates and increments.
- **Free tier**: URLs under [`jentic/jentic-public-apis`](https://github.com/jentic/jentic-public-apis) score without contacting the validator at all, regardless of whether a key is set.
- **Fail-open**: when `api.jentic.com` is unreachable (3xx, unexpected 4xx, 5xx, network error, timeout, malformed body) the container prints a one-line warning and lets scoring proceed. PO-confirmed policy — an outage on Jentic's side must not block scoring.

The 429 response body is a Jentic ProblemDetails JSON per the [api-problem-details domain schema](https://raw.githubusercontent.com/jentic/api-problem-details/refs/heads/main/openapi-domain.yaml); the container surfaces the `detail` field and the `Retry-After` header (when present) on stderr and exits with `RATE_LIMITED` (7).

The validator endpoint is a Jentic-side usage-accounting hit, not the access-control mechanism. Access control is enforced inside the container by the allowlist regex and the no-key-in-stdin-mode reject — both run before any validator round-trip.

## 10. Out of scope (Delivery 1)

- HTML formatter wired into the CLI. The `@jentic/api-scorecard-formatter-html` package implements `format(result): string` (and a `./react` component entry), but the CLI's `--format html` flag that calls it is deferred (roadmap Phase 14 / 15).
- User-facing image flags. The CLI fully abstracts image management: it always pulls the image tag matching its own version, with no user override.
- Subcommands beyond `score` (e.g. `login`, `logout`, `whoami`, `config`, `lint`) and any persistent credentials file. Auth is env-var only.
- Multi-spec / portfolio scoring.
- Plugins or custom rubrics.
- Schema validation of the result JSON in the CLI (consumed permissively).
- `--min-score N` threshold for CI pass/fail. Deferred to phase 5 (CI integration). When added, `score` exits non-zero if the final score is below N — no architectural change needed, just an additional exit code and a comparison.
- CPU / concurrency control. The container inherits the host scheduler's defaults (uncapped on Linux; bounded by Docker Desktop's VM allocation on Mac/Windows); the engine decides its own internal parallelism. A `--cpus` flag and matching engine worker-pool hint are deferred until we have a concrete user pain (shared CI starvation, predictable scoring time, etc.) to design against.

## 11. Verification (post-implementation)

When the implementation lands, these acceptance checks validate the architecture end-to-end:

**Anonymous / gate path:**
- `npx @jentic/api-scorecard-cli score <jentic-public-apis-url>` (no key) → success, scorecard printed; no validator call.
- `npx @jentic/api-scorecard-cli score https://example.com/openapi.yaml` (no key) → exit 3 with allowlist-index hint.
- `npx @jentic/api-scorecard-cli score ./local.yaml` (no key) → exit 2 with signup hint.

**Real-key validation:**
- `JENTIC_API_KEY=<unknown-key> npx @jentic/api-scorecard-cli score ./local.yaml` → exit 2 with the server's ProblemDetails detail (validator returned 401/403).
- `JENTIC_API_KEY=<over-quota-key> npx @jentic/api-scorecard-cli score ./local.yaml` → exit 7 with the server's detail and the `Retry-After` header.
- `JENTIC_API_KEY=<valid-key> npx @jentic/api-scorecard-cli score ./local.yaml` → success; spinner shows `Bundling ./local.yaml…`. The validator request increments the user's per-key counter.
- `JENTIC_API_KEY=<valid-key> npx @jentic/api-scorecard-cli score <jentic-public-apis-url>` → success; no validator call (free tier short-circuits before the network hit).

**Output formats and detail levels:**
- `npx @jentic/api-scorecard-cli score <input> --format json | jq .summary.score` → numeric, no chrome on stdout.
- `npx @jentic/api-scorecard-cli score <input> --detail signals` → output includes all ~35 signals grouped by dimension.
- `npx @jentic/api-scorecard-cli score <input> --detail diagnostics` → output includes diagnostics grouped by source (`redocly-validator`, `spectral-validator`, `speclynx-validator`) and severity.
- `npx @jentic/api-scorecard-cli score <input> --detail summary` → only headline (score + grade + level), no dimension table.
- `npx @jentic/api-scorecard-cli score <input> --format json --detail signals` → JSON includes `details[].dimensions[].signals[]`.
- `npx @jentic/api-scorecard-cli score <input> --format json --detail diagnostics` → JSON includes `diagnostics` array.
- `npx @jentic/api-scorecard-cli score <input> --verbose` → extra stderr logging (engine progress, timing), report payload unchanged. *(Phase 7)*

**Bundle / LLM:**
- `JENTIC_API_KEY=<valid-key> npx @jentic/api-scorecard-cli score https://internal.example/openapi.yaml --bundle` → CLI fetches host-side, bundles, pipes to container; success.
- `npx @jentic/api-scorecard-cli score <input> --with-llm` with no provider env vars set → exits `1` (`GENERIC_ERROR`) with a guidance message covering cloud and local recipes, BEFORE any docker invocation.

**Container lifecycle:**
- `docker rmi ghcr.io/jentic/jentic-api-scorecard:<v> && npx @jentic/api-scorecard-cli score …` → spinner shows `Pulling…`, succeeds.
- `docker run -i --rm ghcr.io/jentic/jentic-api-scorecard:<v> score` (no `--url`, no piped stdin, attached to a TTY) → exits non-zero with a "no input" error, does NOT block on stdin.

**Environment:**
- `PATH= npx @jentic/api-scorecard-cli score …` → exit 4 with install hint.
- Container has no network beyond its required spec fetches (URL mode for the input + engine reaching crates.io / npmjs / etc. only at build time, not at run time).
