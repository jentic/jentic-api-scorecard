# Jentic API Scorecard

Score an OpenAPI document against the [Jentic API AI Readiness Framework (JAIRF)](https://github.com/jentic/api-ai-readiness-framework) and get a readable scorecard. Today the project ships as a public Docker image; an `npx @jentic/api-scorecard` CLI wrapper is on the roadmap (see [`docs/architecture.md`](docs/architecture.md)).

## What it does

Pass an OpenAPI spec — by URL or by piping bundled JSON to the container — and the scorer evaluates it across six JAIRF dimensions (foundational compliance, developer experience, AI-readiness, agent usability, security, AI discoverability) and emits the result as JSON. Today the published Docker image is JSON-only; piping its output to `jq` is the way to read a score:

```bash
$ docker run --rm ghcr.io/jentic/jentic-api-scorecard \
    score --url https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/<spec-path> \
  | jq '{score: .summary.score, level: .summary.level, grade: .summary.grade}'
{
  "score": 68.62,
  "level": "ai-aware",
  "grade": "B+"
}
```

The npm CLI on the roadmap will layer a human-readable scorecard on top of the same JSON (target shape — *not yet shipped*, see [`docs/architecture.md`](docs/architecture.md) §1):

```
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
```

## How it works

The image bundles [`jentic-apitools-cli`](https://pypi.org/project/jentic-apitools-cli/) — the JAIRF scoring engine — alongside Python 3.12 and Node 24 (the engine spawns Redocly / Spectral / Speclynx via `npx`). Scoring runs locally inside the container; URL inputs are fetched by the engine, stdin inputs are written to a tempfile and scored from there. Anonymous scoring is restricted to specs in [jentic-public-apis](https://github.com/jentic/jentic-public-apis); other inputs require `JENTIC_API_KEY=mvp-preview` (a documented public placeholder for the MVP preview, not a secret). For the full architecture and design rationale, see [`docs/architecture.md`](docs/architecture.md).

## Quick start

Score an allowlisted public spec, no key required (replace `<spec-path>` with any path under [jentic-public-apis/apis/openapi/](https://github.com/jentic/jentic-public-apis/tree/main/apis/openapi)):

```bash
docker run --rm ghcr.io/jentic/jentic-api-scorecard \
  score --url https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/<spec-path>
```

Score any other URL or a local spec — set the MVP preview key:

```bash
docker run --rm \
  -e JENTIC_API_KEY=mvp-preview \
  ghcr.io/jentic/jentic-api-scorecard \
  score --url https://petstore3.swagger.io/api/v3/openapi.json
```

Pipe a local spec via stdin:

```bash
cat openapi.json | docker run -i --rm \
  -e JENTIC_API_KEY=mvp-preview \
  ghcr.io/jentic/jentic-api-scorecard \
  score
```

Add `--with-llm` (and forward an LLM provider key, e.g. `-e OPENAI_API_KEY`) to enable LLM-backed signal analysis.

## Status

Delivery 1 of the scorecard ships only the GHCR image — direct `docker run` is the supported invocation today. The `@jentic/api-scorecard` npm wrapper that orchestrates the image, host-side spec bundling, and the pretty CLI UX is planned but not yet published. Track scope and roadmap in [`docs/architecture.md`](docs/architecture.md); file issues at https://github.com/jentic/jentic-api-scorecard/issues.

## License

Apache 2.0 — see [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
