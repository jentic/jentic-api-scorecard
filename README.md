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

## Verifying releases

`@jentic/api-scorecard-cli` alpha tarballs ship with two Sigstore-signed attestations:
npm provenance (where and how the tarball was built) and an SPDX 2.3 SBOM (the runtime
dependency closure). Both are present from `1.0.0-alpha.7` onward; earlier alphas carry only
provenance. Verify with the GitHub CLI:

```bash
npm pack @jentic/api-scorecard-cli@alpha

# Verify provenance (gh's default predicate)
gh attestation verify ./jentic-api-scorecard-cli-*.tgz --owner jentic

# Verify the SBOM (non-default predicate, must be requested explicitly)
gh attestation verify ./jentic-api-scorecard-cli-*.tgz --owner jentic \
  --predicate-type https://spdx.dev/Document/v2.3
```

Each successful run reports `Loaded digest sha256:…` and lists the matching attestation.

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
