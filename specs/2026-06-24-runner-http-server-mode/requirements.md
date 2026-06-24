# Phase 15 Requirements — Runner gains a long-lived HTTP server mode

## Scope

This phase adds a **long-lived HTTP server mode** to the runner image, built *alongside* today's one-shot `docker run … score` path, which keeps working byte-for-byte. The server reuses the upstream `jentic-apitools-score-api-internal` FastAPI application (`POST /v1/scorecards`, health endpoints, content negotiation, multipart upload, SSRF URL validation) as the transport layer, folded into the existing `docker/` image behind a new `serve` entrypoint. score-api's own shared-secret auth is turned off; **our existing gate runs in front of it as a per-request FastAPI dependency**, so server mode preserves the jentic-public-apis anonymous free tier and the live `api.jentic.com` per-key validation/metering that the one-shot path enforces today.

On the host, the CLI gains `--api-url <url>`. In **remote mode** the CLI does pure HTTP against an operator-run server — no Docker on the client. In **local mode** the CLI auto-starts and reuses a long-lived container at the matching image tag and talks to it over HTTP; teardown is an explicit user action. The sync-kind OpenAPI contract the CLI codes against is vendored into this repo so it is reviewable and version-pinned.

## Out of Scope

- **Removing the one-shot path.** The `docker run … score` invocation and the in-container `score` CLI stay intact and supported. Removing them would be the breaking change and is deferred to a separate future phase.
- **Per-key throughput caps and API-level auth on top of the gate.** Sequenced separately per the roadmap. score-api's own in-memory `RateLimiter` stays disabled — `api.jentic.com` remains the single source of truth for rate limiting.
- **The async scoring / jobs surface.** We deploy the **sync-only** kind (`ASYNC_ENABLED` unset); `/openapi/score*/async` and `/jobs*` are not exposed.
- **`--verbose` / structured progress wiring.** The server may expose a structured channel, but consuming it via `--verbose` is Phase 7 (which depends on this phase). Not built or validated here.
- **Score badge (`image/png`) negotiation and multipart upload from the CLI.** The server supports them; the CLI does not need to drive them in this phase (local-file inputs continue to bundle-and-send as JSON).

## Decisions

### Reuse upstream score-api as the server, fold into the existing `docker/` image
Rather than hand-roll an HTTP server in `jentic_scorecard_runner`, we consume the upstream `jentic-apitools-score-api-internal` FastAPI app (private package, installed from `git+ssh://…/jentic-apitools.git#subdirectory=packages/score-api`, currently `1.0.0-alpha.20`). It already wraps the same `score_openapi` pipeline, returns engine-verbatim scorecard JSON, and ships health/SSRF/content-negotiation. We add it as a dependency of the current `docker/` image and expose a new `serve` entrypoint alongside `score`. Consequence: the build needs SSH access to the private `jentic-apitools` repo, and the engine pins must be reconciled — `docker/pyproject.toml` pins `jentic-apitools-{pipelines,common}==1.0.0a18` today, whereas score-api `1.0.0-alpha.20` requires `~=1.0.0-alpha.20`, so an engine-pin bump (and re-lock, re-validated against the one-shot tests) is expected, not just a compatibility check.

### Keep our gate in front; disable score-api's native auth
score-api's `API_KEY` is a single shared deployment secret (constant-time header compare, or bypassed entirely by `API_DEV_MODE=true`) — it is **not** our metered per-user credential, and it dangerously aliases the same `JENTIC_API_KEY` env name (`AliasChoices("API_KEY", "JENTIC_API_KEY")`). We therefore run score-api with its native auth disabled and inject our gate as a per-request dependency on `/v1/scorecards`: read the per-request key from a header, read the URL from the parsed body, run the existing allowlist → `check_usage(key)` logic, and map the verdict to HTTP (GATE_REJECTED→403, AUTH_INVALID→401, RATE_LIMITED→429 + `Retry-After`, fail-open on 5xx). The CLI sends the real `JENTIC_API_KEY` as the per-request header, **never** as a container env var, so per-key metering survives and the env collision is avoided.

### Per-request key travels in the `X-Jentic-API-Key` header
The CLI sends the per-request key in the **`X-Jentic-API-Key`** header — the same name the validator already expects (`usage.py` POSTs `X-Jentic-API-Key` to `api.jentic.com`), so the gate dependency reads one consistent name end to end. This is deliberately **distinct** from score-api's native `Jentic-API-Key` (`APIKeyHeader`) scheme, which we disable: reusing score-api's header name would let its mounted `get_api_key_dependency` and our gate fight over the same header. The gate dependency must read `X-Jentic-API-Key` explicitly; if our header name and the gate's read drift apart the key resolves to `None` and every request is silently treated as anonymous (allowlisted URLs still score, masking the bug until a paid key is used). Pinning the name here is the guard against that.

### `gate.check_gate` gains a per-request key parameter
Today `check_gate` reads `JENTIC_API_KEY` from `os.environ` internally; `usage.check_usage(key)` already takes the key as an argument. We lift the env read into a parameter so the HTTP dependency can pass a per-request key, while the one-shot path keeps reading env. This is the single internal change to shared gate code — additive, with the existing one-shot signature preserved and regression-tested.

### Vendor the sync-kind OpenAPI contract into this repo
We check the score-api **sync** `openapi.yaml` (OpenAPI 3.1.2, ~49 KB) into this repo as the contract the CLI codes against, so the HTTP surface is reviewable and pinned rather than discovered only at runtime via `/openapi.json`. The full (async/jobs) spec is not vendored.

### Remote-mode version coupling is acknowledged, enforcement deferred
The CLI-version = image-tag invariant holds for **local mode** (the CLI pins the container to its own version). **Remote mode** talks to an operator-controlled deployment whose version the CLI cannot pin; a mismatch could silently change output. We record this risk and surface it (e.g. a version field on a health/handshake response), but hardening remote version enforcement is not a blocker for this phase.

## Constraints

- **Gate before score (CRITICAL).** In server mode the gate must run *per request* before any `score_openapi` call, exactly as `__main__.py` runs `check_gate` before `run_score` today. A request that skips the gate lets anonymous inputs reach the engine and defeats the auth model.
- **Anonymous allowlist is the access-control boundary.** `_ALLOWLIST_PATTERN` (jentic-public-apis) remains the only anonymous free pass and must be enforced server-side; the HTTP client cannot be allowed to bypass it.
- **Real keys validated live + metered.** The per-request gate must keep calling `api.jentic.com` (`check_usage`) so the per-key usage counter and 429 rate-limit verdict are unchanged from the one-shot path. Fail-open on validator 5xx/network errors stays.
- **Engine-verbatim JSON.** The HTTP response body is the engine's scorecard JSON verbatim — no envelope, no rename, no schema. The CLI feeds it through the existing `--detail` filter + formatter pipeline unchanged.
- **Exit-code contract is public.** The CLI must map server responses back to the same exit codes the one-shot path produces (0/2/3/6/7/8, host 4), so automation sees identical behavior regardless of mode. In particular, `--with-llm` is in scope, so an LLM-analysis failure over `--api-url` must surface as `LLM_FAILURE` (8) — not a generic error — exactly as the one-shot path does (`test_main.py::TestLlmFailure`).
- **CLI-version = image-tag invariant.** Local mode pins the server container to `IMAGE_NAME:cliVersion`. Remote mode is the documented exception (see Decisions).
- **No runtime package installs.** The score-api dependency closure must be baked at build time (`uv sync --frozen`); the runtime image performs zero installs. Adding score-api reverses tech-stack.md's "No FastAPI / web server" stance — that line must be updated in the same change (per `update-tech-stack-on-deps.md`).
- **LLM credentials stay server-side.** Set at container start (local) or operator-configured (remote); never accepted per-request in the HTTP body/headers.
- **stdout/stderr split preserved.** The CLI keeps the report on stdout and the spinner/progress on stderr in both modes.
- **No-mocks tests.** Server-mode tests start a real container/app, make real HTTP requests, hit the real gate (validator stubbed with a real in-process `pytest-httpserver`), and assert on real engine JSON.
- **Python 3.12 type syntax, top-level imports, no cross-module `_private` imports.** New runner-side code follows `list[str]` / `X | None`, ruff `PLC0415`/`PLC2701`.
- **CLI shells out via `child_process.spawn`, no `dockerode`.** Local-mode container start/reuse/teardown stays on the `spawn('docker', …)` pattern in `docker.ts`.

## Context

Today every `npx … score` is a fresh `docker run` — cold engine import, cold validator npm-cache lookups, no path to a shared deployment. A long-lived server amortizes both and lets multiple CLIs (or a CI fleet) share one deployment, directly serving the CI-integrator and internal-platform-team personas in `specs/mission.md`. It also unblocks **Phase 7 (`--verbose`)**, which `docs/architecture.md` §5 describes but which cannot land until the server provides a structured progress channel that today's `'inherit'` stdio can't.

The central tension is `docs/architecture.md` §1/§2 and tech-stack.md's "No FastAPI / web server / no service in the loop." The additive framing reconciles it: the one-shot path stays the default and unchanged, so the no-service invariant holds for the default flow; the server is opt-in, and in remote mode the *operator* runs the service — Jentic does not become a mandatory backend in every user's loop. `docs/architecture.md` §2's explicit "no long-running container / no daemon-lifecycle subsystem" rationale is the decision this phase revisits, so that section (plus §5's flag table and §9's auth description) must be updated. Folding score-api in also means vendoring its sync OpenAPI contract so the HTTP surface this repo depends on is reviewable in-tree.

## Stakeholder Notes

- **CI integrators / internal platform teams** — want a shared, warm scoring deployment instead of a cold `docker run` per spec; served by remote mode (`--api-url`) against an operator deployment, with per-key `api.jentic.com` metering intact.
- **Phase 7 (`--verbose`) author** — depends on this phase for the structured progress channel; this phase must not foreclose exposing one from the server.
- **Enterprise/compliance users** — local mode keeps spec content on their machine (container is local) while still amortizing engine warmth; LLM credentials stay server-side.
