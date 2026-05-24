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

- **Node.js** >= 20.10.0 with npm/npx. See [Node.js downloads](https://nodejs.org/).
- **Docker** installed and running. See [Docker installation](https://docs.docker.com/get-docker/).
  The CLI pulls the scoring image automatically on first run.
- Network access to [`ghcr.io`](https://ghcr.io) (to pull the image) and to whatever URL hosts the
  OpenAPI document you're scoring (the engine fetches it from inside the container).

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

## Anonymous vs keyed access

OpenAPI documents from [Jentic Public APIs (OAK)](https://github.com/jentic/jentic-public-apis)
score without any key. For everything else, set the MVP preview key:

```bash
export JENTIC_API_KEY=mvp-preview
```

This is a documented public placeholder for the alpha preview — not a secret. Real key issuance
arrives in a future release.

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
at. Multi-arch images
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

## License

Jentic API Scorecard is licensed under the
[Apache 2.0](https://github.com/jentic/jentic-api-scorecard/blob/main/LICENSE) license.
Jentic API Scorecard comes with an explicit
[NOTICE](https://github.com/jentic/jentic-api-scorecard/blob/main/NOTICE) file containing
additional legal notices and information.
