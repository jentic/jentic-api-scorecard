# Jentic API Scorecard — Architecture (MVP / Delivery 1)

> Status: Draft. Architecture for the initial public release.
> Framework: Jentic API AI Readiness Framework (JAIRF) v0.2.0 — see https://github.com/jentic/api-ai-readiness-framework

## 1. What this is

A zero-install CLI that scores an OpenAPI document against JAIRF and prints a Jentic API Readiness Scorecard. Users run it via `npx`. The scoring engine is a Python implementation of JAIRF, packaged as a public Docker image. The CLI orchestrates the image; no backend service is in the loop. Auth is env-var only (`JENTIC_API_KEY`); usage tracking and rate-limiting calls to Jentic are out of scope for Delivery 1.

During the MVP preview, key-required scoring works with `JENTIC_API_KEY=mvp-preview` (a documented public placeholder, not a secret — see §9). Real signup, real keys, and server-side validation land in a follow-up release.

```
$ JENTIC_API_KEY=mvp-preview npx @jentic/api-scorecard-cli score https://petstore3.swagger.io/api/v3/openapi.json
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
| Version coupling | CLI npm version = image tag. Engine (`jentic-apitools-cli`) versions independently and is pinned exactly inside each image. Pinning one CLI version reproduces the full stack. |
| Image flow | CLI fully abstracts image management. It pulls `ghcr.io/jentic/jentic-api-scorecard:<cli-version>` automatically. No user-facing image flags. |
| Tagging | Exact-version GHCR tags only (e.g. `:1.0.0-alpha.3`). The CLI consumes only exact tags, so no floating `:alpha` / `:latest` is published. The one floating tag is `:unstable`, which rolls on every green `main` for direct `docker run` users. |
| Docker mode | Shell out to `docker` CLI via `child_process.spawn`. No `dockerode`. |
| Input dispatch | Local path → CLI bundles via Redocly → pipes to container stdin. URL → CLI passes `--url` to container, engine fetches directly. URL + `--bundle` → CLI fetches and bundles host-side, pipes via stdin (escape hatch for internal/auth-gated URLs). |
| Anonymous gate | URL must match `^https://raw\.githubusercontent\.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/`. Enforced container-side. Local files require a key. |
| Auth | `JENTIC_API_KEY` env var only. CLI forwards it to the container as `-e JENTIC_API_KEY`. MVP scaffolds the auth pipeline by checking against a documented public placeholder (`mvp-preview`); real validation lands in a follow-up. No login subcommand or creds file in MVP. |
| Engine | [`jentic-apitools-cli`](https://pypi.org/project/jentic-apitools-cli/) on PyPI. Image bundles Python 3.12 + Node 24 (engine spawns Redocly / Spectral / Speclynx via npx). |
| LLM analysis | Off by default. Opt-in via `--with-llm`; CLI forwards present provider env vars (OpenAI / Anthropic / Gemini / AWS) to the container, which passes `--enable-llm-analysis` to the engine. |
| Usage tracking | Out of scope for Delivery 1. No container-side calls to Jentic. |
| Default output | Headline + dimensions on stdout; spinner phases on stderr. `--detail` controls payload depth (summary → dimensions → signals → diagnostics). `--format json` for machine-readable output. |
| Out of scope (MVP) | HTML formatter wired in (formatter package scaffolded only); user-facing image flags (image management is fully abstracted by the CLI); subcommands beyond `score` (no `login` / `whoami` / etc.); creds file persistence; rate limiting beyond URL allowlist. |

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
│    ├── score:  `jentic-apitools score <url-or-path> --format json             │
│                                  --include-diagnostics --quiet`               │
│    └── stdout: result JSON                                                    │
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
├── docs/
│   └── architecture.md                       (this file)
├── package.json                              (npm workspaces root: packages/*)
├── lerna.json                                (fixed versioning)
├── tsconfig.base.json                        (shared TS config for all packages)
├── packages/                                 (npm-distributed deliverables)
│   ├── cli/                                  (@jentic/api-scorecard-cli)
│   │   ├── package.json                      (bin: jentic-api-scorecard)
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts                      (entry; subcommand dispatch)
│   │       ├── commands/
│   │       │   └── score.ts
│   │       ├── auth.ts                       (read JENTIC_API_KEY env)
│   │       ├── bundle.ts                     (@redocly/openapi-core)
│   │       ├── docker.ts                     (spawn('docker', …))
│   │       ├── formatters/                   (pretty / json / markdown formatters; --format + --detail)
│   │       └── spinner.ts                    (stderr phase spinner)
│   └── formatter-html/                       (@jentic/api-scorecard-formatter-html — stub)
│       ├── package.json
│       └── src/index.ts                      (export format(result): string — TODO)
├── docker/                                   (image internals; not a deliverable on its own)
│   ├── Dockerfile                            (python:3.12-slim + Node 24, uv install)
│   ├── .dockerignore
│   ├── pyproject.toml                        (uv; deps: jentic-apitools-cli)
│   ├── uv.lock
│   ├── .build/
│   │   └── sample.yaml                       (tiny OpenAPI doc, COPY'd into image at build to warm npm cache)
│   └── src/jentic_scorecard_runner/
│       ├── __main__.py                       (image entry inside container)
│       ├── gate.py                           (URL allowlist enforcement)
│       └── score.py                          (spawns `jentic-apitools score`; parses JSON)
└── .github/workflows/
    ├── ci.yml                                (lint + test on PRs; also callable via workflow_call)
    ├── docker-publish.yml                    (build + push :unstable to GHCR on main; gated on ci.yml)
    └── alpha-publish.yml                     (alpha-tagged image + npm publish on v*-alpha.* tag — future)
```

A few layout notes worth calling out:

- `packages/` and `docker/` are siblings at the repo root. Lerna's workspace globs are `packages/*`; the Dockerfile is built with `docker build ./docker`. Neither tree depends on the other at build time — they only compose at runtime when the host CLI invokes the container.
- The Python code under `docker/src/jentic_scorecard_runner/` is *image-internal* — it's never published to PyPI, never imported from anywhere outside the image. Treating it as part of the docker artifact (rather than a peer "Python project") avoids the false impression that Python is a parallel deliverable to JS.
- `tsconfig.base.json` and `lerna.json` live at the repo root because Lerna and TypeScript expect monorepo metadata to be top-level. There's no `javascript/` wrapper because there's no symmetric `python/` to balance against — JS is the only language we publish.
- **`pretty`, `json`, and `markdown` formatters live inside `packages/cli/src/formatters/`** because they're plain TS string-projections of the engine result with no toolchain weight. **`formatter-html` is a separate package** because its Phase 14 implementation is an interactive React SPA (single self-contained HTML, bundle inlined into `<script>` and `<style>` blocks) — pulling React + a bundler into `packages/cli/` would burden every `pretty`/`json` user with weight they never use. The decision rule: a formatter gets its own package iff its build/runtime toolchain materially exceeds the CLI's; otherwise it lives in the CLI. The CLI is today the only consumer of these formatters, so per-toolchain weight is the load-bearing axis for the split — not library re-use across surfaces.

## 5. CLI specification

### Subcommand

The CLI exposes a single subcommand for Delivery 1: `score <input>`. Scoring an OpenAPI doc is the only thing the CLI does; auth comes from the environment, not from a CLI verb.

### `score <input>` flags

| Flag | Default | Behavior |
|---|---|---|
| `--format <fmt>` / `-f` | `pretty` | Output encoding. Values: `pretty` (human-readable table), `json` (machine-readable JSON), `markdown` (Markdown report), `html` (single self-contained HTML; post-MVP). `pretty` is the default for interactive use; `json` is the default when stdout is not a TTY (piped/redirected). `html` has a distinct TTY rule because its payload is unreadable in a terminal and may be very large: it errors when stdout is a TTY without `-o`, and streams to stdout only when stdout is a pipe (`score … --format html > scorecard.html`). |
| `--json` | — | Convenience alias for `--format json`. Kept for discoverability and ergonomics in simple CLIs, but `--format` is the canonical flag. |
| `--detail <level>` / `-d` | `dimensions` | Controls payload depth — how much of the scoring result is included in output. Values form a graduated hierarchy: `summary` (score + grade + level only), `dimensions` (+ dimension table), `signals` (+ per-signal breakdown), `diagnostics` (+ raw diagnostics array). Each level includes everything below it. Applies uniformly to all formats (pretty, json, markdown, html). |
| `--verbose` / `-v` | off | Increase stderr logging verbosity. Shows engine progress, validator invocation details, timing breakdowns, and internal debug info. Does not affect the report payload (stdout) — use `--detail` for that. Orthogonal to `--quiet` (which suppresses the spinner). |
| `--quiet` / `-q` | off | Suppress stderr spinner. Engine warnings still pass through stderr (they're a small, bounded signal). Pretty/JSON stdout unchanged. The spinner ALSO auto-suppresses when stderr is not a TTY (CI logs, redirected stderr) — `--quiet` is the explicit override for interactive shells. |
| `--output` / `-o` `<file>` | stdout | Write report output to `<file>` instead of stdout. Useful for CI artifacts, Windows scripts, and future HTML/Markdown outputs where shell redirection is awkward. When set, spinner still goes to stderr. |
| `--with-llm` | off | Enable LLM-backed analysis in the engine (`jentic-apitools score --enable-llm-analysis`). Requires at least one supported provider env var set in the CLI's environment (e.g. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, or `AWS_*`); CLI errors if none are present. CLI forwards every provider env var that IS set to the container via `-e <NAME>` (passthrough form). |
| `--bundle` | off | Force CLI-side bundling. For URL inputs, the CLI fetches the URL on the host and Redocly-bundles it before piping bundled JSON to the container via stdin — use this for URLs only the host can reach (internal networks, VPN-gated specs, auth-required URLs). Implies key-required, since the anonymous allowlist does not apply once the source URL stops reaching the container. For local paths the flag is a no-op: bundling is always how local files are handled. Safe to leave on in scripts where `$INPUT` could be either type. **Note**: `--bundle` follows HTTP redirects from any URL the user types — this is the user's host doing the fetching, so this is not SSRF-relevant in the usual sense, but typing arbitrary URLs into a tool that fetches them is the user's responsibility. |

### Input dispatch

The CLI inspects `<input>` and chooses one of three paths:

- **Local mode** (path that exists). CLI bundles the spec with `@redocly/openapi-core` — resolving local `$ref`s and copying remote `$ref` content into a single self-contained JSON document — and writes that JSON string to the container's stdin via `docker run -i`. Inside the container, the runner reads stdin to a temp file and hands the path to `jentic-apitools score`. Local mode requires `JENTIC_API_KEY`.
- **URL mode** (`http://` / `https://`, default for URLs). CLI does not fetch and does not bundle. It passes `--url <url>` to the container, which enforces the anonymous gate on the URL string and then invokes `jentic-apitools score <url>` directly — the engine handles fetching and `$ref` resolution. URL mode is anonymous-allowed for jentic-public-apis URLs, key-required for everything else.
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
export JENTIC_API_KEY=mvp-preview
npx @jentic/api-scorecard-cli score ./openapi.yaml
```

No `login` subcommand, no credentials file, no token persistence in MVP — those are post-MVP UX additions on top of an env-var foundation that already works.

#### MVP key scheme (transitional)

Real key issuance and server-side validation are deferred to a follow-up delivery. For Delivery 1, the container compares `JENTIC_API_KEY` against a single documented public placeholder value, hard-coded in the image:

- **Accepted**: `JENTIC_API_KEY=mvp-preview` → key-required paths work (local files, non-allowlisted URLs).
- **Rejected** (any other non-empty value): container exits with a clear error: *"this key is not recognized. During the MVP preview, use `JENTIC_API_KEY=mvp-preview`. Real keys land in a follow-up release."*
- **Unset**: anonymous mode, as above.

This is **not a secret**. The image is public; the value is trivially extractable from any image layer. Its purpose is purely to:

1. Exercise the full auth plumbing now (CLI env resolution → `-e` forwarding → container check → branching), so swapping in a real validator is a one-function change.
2. Give us a clean migration marker — when real auth ships, the placeholder check becomes a deprecation message pointing users to signup.
3. Provide better error UX than "any non-empty value passes" (typos and stale envs surface as recognizable errors instead of false success).

When real auth ships, the only changes inside the container are: replace the static comparison with `httpx.get("https://api.jentic.com/v1/validate", headers={"Authorization": f"Bearer {key}"})`, and rev the image. The CLI does not change.

### LLM provider keys (only when `--with-llm` is set)

When `score` is invoked with `--with-llm`, the CLI scans its own environment for known provider keys and forwards each that is present to the container using docker's passthrough form (`-e NAME` with no value, which copies the value from the CLI's environment at run time):

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_REGION` (Bedrock — `AWS_SESSION_TOKEN` is required when using temporary credentials, e.g. from `aws sts assume-role` or AWS SSO)

If `--with-llm` is set but none of these are present, the CLI exits with a clear error before invoking docker. Without `--with-llm`, the CLI never forwards LLM keys, even if they are set on the host. The container treats `--enable-llm-analysis` as off unless the CLI explicitly turns it on (see §6).

**Note on key visibility**: provider keys passed via `-e <NAME>` show up in `docker inspect <container-id>` for the duration of the run. This is standard Docker behavior on every host that uses Docker — it's not a CLI-introduced exposure. Anyone with access to the user's Docker daemon already had that level of access. We do NOT log keys in spinner output, error messages, or telemetry.

### Output specification

Three orthogonal concepts control output:

| Concept | Flag | Controls |
|---|---|---|
| **Format** | `--format <fmt>` / `-f` | How output is encoded: `pretty`, `json`, `markdown`. |
| **Detail level** | `--detail <level>` / `-d` | How much of the scoring result is included in the payload (stdout). |
| **Verbosity** | `--verbose` / `-v` | How much internal logging goes to stderr. |

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

**`-o FILE`** — when set, report output is written to `<file>` instead of stdout. Spinner and engine warnings remain on stderr. Equivalent to shell redirection but portable to Windows and explicit in CI scripts.

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
| 2 | Auth required: key missing for an input that needs one. Message includes signup link. |
| 3 | Anonymous gate rejected: URL not in jentic-public-apis allowlist. Message includes allowlist index URL. |
| 4 | Docker not installed or daemon unreachable. Message includes install hint. |

### Error UX examples

```
$ npx @jentic/api-scorecard-cli score ./local.yaml         # no key
error: scoring local files requires a Jentic API key.
  Get one at https://jentic.com/signup, then:
    export JENTIC_API_KEY=...
exit 2

$ npx @jentic/api-scorecard-cli score https://example.com/openapi.yaml   # no key
error: anonymous scoring is restricted to specs hosted at:
  https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/
  Browse available specs:
    https://github.com/jentic/jentic-public-apis/tree/main/apis/openapi
  Or sign up: https://jentic.com/signup
exit 3

$ npx @jentic/api-scorecard-cli score ./openapi.yaml      # docker not in PATH
error: 'docker' command not found.
  Install Docker: https://docs.docker.com/get-docker/
exit 4
```

## 6. Docker image specification

### Base + tooling

- Base: `python:3.12-slim`.
- Adds Node.js 24 LTS. Required by `jentic-apitools-cli`, which spawns Redocly / Spectral / Speclynx via `npx`. The engine documents Node ≥18 as the minimum; we ship the latest LTS so users get current security patches and modern V8 startup.
- Build via `uv` (single-stage build is fine for MVP; can be split later).
- Engine: [`jentic-apitools-cli`](https://pypi.org/project/jentic-apitools-cli/) installed from PyPI. Its `jentic-apitools score` command is the scoring engine.
- Image entry point: `python -m jentic_scorecard_runner` — a thin wrapper that parses args, enforces the anonymous gate, and shells out to `jentic-apitools score`. It does not fetch URLs itself.

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
               └─ runner: auth check, gate, stdin→tempfile, then spawn:
container N: jentic-apitools score /tmp/spec.json --format json --include-diagnostics --quiet
               └─ engine: spawn validators via npx, score, emit JSON
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
RUN pip install --no-cache-dir jentic-apitools-cli==<pinned-version>
COPY .build/sample.yaml /tmp/sample.yaml
RUN jentic-apitools score /tmp/sample.yaml --format json --quiet >/dev/null
```

The score against a representative sample spec exercises every validator the engine will invoke at runtime, populating `/var/cache/npm` with extracted tarballs (`_npx/<hash>/`) and downloaded transitive deps (`_cacache/`). The cache lives in an image layer; every `--rm` container inherits it via the image's read-only layers. No network at runtime.

Bonus: this doubles as a smoke test — if the engine is broken or the image is missing a system dep, `docker build` fails rather than every user's first score failing.

Confirmed by direct test (2026-05-21, `jentic-apitools-cli==1.0.0a16`): `jentic-apitools score <url>` runs successfully without `JENTIC_API_KEY` set. The build-time score therefore does not require a key, and the engine never phones Jentic during scoring — both invariants we rely on for an offline-capable image.

**Per-`npx`-call overhead remains** (~500 ms–1 s for Node boot + npm CLI load + cache lookup, even on cache hits). For three validators that's ~1.5–3 s per score, which is acceptable on top of the actual analysis time.

**Future optimization (not MVP):** some validators expose a `*_PATH` override (Speclynx accepts `speclynx_path` in its constructor) that bypasses `npx` and runs the binary directly. If perf becomes a complaint, extract bundled tarballs into a fixed image path and set the corresponding env vars. Drops per-validator overhead to just Node startup (~100 ms). Deferred until needed.

The **invariant** ("no installs at runtime") is architectural: any deviation re-introduces per-score npmjs latency and offline-use breakage, and should be treated as a Dockerfile bug.

### I/O sizing: stdin in, tempfile out

Two large-data boundaries cross the wrapper. Both go through tempfiles, neither buffers a whole spec or result in Python memory.

**Stdin → tempfile (input side).** For local and bundled-URL modes, the wrapper reads `sys.stdin.buffer` in chunks and writes to a tempfile, then passes the path to the engine. `sys.stdin` has no hard size limit — it's a stream, kernel pipe buffers are just an in-flight window — but reading the whole spec into memory before persisting it is wasteful. Chunked read keeps RSS flat regardless of bundled-spec size.

**Engine stdout → tempfile (output side).** The wrapper invokes `jentic-apitools score <spec> --format json --include-diagnostics --quiet` with `stdout=<tempfile>` rather than `stdout=PIPE`. Two reasons:

1. **Pipe-full deadlock.** If the engine's combined stdout+stderr exceeds the kernel pipe buffer (~64 KB) faster than our reader drains, writes block and the process hangs. `subprocess.run` does drain, but only by buffering the entire stream in Python RSS. Redirecting to a file shifts buffering to the kernel + filesystem, which is unbounded.
2. **Memory.** A JAIRF result tree on a large spec with `--with-llm` and full diagnostics can be several MB. There's no reason to hold it in Python RAM when we're about to copy it to the container's stdout anyway.

The wrapper then streams the tempfile to its own stdout (the container's stdout, which the host CLI captures). Stderr stays on PIPE — it's only warnings, bounded in size, useful for inline forwarding.

This pattern is borrowed from `jentic.apitools.openapi.common.subproc` upstream: `stdout=<file>` is the supported escape hatch for large-output children.

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
| LLM provider env vars | When `--with-llm` is set: `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `AWS_*`. Forwarded by the host CLI; container reads whichever are present and lets the engine pick a provider. |

### Behavior

```
1. Parse args. Exactly one of {--url, stdin} must be present. If --url is
   absent AND stdin is a TTY (no piped input), exit non-zero with a clear
   error rather than blocking on stdin EOF forever.
2. Auth check on JENTIC_API_KEY:
     - empty:        anonymous mode (proceed to step 3 anonymous-gate).
     - "mvp-preview": authenticated; skip step 3.
     - any other:     exit non-zero with placeholder-key error message.
3. Anonymous gate (only when anonymous):
     - URL mode: URL must match
       ^https://raw\.githubusercontent\.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/
       Else exit non-zero with a clear message.
     - stdin mode: always reject; key is required.
4. Prepare engine input:
     - URL mode:  forward the URL string straight to the engine command line;
                  no fetch, no tempfile. The runner has already gated on the
                  URL, so the engine receives an authorized source.
     - stdin:     read sys.stdin.buffer in chunks to a tempfile, then pass
                  the path to the engine.
5. Score: spawn `jentic-apitools score <url-or-path> --format json --include-diagnostics --quiet` (appending `--enable-llm-analysis` when our `--with-llm` is set) and capture its JSON output. `--format json`, `--include-diagnostics`, and `--quiet` are always passed: the container produces one canonical JSON payload regardless of host-side flags, with no log noise on stdout. Filtering for terminal output is the host CLI's job.
6. Emit result JSON to stdout (engine output is forwarded verbatim).
```

### Exit codes (container)

| Code | Meaning |
|---|---|
| 0 | Result emitted on stdout. |
| 1 | Generic error (including: invocation with no `--url` and no piped stdin). |
| 2 | Auth: key set but not the recognized placeholder value. |
| 3 | Anonymous gate rejected. |
| 5 | Spec fetch / parse failure. |
| 6 | Engine invocation failure. |

CLI translates these to its own exit codes plus user-friendly messages.

## 7. Result JSON schema

The CLI does not invent a schema. It emits **whatever `jentic-apitools score --format json` emits, verbatim**, filtered by `--detail` level (see §5). The container always requests full output (`--include-diagnostics`) from the engine; the CLI strips fields the user didn't ask for based on `--detail`. Reformatting in the formatter (pretty output, Markdown) is a read-only projection — keys are not renamed, restructured, or filtered. The pretty/HTML/Markdown formatters tolerate unknown keys and absent optional keys, so engine bumps that add new fields don't break formatting.

The shape below was captured by running `jentic-apitools score https://petstore3.swagger.io/api/v3/openapi.json` against `jentic-apitools-cli==1.0.0a16`. Treat this as a sample, not a contract — the engine owns the schema.

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

**Coupling**: CLI npm version = GHCR image tag. The Python engine package (`jentic-apitools-cli`) versions independently upstream; each image build pins one specific engine version.

**Channels**: today the project ships only an **alpha channel**. The first stable release (`@latest` npm dist-tag) is deferred until the flag surface settles and real auth replaces `mvp-preview` (§9). Until then, `@jentic/api-scorecard-cli@alpha` is the discovery entry point:

- The first cut is `1.0.0-alpha.0`; subsequent cuts increment the prerelease counter (`1.0.0-alpha.1`, `1.0.0-alpha.2`, …).
- npm `@jentic/api-scorecard-cli@1.0.0-alpha.<N>` publishes under the `alpha` dist-tag. `@jentic/api-scorecard-formatter-html` is `"private": true` and does not publish on alpha cuts; it joins the channel once its real implementation ships.
- `ghcr.io/jentic/jentic-api-scorecard:1.0.0-alpha.<N>` — the exact alpha tag the CLI of that version consumes. No floating `:alpha` is published; the CLI never asks for one.
- `docker/pyproject.toml` (used at image build time) pins `jentic-apitools-cli==<exact-version>` (e.g. `1.0.0a16`).

The CLI hard-codes the image tag matching its own npm version. Users who want to reproduce yesterday's score install yesterday's CLI version (`npx @jentic/api-scorecard-cli@1.0.0-alpha.3`) — that pulls `:1.0.0-alpha.3`, which has the engine version pinned exactly. **Reproducibility = pin one CLI version**; the engine version it transitively carries is recorded in `metadata.engine.version` of the result JSON (the engine emits this directly).

When the engine releases an update we want to ship, we:
1. Bump `jentic-apitools-cli` in `docker/pyproject.toml`.
2. Cut a new CLI version (e.g. `1.0.0-alpha.<N+1>`).
3. CI builds and pushes `ghcr.io/jentic/jentic-api-scorecard:1.0.0-alpha.<N+1>` containing the new engine, and publishes `@jentic/api-scorecard-cli@1.0.0-alpha.<N+1>` under the `alpha` dist-tag.

**Continuous delivery** (CI): every push to `main` triggers `docker-publish.yml`, which gates on `ci.yml` (lint + test) and then builds and pushes `ghcr.io/jentic/jentic-api-scorecard:unstable` (multi-arch: linux/amd64 + linux/arm64). Merging to `main` does **not** publish a CLI version or an alpha tag — it makes the change available to the next alpha cut.

**Release pipeline** (CI): pushing a git tag `v1.0.0-alpha.<N>` triggers an image build + push to GHCR with the exact `:1.0.0-alpha.<N>` tag (no floating `:alpha`/`:latest`) and an `npm publish --tag alpha --provenance` for `packages/cli`. `packages/formatter-html` is skipped automatically while it remains `"private": true`. The stable pipeline (`@latest` dist-tag, `:latest` not used) lands when the project cuts its first stable release.

**Supply chain attestations**: the alpha release also emits an SPDX 2.3 SBOM for `@jentic/api-scorecard-cli` and attaches it to the locally-packed tarball as a Sigstore-signed in-toto attestation via `actions/attest@v4`. The tarball that gets attested is built in the same workflow with `npm pack -w @jentic/api-scorecard-cli` (same bytes lerna just published — no registry round-trip and no CDN-propagation race). The SBOM is generated from the CLI's `dependencies` resolved by `npm install --omit=dev` in an isolated staging directory (the CLI's `package.json` only — no monorepo root, no workspace hoisting), so it mirrors the runtime closure of the published tarball and excludes dev tooling. Consumers verify provenance with `gh attestation verify <tarball> --owner jentic` and the SBOM with the same command plus `--predicate-type https://spdx.dev/Document/v2.3` (gh defaults to the SLSA predicate, so the SBOM must be requested explicitly).

**Breaking changes**: the CLI does not introduce its own schema version. The result JSON is the engine's verbatim output, and the engine versions its scorecard format independently via `metadata.version` (e.g. `"1.0.27"`). Consumers tracking schema changes should key off `metadata.version` from the engine, not anything CLI-introduced. If we need to break the result shape on our side (we shouldn't — see §7), we'd announce it via the CLI's release notes, not via an envelope key we don't actually emit.

## 9. Foundation: registration & key

For Delivery 1, the auth pipeline is wired end-to-end but the validator is a placeholder:

- **Key value**: `JENTIC_API_KEY=mvp-preview`, documented in the README and CLI error messages. Not a secret — the image is public, the value is public.
- **Container check**: hard-coded equality against the placeholder. Mismatched values are rejected with a guidance message; unset means anonymous.
- **No backend calls**: nothing in the system phones Jentic. No signup, no validation, no usage accounting, no rate limiting beyond the static URL allowlist.

A follow-up delivery introduces real signup at `jentic.com/signup`, real `JENTIC_API_KEY` issuance, and replaces the static container check with an HTTP call to a Jentic validation endpoint. That swap is one function and a Dockerfile dep change; the CLI does not change.

## 10. Out of scope (Delivery 1)

- HTML formatter wired into the CLI. The `@jentic/api-scorecard-formatter-html` package is scaffolded with a typed `format(result): string` stub so the monorepo shape and contract are in place; the implementation lands post-MVP.
- User-facing image flags. The CLI fully abstracts image management: it always pulls the image tag matching its own version, with no user override.
- Server-side calls to Jentic from the container or CLI: usage tracking, key validation, and rate limiting (beyond the static URL allowlist) all defer to a follow-up delivery.
- Subcommands beyond `score` (e.g. `login`, `logout`, `whoami`, `config`, `lint`) and any persistent credentials file. Auth is env-var only.
- Multi-spec / portfolio scoring.
- Plugins or custom rubrics.
- Schema validation of the result JSON in the CLI (consumed permissively).
- `--min-score N` threshold for CI pass/fail. Deferred to phase 5 (CI integration). When added, `score` exits non-zero if the final score is below N — no architectural change needed, just an additional exit code and a comparison.
- CPU / concurrency control. The container inherits the host scheduler's defaults (uncapped on Linux; bounded by Docker Desktop's VM allocation on Mac/Windows); the engine decides its own internal parallelism. A `--cpus` flag and matching engine worker-pool hint are deferred until we have a concrete user pain (shared CI starvation, predictable scoring time, etc.) to design against.

## 11. Verification (post-implementation)

When the implementation lands, these acceptance checks validate the architecture end-to-end:

**Anonymous / gate path:**
- `npx @jentic/api-scorecard-cli score <jentic-public-apis-url>` (no key) → success, scorecard printed.
- `npx @jentic/api-scorecard-cli score https://example.com/openapi.yaml` (no key) → exit 3 with allowlist-index hint.
- `npx @jentic/api-scorecard-cli score ./local.yaml` (no key) → exit 2 with signup hint.

**MVP key scheme:**
- `JENTIC_API_KEY=garbage npx @jentic/api-scorecard-cli score ./local.yaml` → exit 2 with placeholder-key error message.
- `JENTIC_API_KEY=mvp-preview npx @jentic/api-scorecard-cli score ./local.yaml` → success; spinner shows `Bundling ./local.yaml…`.

**Output formats and detail levels:**
- `npx @jentic/api-scorecard-cli score <input> --format json | jq .summary.score` → numeric, no chrome on stdout.
- `npx @jentic/api-scorecard-cli score <input> --json | jq .summary.score` → same (alias works).
- `npx @jentic/api-scorecard-cli score <input> --detail signals` → output includes all ~35 signals grouped by dimension.
- `npx @jentic/api-scorecard-cli score <input> --detail diagnostics` → output includes diagnostics grouped by source (`redocly-validator`, `spectral-validator`, `speclynx-validator`) and severity.
- `npx @jentic/api-scorecard-cli score <input> --detail summary` → only headline (score + grade + level), no dimension table.
- `npx @jentic/api-scorecard-cli score <input> --format json --detail signals` → JSON includes `details[].dimensions[].signals[]`.
- `npx @jentic/api-scorecard-cli score <input> --format json --detail diagnostics` → JSON includes `diagnostics` array.
- `npx @jentic/api-scorecard-cli score <input> --format json -o report.json` → writes to file, no stdout.
- `npx @jentic/api-scorecard-cli score <input> --verbose` → extra stderr logging (engine progress, timing), report payload unchanged.

**Bundle / LLM:**
- `JENTIC_API_KEY=mvp-preview npx @jentic/api-scorecard-cli score https://internal.example/openapi.yaml --bundle` → CLI fetches host-side, bundles, pipes to container; success.
- `npx @jentic/api-scorecard-cli score <input> --with-llm` with no provider env vars set → exit 1 (or chosen code) with a clear error BEFORE any docker invocation.

**Container lifecycle:**
- `docker rmi ghcr.io/jentic/jentic-api-scorecard:<v> && npx @jentic/api-scorecard-cli score …` → spinner shows `Pulling…`, succeeds.
- `docker run -i --rm ghcr.io/jentic/jentic-api-scorecard:<v> score` (no `--url`, no piped stdin, attached to a TTY) → exits non-zero with a "no input" error, does NOT block on stdin.

**Environment:**
- `PATH= npx @jentic/api-scorecard-cli score …` → exit 4 with install hint.
- Container has no network beyond its required spec fetches (URL mode for the input + engine reaching crates.io / npmjs / etc. only at build time, not at run time).
