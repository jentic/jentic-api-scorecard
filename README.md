# Jentic API Scorecard

![Jentic API Scorecard preview](https://github.com/jentic/jentic-api-scorecard/raw/main/assets/scorecard-preview.jpg)

An OpenAPI document that passes validation isn't necessarily one an AI agent can use. Grammar is
one thing; semantic clarity, safety, and discoverability are another. The **Jentic API Scorecard**
scores your OpenAPI document against the
[Jentic API AI Readiness Framework (JAIRF)](https://github.com/jentic/api-ai-readiness-framework)
across six dimensions and returns a single grade — so you know exactly where to improve.

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
npm install -g @jentic/api-scorecard-cli@alpha
```

This installs the CLI globally. The scoring engine (Docker image) is downloaded automatically
the first time you run `score` — allow a minute or two on a typical connection.

Verify the install:

```bash
jentic-api-scorecard --version
```

> **Prefer zero-install?** You can skip the global install and use `npx` — every example in
> this README works with `npx @jentic/api-scorecard-cli@alpha` in place of
> `jentic-api-scorecard`. The main difference: `npx` always resolves the latest `@alpha`
> release on each invocation, while `npm install -g` pins you to the installed version until
> you explicitly update.

## Try it now

OpenAPI documents from [Jentic Public APIs (OAK)](https://github.com/jentic/jentic-public-apis)
score without any key or limit — no signup, no config:

```bash
npx @jentic/api-scorecard-cli@alpha score \
  https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/swagger-api/petstore/1.0.27/openapi.json
```

For URLs outside OAK or local files, set the API key:

```bash
JENTIC_API_KEY=mvp-preview npx @jentic/api-scorecard-cli@alpha score \
  https://petstore3.swagger.io/api/v3/openapi.json
```

```bash
JENTIC_API_KEY=mvp-preview npx @jentic/api-scorecard-cli@alpha score ./openapi.yaml
```

That's it. The CLI pulls the scoring engine automatically on first run.

![CLI score output](https://github.com/jentic/jentic-api-scorecard/raw/main/assets/cli-screenshot.png)



## Control output depth

The `--detail` flag lets you zoom in:

```bash
# Just the headline score and grade
npx @jentic/api-scorecard-cli@alpha score --detail summary ./openapi.yaml

# Per-dimension breakdown (default)
npx @jentic/api-scorecard-cli@alpha score --detail dimensions ./openapi.yaml

# Individual signals within each dimension
npx @jentic/api-scorecard-cli@alpha score --detail signals ./openapi.yaml

# Full diagnostics with top 5 findings per severity
npx @jentic/api-scorecard-cli@alpha score --detail diagnostics ./openapi.yaml
```

## Machine-readable output

Add `--format json` to emit engine-verbatim JSON on stdout (filtered by whatever
`--detail` level you pick). Pretty stays the unconditional default; `--format json`
is the canonical way to get a stable machine-readable channel for CI gating, archival,
or LLM-assisted review.

```bash
# Gate on the headline score in CI
npx @jentic/api-scorecard-cli@alpha score ./openapi.yaml --format json | jq .summary.score

# Capture the full evidence bundle to a file
npx @jentic/api-scorecard-cli@alpha score ./openapi.yaml \
  --format json --detail diagnostics --output report.json
```

`--output <file>` (`-o`) writes the report to a path instead of stdout; the spinner stays on stderr.

`--quiet` (`-q`) suppresses the stderr spinner even in interactive terminals (the spinner already
auto-suppresses when stderr isn't a TTY). Engine warnings still pass through stderr.

## LLM analysis

Add `--with-llm` to unlock LLM-backed signals — deeper semantic reasoning about whether your API
descriptions are actionable for agents, whether error responses support autonomous recovery, and
more. Requires an LLM provider: cloud (OpenAI / Anthropic / Gemini / AWS Bedrock) or a local
OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, …).

```bash
export OPENAI_API_KEY=sk-...
export LLM_PROVIDER=OPENAI
export LIGHT_LLM_PROVIDER=OPENAI
export LLM_LIGHT_MODEL=gpt-4o-mini

JENTIC_API_KEY=mvp-preview npx @jentic/api-scorecard-cli@alpha score ./openapi.yaml --with-llm
```

Token cost is low — the engine uses a lightweight model (e.g. Claude Haiku, GPT-4o-mini),
processes operations in small batches, and caps at 7 batches regardless of spec size. Local
models (Ollama) cost nothing per call.

See **[LLM Signals guide](https://github.com/jentic/jentic-api-scorecard/blob/main/docs/llm-signals.md)**
for all provider recipes (including local Ollama), the full environment variable reference, and
troubleshooting.

## Anonymous vs keyed access

OpenAPI documents from [Jentic Public APIs (OAK)](https://github.com/jentic/jentic-public-apis)
score without any key. For everything else, set the MVP preview key:

```bash
export JENTIC_API_KEY=mvp-preview
```

This is a documented public placeholder for the alpha preview — not a secret. Real key issuance
arrives in a future release.

## Prefer a browser?

[**jentic.com/scorecard**](https://jentic.com/scorecard) offers the same scoring in a web UI —
paste a URL or drop a file, no Docker or Node required.

## Enterprise-ready by default

For teams that need to know exactly what's running, verify exactly what was
shipped, and run without a runtime dependency on Jentic.

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

### Runs anywhere, calls home nowhere

The image is a closed system at scoring time: every Python wheel, Node.js
binary, and validator tarball it needs is baked in at build time. Scoring does
not call PyPI, npmjs, a Jentic backend, or any external service. Local-file
inputs and bundled-URL inputs run fully offline; URL inputs reach the network
only to fetch the OpenAPI document and resolve any external `$ref`s it points
at. `--with-llm` optionally sends spec context to an LLM provider of the
user's choice; a local endpoint (Ollama) keeps everything on-machine. Multi-arch images
(linux/amd64 + linux/arm64) ship from the same release, so the same guarantees
hold on Apple Silicon dev machines, ARM CI runners, and x86 servers alike.

### Pinned for reproducibility

CLI version, image tag, and engine version are locked one-to-one. Pinning
`@jentic/api-scorecard-cli@<version>` resolves to a specific image tag, which
in turn pins an exact engine release and exact validator versions. Last
month's score is reproducible from last month's pin.

## Status

This project is in **alpha**. Track progress in
[`specs/roadmap.md`](https://github.com/jentic/jentic-api-scorecard/blob/main/specs/roadmap.md).

The `:unstable` Docker image is rebuilt on every push to `main` for direct `docker run` users.
Versioned images are published alongside each alpha CLI release.

### Scoring engine signal status

To see which Jentic API AI Readiness Framework signals are active in the current release, check out the
[scoring engine implementation status](https://docs.jentic.com/reference/api-readiness-framework/scoring-engine-status/).

## License

Jentic API Scorecard is licensed under the
[Apache 2.0](https://github.com/jentic/jentic-api-scorecard/blob/main/LICENSE) license.
Jentic API Scorecard comes with an explicit
[NOTICE](https://github.com/jentic/jentic-api-scorecard/blob/main/NOTICE) file containing
additional legal notices and information.
