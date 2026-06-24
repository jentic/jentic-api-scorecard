# Phase 15 Plan — Runner gains a long-lived HTTP server mode

## Group 1 — Gate: per-request key parameterization (de-risk first)

1. In `docker/src/jentic_scorecard_runner/gate.py`, change `check_gate` to accept the API key as a parameter (e.g. `check_gate(url, key)`) instead of reading `JENTIC_API_KEY` from `os.environ` internally; keep the allowlist-bypass and `check_usage(key)` ordering intact.
2. Update the one-shot caller in `docker/src/jentic_scorecard_runner/__main__.py` to read `JENTIC_API_KEY` from the environment and pass it into `check_gate(url, key)` — the one-shot behavior and exit codes stay identical.
3. Add/extend `docker/tests/test_gate.py` to cover the parameterized key path (allowlisted URL bypasses validator regardless of key; passed key drives `check_usage`; 401/429/5xx verdicts unchanged), using the existing `pytest-httpserver` + `JENTIC_API_BASE_URL` pattern, no mocks.

## Group 2 — `serve` entrypoint with our gate in front

4. Add score-api as a build-time dependency of the `docker/` image runtime (declare in `docker/pyproject.toml` against the private `jentic-apitools-score-api-internal` package; re-lock `docker/uv.lock`). Reconcile the engine pins: `docker/pyproject.toml` currently pins `jentic-apitools-{pipelines,common}==1.0.0a18`, while score-api `1.0.0-alpha.20` requires `~=1.0.0-alpha.20` of the same packages — expect to **bump the engine pins** (not merely "keep them compatible") and re-lock, verifying the one-shot integration tests still pass against the bumped engine.
5. Create `docker/src/jentic_scorecard_runner/serve/` (mirroring the `score/` package layout) that builds/launches the score-api FastAPI `app` via uvicorn, with score-api's native auth disabled (`API_DEV_MODE`/override `get_api_key_dependency`) and its in-memory rate limiter left disabled.
6. Implement a per-request gate FastAPI dependency on `/v1/scorecards`: extract the per-request key from the `X-Jentic-API-Key` header and the URL from the parsed body, call `check_gate(url, key)`, and map the verdict to HTTP — GATE_REJECTED→403, AUTH_INVALID→401, RATE_LIMITED→429 with `Retry-After`, fail-open on validator 5xx/network — reusing score-api's `ProblemDetailResponse` shape. Ensure an engine LLM-analysis failure maps to a response the CLI can render as `LLM_FAILURE` (8), preserving the one-shot exit-code contract.
7. Add a `serve` subparser in `docker/src/jentic_scorecard_runner/__main__.py` alongside `score`, dispatching to the new `serve` module; the existing `score` branch (gate→score order) stays byte-for-byte unchanged.
8. Add `docker/tests/test_serve.py` (no mocks): start the app/server, POST an allowlisted URL → 200 + numeric `summary.score`; non-allowlisted no-key → 403; stubbed-401 key → 401; stubbed-429 → 429 + `Retry-After`.

## Group 3 — Image fold-in + vendored contract

9. Update `docker/Dockerfile` to install the score-api dependency closure at build time (private-repo SSH access in the build), add `EXPOSE <port>`, and keep `ENTRYPOINT ["python","-m","jentic_scorecard_runner"]` so `score` is unaffected and `serve` is just another appended argv; preserve the build-time npm-cache warm-up.
10. Vendor the score-api **sync** `openapi.yaml` (OpenAPI 3.1.2) into this repo (e.g. `docker/score-api-openapi.yaml`) as the pinned HTTP contract; note its source version in a header comment.
11. Add a `serve`-mode class to `docker/tests/test_integration.py` (mirroring the `docker_run` + `IMAGE=` override + Linux-only `--network host` guards): `docker run -d … serve`, poll `/health`, POST allowlisted URL → 200 + `summary.score > 0`, then stop the container.

## Group 4 — CLI: `--api-url` remote mode + local lifecycle

12. Add `--api-url <url>` to the `score` command in `packages/cli/src/index.ts`, and add its cross-option rules to `packages/cli/src/validate.ts` (`validateScoreOptions`).
13. In `packages/cli/src/commands/score.ts`, fork on `--api-url`: **remote mode** bypasses Docker entirely and POSTs the bundled spec/URL over HTTP, then feeds the engine JSON through the existing `tryParseEngineOutput` → `filterByDetail` → formatter pipeline unchanged; send the real `JENTIC_API_KEY` in the `X-Jentic-API-Key` header and never forward LLM provider env vars per-request. When `--with-llm` is set, the HTTP request body must set score-api's `enable_llm_analysis: true` (which defaults to `false`), or remote mode would silently score without LLM analysis. **Remote mode must skip the existing host-side `detectLlmEnv(process.env)` gate** (`score.ts:107-131`, which hard-fails with `GENERIC_ERROR` when no host provider is detected): credentials live server-side in this mode, so requiring host LLM creds would contradict the "LLM credentials stay server-side" constraint. That detection gate stays in force for the Docker (local/one-shot) path.
14. Add **local-mode** lifecycle helpers in `packages/cli/src/docker.ts` (`docker run -d --name … -p <port>:<port>` start, `docker ps`/`inspect` reuse-detection, readiness poll) reusing `imageRef()`/`pullImage` and the `docker-host.ts` loopback↔`host.docker.internal` reachability pattern; add an explicit teardown command (e.g. `stop`/`down`) in `index.ts`.
15. Map server HTTP responses back to the existing `ExitCode` values in `packages/cli/src/exit-codes.ts` so remote/local mode behavior matches the one-shot path; add a sensible code path for "server unreachable".
16. Add CLI unit tests (`packages/cli/test/`): `--api-url` validation cases; remote mode never spawns `docker` (points at a real in-process `node:http` server à la `mock-spec-server.ts`); LLM creds absent from the HTTP request; local-mode arg builders deep-equal-asserted.

## Group 5 — Tests: end-to-end

17. Add a remote-mode e2e to `packages/cli/test/e2e/score.e2e.test.ts`: start the real image in `serve` mode, run `score <allowlisted-url> --api-url http://localhost:<port>`, assert exit 0 + pretty headline (and `--format json` numeric `summary.score`); tear the container down.
18. Confirm the full regression set stays green (covered concretely in `validation.md`): existing `test_main.py`/`test_gate.py`/`test_integration.py` one-shot assertions and the default `score` e2e suite pass unmodified.

## Group 6 — Docs + lifecycle

19. Update `docs/architecture.md`: rewrite the §2 "no long-running container / no daemon-lifecycle subsystem" rationale to describe the additive server mode; add the `--api-url` row to the §5 flag table; document per-request gating + the server port in §6/§9.
20. Update `specs/tech-stack.md`: reverse the "No FastAPI / web server" stance additively, add the score-api dependency + uvicorn/FastAPI to the stack, and update the Architecture Summary "Application style" line (per `update-tech-stack-on-deps.md`).
21. Sync `README.md` `## CLI reference` and `skills/jentic-api-scorecard/SKILL.md` flag/exit-code tables for `--api-url` and the new teardown command (per `cli-readme-sync.md`); update the `.claude/CLAUDE.md` repository-state section for the new `serve` mode, vendored spec, and score-api dependency.
22. Append ` ✅` (a single space followed by the U+2705 checkmark) to the `## Phase 15 — Runner gains a long-lived HTTP server mode; CLI talks to it via \`--api-url\`` heading in `specs/roadmap.md`, leaving the rest of the block untouched.

## Group 7 — Verify

23. `cd docker && uv run poe lint` exits 0; `cd docker && uv run poe test` exits 0 (full pytest, including new `test_serve.py` and the parameterized gate tests).
24. `npm run build:image` succeeds, then `cd docker && uv run poe test tests/test_integration.py` exits 0 — including the new `serve`-mode class (Linux) and the unmodified one-shot `TestAllowlistedUrl` (the additive regression guard).
25. `docker run --rm jentic-api-scorecard:dev score --url <oak-petstore-url>` still exits 0 and emits JSON with `summary.score > 0` (one-shot path unchanged).
26. `cid=$(docker run -d --rm -p 8080:8080 jentic-api-scorecard:dev serve)`; poll `/health` 200; `curl -fsS -X POST localhost:8080/v1/scorecards -H 'Content-Type: application/json' -d '{"spec":{"kind":"url","url":"<oak-petstore-url>"}}' | jq '.summary.score'` is `> 0`; `docker stop "$cid"`.
27. Non-allowlisted URL with no key over HTTP returns 403 (GATE_REJECTED semantics); a stubbed-429 validator returns 429 with `Retry-After` (per-request gate proven).
28. `npm run lint` exits 0 (incl. `npm run lint:docker` on the edited Dockerfile); `npm test` exits 0; `npm run test:e2e` exits 0 (default `score` e2e + new remote-mode e2e).
29. `node packages/cli/bin/jentic-api-scorecard.mjs score <oak-petstore-url> --api-url http://localhost:<port>` against a running serve container exits 0 and renders the scorecard; with `--api-url` set, no `docker` process is spawned for the score call.
30. `grep -F "Runner gains a long-lived HTTP server mode; CLI talks to it via \`--api-url\` ✅" specs/roadmap.md` exits 0; `docker/score-api-openapi.yaml` exists and is OpenAPI 3.1.2.
