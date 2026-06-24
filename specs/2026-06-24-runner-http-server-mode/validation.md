# Phase 15 Validation — Runner gains a long-lived HTTP server mode

## Definition of Done

All of the following must be true before this branch is merged.

### 1. One-shot regression stays green (the additive guarantee)

```
docker build -t jentic-api-scorecard:dev ./docker
cd docker && uv run poe test
```

Full pytest exits 0 — including the unmodified one-shot assertions in `test_main.py`, `test_gate.py`, and `test_integration.py`. The single most load-bearing assertion: `docker run --rm jentic-api-scorecard:dev score --url <oak-petstore-url>` still exits 0 and emits JSON with `summary.score > 0` (`test_integration.py::TestAllowlistedUrl`). The `score` subcommand path is byte-for-byte unchanged.

### 2. Default CLI score path unchanged

```
npm run test:e2e
```

Exits 0. The existing `score command — e2e against docker` suite (allowlisted URL exits 0, renders headline, `--format json` yields numeric `summary.score`, GATE_REJECTED exits 3) passes unmodified — the default `score <input>` flow with no `--api-url` behaves identically.

### 3. Server scores an allowlisted URL over HTTP

```
cid=$(docker run -d --rm -p 8080:8080 jentic-api-scorecard:dev serve)
# poll http://localhost:8080/health until 200
curl -fsS -X POST localhost:8080/v1/scorecards \
  -H 'Content-Type: application/json' \
  -d '{"spec":{"kind":"url","url":"<oak-petstore-url>"}}' | jq '.summary.score'
docker stop "$cid"
```

`/health` returns 200; the POST returns HTTP 200 with a JSON body whose `summary.score` is a number `> 0` (engine-verbatim). Covered by the new `test_serve.py` and the `serve`-mode class in `test_integration.py` (Linux `--network host` guard, `IMAGE=` override honored).

### 4. Our gate is enforced per HTTP request

Against a running `serve` container with the validator stubbed via `pytest-httpserver` (`JENTIC_API_BASE_URL` pointed at the stub):

- A **non-allowlisted** URL with **no key** → HTTP **403** (GATE_REJECTED semantics).
- A key the stub answers **401/403** → HTTP **401** (AUTH_INVALID semantics).
- A key the stub answers **429** → HTTP **429** with a `Retry-After` header (RATE_LIMITED semantics).
- Validator **5xx/network error** → request **fails open** (scores) with a stderr warning.

This proves the allowlist + `api.jentic.com` metering survive the move to per-request gating, and that score-api's native shared-secret auth is not in the path.

### 5. Remote `--api-url` does pure HTTP, no Docker

```
node packages/cli/bin/jentic-api-scorecard.mjs score <oak-petstore-url> --api-url http://localhost:<port>
```

Against a running server, exits 0 and renders the scorecard (and `--format json` yields a numeric `summary.score`). CLI unit tests assert that with `--api-url` set, the CLI **never spawns a `docker` process** for the score call, that the key is sent in the `X-Jentic-API-Key` header, and that **no LLM provider env vars are sent** in the HTTP request (credentials stay server-side). The engine JSON is formatted through the same `--detail`/formatter pipeline as the one-shot path.

### 5a. `--with-llm` over `--api-url` requests LLM analysis and preserves exit 8

With `--with-llm` set, the remote-mode HTTP request body carries `enable_llm_analysis: true` (a CLI unit test asserts this — without it the server defaults to `false` and silently skips LLM analysis). In remote mode `--with-llm` does **not** require host LLM credentials: a CLI unit test asserts that `score … --with-llm --api-url <url>` with no host provider env vars set does **not** hard-fail with `GENERIC_ERROR` (the `detectLlmEnv` gate is skipped), while the same flags on the Docker path still hard-fail as today. An LLM-analysis failure returned by the server maps to exit code **8** (`LLM_FAILURE`), matching the one-shot path's `test_main.py::TestLlmFailure` contract.

### 6. Vendored OpenAPI contract is checked in

`docker/score-api-openapi.yaml` exists, is the score-api **sync** kind, and parses as OpenAPI **3.1.2**. A header comment records the upstream score-api version it was vendored from.

### 7. Lint, type, and docs gates

```
cd docker && uv run poe lint        # ruff check + format, exits 0
npm run lint                         # eslint + hadolint on the edited Dockerfile, exits 0
npm test                             # JS/TS unit, exits 0
```

`specs/tech-stack.md` reverses the "No FastAPI / web server" stance and lists the score-api dependency; `docs/architecture.md` §2/§5/§9 are updated; `README.md` `## CLI reference` and `skills/jentic-api-scorecard/SKILL.md` document `--api-url` and the teardown command (per `cli-readme-sync.md`).

### 8. Roadmap marked complete

```
grep -F "Runner gains a long-lived HTTP server mode; CLI talks to it via \`--api-url\` ✅" specs/roadmap.md
```

Exits 0 — the `## Phase 15 — …` heading ends with ` ✅` and the rest of the block is untouched.

## Not Required

- **Removal of the one-shot `score` path** — explicitly out of scope; validation asserts the opposite (it still works).
- **Per-key throughput caps / API-level auth on top of the gate** — sequenced separately; score-api's in-memory rate limiter stays disabled, so no local throttle test is required.
- **`--verbose` / structured progress event output** — that consumer is Phase 7; no progress-channel behavior is a Phase 15 acceptance target.
- **Async scoring / jobs endpoints** — the sync-only kind is deployed; `/openapi/score*/async` and `/jobs*` are not exposed or tested.
- **Score badge (PNG) and CLI-driven multipart upload** — the server supports them but the CLI does not drive them this phase.
- **Remote-mode version-mismatch enforcement** — the risk is documented; hardening it is not a merge gate here.
