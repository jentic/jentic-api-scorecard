# Jentic API Scorecard

![Jentic API Scorecard preview](https://github.com/jentic/jentic-api-scorecard/raw/main/assets/scorecard-preview.jpg)

An OpenAPI document that passes validation isn't necessarily one an AI agent can use. Grammar is
one thing; semantic clarity, safety, and discoverability are another. The **Jentic API Scorecard**
scores your OpenAPI document against the
[Jentic API AI Readiness Framework (JAIRF)](https://github.com/jentic/api-ai-readiness-framework)
across six dimensions and returns a single grade — so you know exactly where to improve.

## Quick start

1. Get a free key at the [Jentic Scorecard API Keys page](https://app.jentic.com/scorecard?tab=api-keys).

2. Score an OpenAPI document:

   ```bash
   JENTIC_API_KEY=<your-key> npx @jentic/api-scorecard-cli score ./openapi.yaml
   ```

## What it scores

Each OpenAPI document is evaluated across six lenses — small, targeted improvements in any of them
tend to produce outsized gains for both human developers and AI agents:

- **Foundational Compliance (FC)** — structural validity and conformance to OpenAPI itself.
- **Developer Experience & Jentic Compatibility (DXJ)** — documentation quality and how well the
  OpenAPI document plays with downstream tooling.
- **AI-Readiness & Agent Experience (ARAX)** — semantic clarity and the context an LLM needs to
  reason about each operation.
- **Agent Usability (AU)** — predictable, safe multi-step orchestration.
- **Security (SEC)** — declared auth schemes and trust boundaries.
- **AI Discoverability (AID)** — how easily an AI system can find and parse the OpenAPI document.

## How it works

Scoring runs locally inside a Docker container in two phases. **Analysis** runs a battery of
validators and structural checks against the OpenAPI document to produce a set of diagnostics and
observations.
**Scoring** maps those into ~35 signals across the six JAIRF dimensions, aggregates them into
per-dimension scores, and rolls those up into a single weighted score and grade.

## Requirements

- **Node.js** 20 LTS or newer (`>= 20.19.0`) with npm/npx. See [Node.js downloads](https://nodejs.org/).
- **Docker** installed and running. See [Docker installation](https://docs.docker.com/get-docker/).
  The CLI pulls the scoring image automatically on first run.
- Network access to [`ghcr.io`](https://ghcr.io) (to pull the image) and to whatever URL hosts the
  OpenAPI document you're scoring (the engine fetches it from inside the container).

## Install

```bash
npm install -g @jentic/api-scorecard-cli
```

This installs the CLI globally. The scoring engine (Docker image) is downloaded automatically
the first time you run `score` — allow a minute or two on a typical connection.

For local files or non-OAK URLs you'll also need a `JENTIC_API_KEY` — see
[Anonymous vs keyed access](#anonymous-vs-keyed-access).

Verify the install:

```bash
jentic-api-scorecard --version
```

> **Prefer zero-install?** You can skip the global install and use `npx` — every example in
> this README works with `npx @jentic/api-scorecard-cli` in place of `jentic-api-scorecard`.
> Pin to a specific release with `npx @jentic/api-scorecard-cli@<version>` (e.g. `@1.0.0`);
> the unpinned form resolves to whatever the `latest` dist-tag points at on each invocation,
> while `npm install -g` pins you to the installed version until you explicitly update.

## Try it now

OpenAPI documents from [Jentic Public APIs (OAK)](https://github.com/jentic/jentic-public-apis)
score without any key, uncapped — no signup, no config:

```bash
npx @jentic/api-scorecard-cli@latest score \
  https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/swagger-api/petstore/1.0.27/openapi.json
```

For URLs outside OAK or local files, set the API key:

```bash
JENTIC_API_KEY=<your-key> npx @jentic/api-scorecard-cli@latest score \
  https://petstore3.swagger.io/api/v3/openapi.json
```

```bash
JENTIC_API_KEY=<your-key> npx @jentic/api-scorecard-cli@latest score ./openapi.yaml
```

> [!IMPORTANT]
> Free keys come with **100 scorings per month** (resets at the start of each calendar month). See [Anonymous vs keyed access](#anonymous-vs-keyed-access) for signup and quota details.

That's it. The CLI pulls the scoring engine automatically on first run.

![CLI score output](https://github.com/jentic/jentic-api-scorecard/raw/main/assets/cli-screenshot.png)



## Control output depth

The `--detail` flag lets you zoom in:

```bash
# Just the headline score and grade
npx @jentic/api-scorecard-cli@latest score --detail summary ./openapi.yaml

# Per-dimension breakdown (default)
npx @jentic/api-scorecard-cli@latest score --detail dimensions ./openapi.yaml

# Individual signals within each dimension
npx @jentic/api-scorecard-cli@latest score --detail signals ./openapi.yaml

# Full diagnostics with top 5 findings per severity
npx @jentic/api-scorecard-cli@latest score --detail diagnostics ./openapi.yaml
```

## Machine-readable output

Add `--format json` to emit engine-verbatim JSON on stdout (filtered by whatever
`--detail` level you pick). Pretty stays the unconditional default; `--format json`
is the canonical way to get a stable machine-readable channel for CI gating, archival,
or LLM-assisted review.

```bash
# Gate on the headline score in CI
npx @jentic/api-scorecard-cli@latest score ./openapi.yaml --format json | jq .summary.score

# Capture the full evidence bundle to a file
npx @jentic/api-scorecard-cli@latest score ./openapi.yaml \
  --format json --detail diagnostics --output report.json
```

`--output <file>` (`-o`) writes the report to a path instead of stdout; the spinner stays on stderr.

`--quiet` (`-q`) suppresses the stderr spinner even in interactive terminals (the spinner already
auto-suppresses when stderr isn't a TTY). Engine warnings still pass through stderr.

## HTML report

Add `--format html` to render an interactive, self-contained HTML scorecard — a single file
with all JS and CSS inlined (no external CDN, works offline), suitable for CI artifacts and
dashboards. It honours `--detail`, so `--detail diagnostics` embeds the full evidence bundle.

![HTML scorecard report](https://github.com/jentic/jentic-api-scorecard/raw/main/assets/cli-html-report.png)

Because the output is a full HTML document, the CLI refuses to print it straight into an
interactive terminal — redirect it or use `-o`:

```bash
# Redirect to a file
npx @jentic/api-scorecard-cli@latest score ./openapi.yaml --format html > scorecard.html

# Or write it with -o, at full detail
npx @jentic/api-scorecard-cli@latest score ./openapi.yaml \
  --format html --detail diagnostics -o scorecard.html
```

## LLM analysis

Add `--with-llm` to unlock LLM-backed signals — deeper semantic reasoning about whether your API
descriptions are actionable for agents, whether error responses support autonomous recovery, and
more. Requires an LLM provider: cloud (OpenAI / Anthropic / Gemini / AWS Bedrock) or a local
OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, …).

Without `--with-llm`, the LLM-backed signals are not evaluated — they hold an assumed-perfect
baseline score until `--with-llm` actually assesses them. A default (no-`--with-llm`) scorecard
therefore reflects only the deterministic signals, with the LLM-backed ones sitting at that perfect
baseline; turn on `--with-llm` to have them genuinely assessed (which can lower your score).

```bash
export OPENAI_API_KEY=sk-...
export LLM_PROVIDER=OPENAI
export LIGHT_LLM_PROVIDER=OPENAI
export LLM_LIGHT_MODEL=gpt-4o-mini

JENTIC_API_KEY=<your-key> npx @jentic/api-scorecard-cli@latest score ./openapi.yaml --with-llm
```

Token cost is low — the engine uses a lightweight model (e.g. Claude Haiku, GPT-4o-mini),
processes operations in small batches, and caps at 7 batches regardless of spec size. Local
models (Ollama) cost nothing per call.

If the LLM calls fail (bad credentials, an inaccessible model, an unreachable endpoint), the
affected LLM-backed signals get scored as perfect — which would inflate their dimension(s) and the
overall score. Rather than print a misleading scorecard, the CLI **suppresses the report, names the
affected signals and the provider error on stderr, and exits `8`** — so a CI job running
`--with-llm` fails loudly instead of passing on an inflated score. Fix the provider error and
retry, or re-run without `--with-llm` for a valid score from the non-LLM signals.

See **[LLM Signals guide](https://github.com/jentic/jentic-api-scorecard/blob/main/docs/llm-signals.md)**
for all provider recipes (including local Ollama), the full environment variable reference, and
troubleshooting.

## Anonymous vs keyed access

OpenAPI documents from [Jentic Public APIs (OAK)](https://github.com/jentic/jentic-public-apis)
score without any key and stay on the free tier — those URLs bypass key validation entirely.
For everything else (local files, URLs outside OAK), get a key from the [Jentic Scorecard API Keys page](https://app.jentic.com/scorecard?tab=api-keys). Then set it:

```bash
export JENTIC_API_KEY=<your-key>
```

Real keys are validated live by the container against `api.jentic.com`. The same call doubles
as the per-key usage / rate-limit accounting hit. **Each free key gets 100 scorings per month**,
resetting at the start of each calendar month. Once that quota is exhausted the CLI exits with
code `7` and prints the `Retry-After` value along with a link to upgrade your plan.

## Agent Skills

This repository ships a versioned [agent skill](skills/jentic-api-scorecard/SKILL.md)
that teaches AI coding agents how to use the CLI correctly — installing it, scoring
files and URLs, producing JSON/HTML, wiring it into CI, enabling LLM analysis, and
interpreting exit codes. Install it straight from this repository with the
[`skills` CLI](https://github.com/vercel-labs/skills):

```bash
npx skills add jentic/jentic-api-scorecard --skill jentic-api-scorecard
```

The `@jentic/api-scorecard-cli` npm package also ships this skill inside its published
tarball, so it's discoverable by [TanStack Intent](https://tanstack.com/intent) for
projects that already depend on the CLI and want version-aligned agent guidance.

## CLI reference

```
jentic-api-scorecard [-V | --version] [-h | --help]
jentic-api-scorecard <command> [options]
```

### Commands

| Command | Description |
|---|---|
| [`score <input>`](#score) | Score an OpenAPI document by URL or local file path. |

### `score`

Score an OpenAPI document by URL or local file path.

```
jentic-api-scorecard score <input> [options]
```

#### Arguments

| Name | Description |
|---|---|
| `<input>` | `https://` URL or local file path to an OpenAPI document. Required. |

#### Options

| Flag | Default | Choices | Description |
|---|---|---|---|
| `--with-llm` | off | — | Enable LLM-backed analysis. Requires an LLM provider (see [LLM analysis](#llm-analysis)). |
| `--bundle` | off | — | Force CLI-side bundling for URL inputs: the CLI fetches the URL on the host, bundles with Redocly, and pipes to the container via stdin. Use for URLs only the host can reach (internal networks, VPN-gated specs, auth-required URLs). Requires `JENTIC_API_KEY`. No-op for local files. |
| `-d, --detail <level>` | `dimensions` | `summary`, `dimensions`, `signals`, `diagnostics` | Payload depth (see [Control output depth](#control-output-depth)). |
| `-f, --format <fmt>` | `pretty` | `pretty`, `json`, `html` | Output encoding (see [Machine-readable output](#machine-readable-output) and [HTML report](#html-report)). |
| `-o, --output <file>` | stdout | — | Write the formatted report to `<file>`. The spinner stays on stderr. |
| `-q, --quiet` | off | — | Suppress the stderr spinner regardless of TTY. |
| `-h, --help` | — | — | Show usage for `score`. |

#### Environment

| Variable | When | Purpose |
|---|---|---|
| `JENTIC_API_KEY` | URLs outside OAK and local files | Real key issued at the [Jentic Scorecard API Keys page](https://app.jentic.com/scorecard?tab=api-keys); validated live against `api.jentic.com` (see [Anonymous vs keyed access](#anonymous-vs-keyed-access)). **Free quota: 100 scorings per calendar month.** |
| LLM provider + routing vars | With `--with-llm` | The CLI auto-detects credentials (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, AWS keys) and routing (`LLM_PROVIDER`, `LIGHT_LLM_PROVIDER`, `LLM_MODEL`, `LLM_LIGHT_MODEL`, `*_API_URL`, `LLM_MAX_TOKENS`) and forwards them to the container; loopback URLs are rewritten so a host-side Ollama is reachable. Full reference: [LLM Signals guide](https://github.com/jentic/jentic-api-scorecard/blob/main/docs/llm-signals.md). |

#### Exit codes

| Code | Meaning |
|---|---|
| 0 | Scoring completed (regardless of the score itself). |
| 1 | Generic error (bad input, unexpected container failure, output write failure). |
| 2 | Auth: `JENTIC_API_KEY` is set to a value the Jentic backend does not recognize, or a local file / stdin input was used without the key set. |
| 3 | Anonymous gate rejected: URL outside the OAK allowlist and no key set. |
| 4 | Docker not installed or daemon unreachable. |
| 5 | Spec fetch, parse, or host-side bundling failure (local files and `--bundle` URLs). |
| 6 | Engine invocation failure. |
| 7 | Rate limit reached: the key is valid but the user is over quota. Message includes the server-provided `detail` and the `Retry-After` header when present. |
| 8 | LLM analysis failed under `--with-llm`: the provider call failed, so the LLM-derived signals would be scored as perfect and inflate the result. The CLI suppresses the report and prints the affected signals + provider error on stderr. Re-run without `--with-llm` for a valid non-LLM score. |

## Prefer a browser?

[**jentic.com/scorecard**](https://jentic.com/scorecard) offers the same scoring in a web UI —
paste a URL or drop a file, no Docker or Node required.

## Enterprise-ready by default

For teams that need to know exactly what's running, verify exactly what was
shipped, and run without a runtime dependency on Jentic.

### Your OpenAPI document never leaves your environment

Scoring runs entirely in a container **on your own machine**. Local files are
piped in over stdin; URLs are fetched on your side — by the container's engine,
or host-side by the CLI when you pass `--bundle` — never by Jentic. Either way,
your spec is never uploaded.

The **only** call to Jentic is a key-check round-trip against `api.jentic.com` —
it carries your key, never any part of your spec, and OAK URLs (jentic-public-apis)
skip even that. The one exception is `--with-llm`, which sends spec context to the
LLM provider **you** choose (point it at a local Ollama to keep that on-machine too).

### Auditable end to end

Every component in the scoring stack — runner, CLI, release pipeline, and
engine — is Apache 2.0 licensed and source-readable. No proprietary blobs,
no closed-source shims. Read the code that's about to grade your specs
before you adopt it; audit any line, redistribute under the license terms,
fork if you ever need to.

### Signed for regulated environments

Every npm tarball and every GHCR image is signed by [Sigstore](https://www.sigstore.dev/)
with SLSA provenance and an SPDX SBOM. Signing happens inside an OIDC-driven
GitHub Actions workflow with no long-lived publishing secrets — there is no
`NPM_TOKEN`, no PAT, and no human keyholder in the release chain. One command
verifies an artifact end-to-end before you install it:

- **[npm package supply chain →](https://github.com/jentic/jentic-api-scorecard/blob/main/docs/supply-chain-npm.md)** —
  npm provenance, SPDX SBOM, trusted publishing, and the `gh attestation verify` recipes.
- **[Docker image supply chain →](https://github.com/jentic/jentic-api-scorecard/blob/main/docs/supply-chain-docker.md)** —
  per-platform SBOMs, dual-store attestations (BuildKit OCI referrers + Sigstore), and
  verification via either `docker buildx imagetools inspect` or `gh attestation verify`.

### Runs anywhere

The image is a closed system at scoring time: every Python wheel, Node.js
binary, and validator tarball it needs is baked in at build time, so scoring
pulls no runtime packages from PyPI or npmjs. Multi-arch images (linux/amd64 +
linux/arm64) ship from the same release, so the same guarantees hold on Apple
Silicon dev machines, ARM CI runners, and x86 servers alike.

### Pinned for reproducibility

CLI version, image tag, and engine version are locked one-to-one. Pinning
`@jentic/api-scorecard-cli@<version>` resolves to a specific image tag, which
in turn pins an exact engine release and exact validator versions. Last
month's score is reproducible from last month's pin.

## Status

The CLI ships **stable** under the `latest` npm dist-tag — release cadence is driven by
[Conventional Commits](https://www.conventionalcommits.org/). Track in-flight work in
[`specs/roadmap.md`](https://github.com/jentic/jentic-api-scorecard/blob/main/specs/roadmap.md).

The `:unstable` Docker image is rebuilt on every push to `main` for direct `docker run` users.
Versioned images are published alongside each CLI release.

### Scoring engine signal status

To see which Jentic API AI Readiness Framework signals are active in the current release, check out the
[scoring engine implementation status](https://docs.jentic.com/reference/api-readiness-framework/scoring-engine-status/).

## License

Jentic API Scorecard is licensed under the
[Apache 2.0](https://github.com/jentic/jentic-api-scorecard/blob/main/LICENSE) license.
Jentic API Scorecard comes with an explicit
[NOTICE](https://github.com/jentic/jentic-api-scorecard/blob/main/NOTICE) file containing
additional legal notices and information.
