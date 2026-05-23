# @jentic/api-scorecard-cli

Score an OpenAPI document against the [Jentic API AI Readiness Framework
(JAIRF)](https://github.com/jentic/api-ai-readiness-framework). The CLI orchestrates a public
Docker image (`ghcr.io/jentic/jentic-api-scorecard`) and prints a Jentic API Readiness
Scorecard.

```bash
npx @jentic/api-scorecard-cli score \
  https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/swagger-api/petstore/1.0.27/openapi.json
```

## Requirements

- Node.js 20.10+
- Docker installed and running

## Documentation

- Project overview, quick start, and full usage:
  [github.com/jentic/jentic-api-scorecard](https://github.com/jentic/jentic-api-scorecard)
- Architecture and design notes:
  [`docs/architecture.md`](https://github.com/jentic/jentic-api-scorecard/blob/main/docs/architecture.md)

## License

[Apache 2.0](https://github.com/jentic/jentic-api-scorecard/blob/main/LICENSE). See also
[`NOTICE`](https://github.com/jentic/jentic-api-scorecard/blob/main/NOTICE).
