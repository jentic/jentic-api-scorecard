---
type: constitution
section: tech-stack
generated_by: spec-driven-agent
generated_at: 2026-05-21T20:06:51Z
confidence: high
---

# Tech Stack

The current state, grounded in repository evidence. Planned-but-not-built items are called out under **Roadmap, not yet built** and **What We Are Not Using** so this file never claims more than the code supports.

`docs/architecture.md` is the canonical design spec for the project. Conflict-resolution rule: when this file disagrees with code, the code wins; when this file disagrees with `docs/architecture.md` about *intent*, `docs/architecture.md` wins.

## Architecture Summary

- **Application style:** CLI (Docker image today; the npm CLI wrapper has shipped as a smoke-only Phase 2 slice — see `docs/architecture.md` §1)
- **Primary language:** Python 3.12 (in `docker/`); TypeScript 5.6+ (in `packages/`, npm workspaces)
- **Output model:** API_ONLY — the container emits JSON to stdout. Pretty / Markdown formatting is deferred to the npm CLI.
- **Deployment / runtime shape:** CONTAINER (`ghcr.io/jentic/jentic-api-scorecard`, multi-stage Docker build under `docker/`)
- **Current maturity:** PROTOTYPE — the runner code, image build, tests, CI, the Phase 2 CLI smoke, and lint/commit hooks (Phase 5) all exist; formatter output and real auth do not. See `docs/architecture.md` §2 for the design spec; see `What We Are Not Using` below for the gap.

## Core Stack

| Layer | Choice | Evidence |
|---|---|---|
| Language | Python 3.12 (floor); 3.14 in image | `docker/pyproject.toml:5` (`requires-python = ">=3.12"`); `docker/Dockerfile:1` (`FROM python:3.14-slim`) |
| Runtime (host) | Docker | `docker/Dockerfile`; `ghcr.io/jentic/jentic-api-scorecard` is the deliverable |
| Runtime (in image) | Python 3.14 + Node 24 LTS | `docker/Dockerfile:1, 11` (`python:3.14-slim` in both stages); Node copied from `node:24-slim` for engine's `npx` dispatch |
| Scoring engine | `jentic-apitools-pipelines` + `jentic-apitools-common` (PyPI) | `docker/pyproject.toml` (pinned exactly); pipelines transitively pulls `analyze`, `llm`, `score`, `storage`, which spawn `npx`-launched Redocly / Spectral / Speclynx validators |
| Dependency manager | uv (build-time only) | `docker/uv.lock`; `docker/Dockerfile` builder stage pins `ghcr.io/astral-sh/uv:0.8.5`; `[tool.uv]` in `docker/pyproject.toml:17-18` |
| Build / packaging | Docker multi-stage | `docker/Dockerfile`; builder stage materializes `.venv` via `uv sync`, runtime stage copies it and runs plain `python`; build-time `npx` cache warming via a real score against the OAK petstore URL (allowlisted, no key required) |
| Test framework (Python) | pytest | `docker/pyproject.toml:12, 51`; tests in `docker/tests/` |
| Test framework (JS/TS) | mocha | `packages/cli/package.json` devDep; `packages/cli/.mocharc.json`; tests in `packages/cli/test/`; ESLint flat config already wires `eslint-plugin-mocha` for `packages/*/test/**/*.ts` |
| Lint / format (Python) | ruff | `docker/pyproject.toml:13, 20-31`; PostToolUse hook `.claude/hooks/ruff-fix.sh` runs on every Python edit |
| Lint / format (JS/TS) | ESLint 9 (flat config) + Prettier 3 | `eslint.config.js`, `.prettierrc` at repo root; `eslint-plugin-import-x`, `typescript-eslint`, `eslint-plugin-prettier` recommended |
| Lint (Dockerfile) | hadolint via Docker image | root `package.json` `lint:docker` script (`docker run --rm -i hadolint/hadolint:v2.14.0 < docker/Dockerfile` — pinned tag for CI determinism); `.lintstagedrc.json` runs it on staged `docker/Dockerfile`; `.github/workflows/ci.yml` `typescript-lint` job invokes it; PostToolUse hook `.claude/hooks/hadolint-check.sh` runs on every Dockerfile edit |
| Commit-message lint | commitlint + `@commitlint/config-conventional` | `.commitlintrc.json` at repo root; `header-max-length: 69`; shared by `.husky/commit-msg` (humans) and `.claude/hooks/commitlint-before-commit.py` (Claude) |
| Pre-commit hooks | husky + lint-staged | `.husky/{pre-commit,commit-msg}`; `.lintstagedrc.json` runs eslint on TS, ruff check + format check on Python |
| Task runner | poethepoet (poe) | `docker/pyproject.toml:14, 33-48`; tasks: `lint`, `lint:fix`, `test` |

## Key Libraries and Frameworks

- **`jentic-apitools-pipelines` + `jentic-apitools-common`** — the JAIRF scoring engine, called in-process via `jentic.apitools.pipelines.score_openapi(...)` from `docker/src/jentic_scorecard_runner/score/runner.py`. The `pipelines` package transitively pulls `jentic-apitools-{analyze,llm,score,storage}`, so we don't list those in `docker/pyproject.toml`. The previous OSS console-script `jentic-apitools-cli` was discontinued upstream; the runner now owns the click-free entrypoint that used to live there. Both engine packages are pinned exactly in `docker/pyproject.toml`; reproducibility is "pin one CLI version → pin one image tag → pin one engine pair" (see `docs/architecture.md` §8).
- **uv** — fast Python resolver/installer; lockfile (`docker/uv.lock`) is the source of truth for dependency versions. `uv sync --frozen --no-dev --no-install-project` runs in the Dockerfile's builder stage only — uv is not present in the runtime image. `[tool.uv]` declares `package = false` because the runner is image-internal, never published to PyPI.
- **Docker (multi-stage build)** — builder stage on `python:3.14-slim` runs `uv sync` to materialize `/app/.venv`; runtime stage on `python:3.14-slim` copies the venv plus binaries from `node:24-slim`, prepends `/app/.venv/bin` to `PATH`, and runs plain `python` (no `uv run` wrapper). `ENTRYPOINT ["python", "-m", "jentic_scorecard_runner"]` is fixed; every `docker run` appends arguments.
- **React 19 + Vite 7 + Tailwind CSS 4 (formatter-html only)** — `@jentic/api-scorecard-formatter-html` is a dual-entry package. Its `"."` entry's `format(result)` bundles the scorecard UI into a single self-contained HTML document via Vite (`@vitejs/plugin-react`, `@tailwindcss/vite`, `vite-plugin-singlefile`); JS and CSS are inlined, the result JSON is assigned to `window.__SCORECARD__`, and the React SPA reads it on mount. For this entry React/Vite/Tailwind are **devDependencies** — the whole toolchain is bundled into the output string, so `format()` consumers (the CLI) install none of it. The `"./react"` entry additionally exports the scorecard React components (transpiled to `dist/react/` by `tsc -p tsconfig.react.json` with React left external) for consumers embedding the scorecard in their own React app; there React/react-dom are **optional peerDependencies** and styling relies on the consumer's Tailwind pipeline (no CSS shipped). This toolchain encapsulation is the architectural reason the HTML formatter is a separate package while `pretty`/`json` live inside `packages/cli/src/formatters/` (see `docs/architecture.md` §4 layout notes). The package's `src/index.ts` (the Node `format()` entry) stays strict NodeNext TS; the `src/app/` JSX uses Vite's bundler resolution (`tsconfig.app.json`).

## Data and Storage

- **Primary storage:** NONE. The container processes a single spec per invocation and exits. No DB, no persistent state, no cache between runs. The build-time npm cache lives in image layers (read-only at runtime).
- **Access pattern:** stdin → tempfile → engine; URL → engine (engine fetches). I/O is chunked (`read(65536)`) to avoid RSS blow-up on large specs.
- **Migrations:** N/A.
- **Caching:** image-layer npm cache (`/var/cache/npm`) populated by the build-time score against the OAK petstore URL. **Invariant:** containers must perform no package installs at runtime — see `docs/architecture.md` §6 ("Pre-baked dependencies").

## Testing

- **Python test framework:** pytest 9.x (`docker/pyproject.toml:12`).
- **JS/TS test framework:** mocha (`packages/cli/package.json` devDep; `packages/cli/.mocharc.json` enables `tsx`-loaded ESM specs under `packages/cli/test/**/*.test.ts`). Chai is the assertion library.
- **Test types visible:** Python unit (`docker/tests/test_gate.py`, `test_main.py`) + integration (`docker/tests/test_integration.py` exercises a built Docker image end-to-end). JS/TS fixture-based formatter tests (`packages/cli/test/formatters/pretty.test.ts` against a captured engine output JSON in `packages/cli/test/fixtures/`).
- **Convention: no mocks.** Python tests use the real gate logic and (for integration) the real engine via subprocess. JS/TS tests assert on `formatPretty()` output against engine-captured fixtures. Environment is manipulated with pytest's `monkeypatch`; external services are not stubbed. Run with `cd docker && uv run poe test` (Python) and `npm test` from the repo root (JS/TS — delegates via `lerna run test`).

## Tooling and Developer Experience

- **Local development:** `cd docker && uv sync` to install; `cd docker && uv run python -m jentic_scorecard_runner score …` to invoke the runner outside Docker.
- **Build / release:** `docker build ./docker` produces the image. Release is **manual today** — tag, build, push to GHCR by hand. Automation is on the roadmap.
- **Formatting / linting (Python):** ruff (rules `E4`, `E7`, `E9`, `F`, `I`, `PLC0415`, `PLC2701`; line length 100; `lines-after-imports = 2`). Run `cd docker && uv run poe lint:fix`.
- **Formatting / linting (JS/TS):** ESLint 9 flat config (`eslint.config.js`) + Prettier 3 (`.prettierrc`, `printWidth: 100`, single quotes, `trailingComma: all`). `eslint-plugin-import-x` rules cover `import/extensions`, `import/order`, `import/no-extraneous-dependencies`. Run `npm run lint` / `npm run lint:fix` from the repo root (delegates via `lerna run lint`).
- **Type checking:** none on Python (no mypy / pyright in CI). TypeScript itself runs strict-mode (`tsconfig.base.json`); `lerna run typescript:check-types` verifies via `tsc --noEmit` per package.
- **CI/CD:** GitHub Actions — `ci.yml` runs python-lint, python-test, typescript-lint, typescript-build, and lint-commit-messages on PRs to `main`. `docker-publish.yml` triggers on push to `main` (or manual dispatch), reuses `ci.yml` via `workflow_call`, and pushes `ghcr.io/jentic/jentic-api-scorecard:unstable`. Versioned tags from git tags are roadmap, not yet wired. See `docs/architecture.md` §4.
- **Conventional Commits enforcement:** two hooks share `.commitlintrc.json` — `.husky/commit-msg` runs `npx commitlint -e` for human / CI commits; `.claude/hooks/commitlint-before-commit.py` (PreToolUse) intercepts Claude-driven `git commit -m` payloads before they fire. Both are active now that `node_modules/.bin/commitlint` is installed at the repo root (Phase 5).
- **Pre-commit lint pipeline:** `.husky/pre-commit` invokes `npx lint-staged`; `.lintstagedrc.json` runs `eslint` on staged `packages/**/*.ts`, `cd docker && uv run ruff check && uv run ruff format --check` on staged `docker/**/*.py`, and `npm run lint:docker` (hadolint via Docker) on staged `docker/Dockerfile`.
- **DCO sign-off:** required by convention. `git commit -s` adds `Signed-off-by:` per `.claude/rules/git-workflow.md`.

## Deployment and Operations

- **Deployment target:** GHCR (`ghcr.io/jentic/jentic-api-scorecard`). Manual today; automated via `docker-image.yml` on the roadmap.
- **Environment management:** env-vars only (`JENTIC_API_KEY`, optional LLM provider keys). No `.env` file, no secret manager.
- **Observability:** stderr for engine warnings + (eventual) host-side spinner phases. No metrics, no tracing, no telemetry.
- **Outbound calls to Jentic:** limited to the per-invocation key-check round-trip (`POST https://api.jentic.com/api/v1/usage/api-scoring`), which authenticates the key and increments the per-key usage counter. Allowlisted (jentic-public-apis) URLs skip even that. URL-mode scoring additionally fetches the target OpenAPI document and any external `$ref`s; `--with-llm` forwards spec context to the user-selected LLM provider. See `docs/architecture.md` §9.
- **Error handling / resilience:** structured exit codes (`docker/src/jentic_scorecard_runner/exit_codes.py`: `SUCCESS=0`, `GENERIC_ERROR=1`, `AUTH_INVALID_KEY=2`, `GATE_REJECTED=3`, `SPEC_FAILURE=5`, `ENGINE_FAILURE=6`, `RATE_LIMITED=7`). Pipeline exceptions and `result.success == False` both map to `ENGINE_FAILURE`. `SPEC_FAILURE` (5) is reserved in the public contract and currently unreachable since the in-process pipeline does not expose a separate spec-policy exit code. `RATE_LIMITED` (7) is returned when the validator at `api.jentic.com` answers 429. The engine's own timeout knobs (`OASProcessConfiguration.conn_timeout` / `read_timeout`, default 300s each) bound network reads.

## Constraints and Conventions

- **Gate before score (CRITICAL).** `docker/src/jentic_scorecard_runner/__main__.py:45-49` calls `check_gate(url)` before `run_score(...)`. Reordering lets anonymous inputs reach the engine, defeating the auth model. Symptom: `--url` to a non-allowlisted host returns a normal score instead of exit code 3.
- **Anonymous URL allowlist is hard-coded regex.** `_ALLOWLIST_PATTERN` in `docker/src/jentic_scorecard_runner/gate.py` matches `^https://raw\.githubusercontent\.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/`. URLs matching this pattern always score for free and **bypass the validator**, regardless of whether a key is set.
- **Real keys are validated live against `api.jentic.com`.** `docker/src/jentic_scorecard_runner/usage.py` POSTs to `/api/v1/usage/api-scoring` with header `X-Jentic-API-Key`. The same call doubles as the per-key usage / rate-limit accounting hit. 429 → exit 7 with `Retry-After`; 401/403 → exit 2; network error / 5xx → fail open with stderr warning. See `docs/architecture.md` §9.
- **Engine invocation is rigid.** Always `OASProcessConfiguration(enable_llm_analysis=<bool>, include_diagnostics_in_score=True)`. The runner does not expose these knobs on its own surface; the container always emits canonical JSON.
- **Result JSON is engine-verbatim.** The runner does not invent a schema, rename keys, or restructure. The CLI consumes whatever the engine writes to `scorecard.json`, verbatim. See `docs/architecture.md` §7.
- **Exit codes are public CLI contract.** Container codes 0/1/2/3/5/6/7 plus host code 4 (Docker missing) are documented in `docs/architecture.md` §5–§6. Changes break automation.
- **No runtime package installs.** All Python wheels and JS tarballs are baked at build time; the Dockerfile runs a real `score --url <oak-petstore>` invocation at build time to warm the npm cache. Any image change that re-introduces runtime installs is a Dockerfile bug.
- **Python tooling resolves only from `docker/`.** `pyproject.toml`, `uv.lock`, and `poethepoet` live there; `uv run poe …` from the repo root fails (`Failed to spawn: poe`). Always `cd docker &&` first. The root may host an npm workspaces tree later (see roadmap), but Python stays in `docker/`.
- **Tests use no mocks.** Hit the real gate / real engine. Tests are the source of truth for the runner's contract; if a test passes it's because the real boundary works, not because a fake one does.
- **Modern Python type syntax only.** `list[str]`, `dict[str, int]`, `X | None` (PEP 585 / PEP 604). No `typing.List` / `typing.Optional`. Top-level imports only (ruff `PLC0415`); no cross-module `_private` imports (ruff `PLC2701`). See `.claude/rules/python-code-style.md`.
- **Git workflow:** branch (`feat/`, `fix/`, `chore/`, `docs/`, `test/`) → atomic commits with DCO sign-off → PR → squash-merge. Direct push to `main` is forbidden. See `.claude/rules/git-workflow.md`.

## What We Are Not Using

- **No FastAPI / web server.** This is a CLI, not a service. We do not operate any backend in the scoring orchestration loop (`docs/architecture.md` §1). The one outbound call to Jentic is the per-invocation key-check round-trip described in `Outbound calls to Jentic` above.
- **No database.** No persistent state; one spec per `docker run` invocation.
- **No type checker (mypy / pyright).** Ruff handles Python linting; Python type checks are not enforced. TypeScript runs strict-mode `tsc --noEmit` for `packages/`.
- **No telemetry beyond the key-check round-trip.** The container's only outbound call to Jentic is the `/api/v1/usage/api-scoring` hit, which doubles as the per-key usage counter. Allowlisted (jentic-public-apis) URLs do not increment. No Sentry, no analytics, no logs shipped off-host.
- **No `dockerode` (Docker SDK).** When the npm CLI lands, it shells out to `docker` via `child_process.spawn`. Decision recorded in `docs/architecture.md` §2.

## Roadmap, not yet built

These exist in `docs/architecture.md` but **not on disk**. Future phases will land them:

- **`.github/workflows/npm-publish.yml`** — publish npm packages on tag (Phase 12 of the roadmap).
- **CLI surface knobs not yet built.** `--quiet` (Phase 9) and `--verbose` (Phase 7) are deferred. The Markdown formatter and the `--format html` CLI flag (Phase 14) remain deferred — the standalone HTML formatter package now implements `format()`, but wiring it into the CLI's `--format` surface is still pending.
- **Real signup flow at `jentic.com/signup`.** Issues real `JENTIC_API_KEY` values that the in-container validator (already shipped, see `usage.py`) accepts. The container side is done; the consumer-facing signup site is the remaining piece.

## Open Questions / Uncertain Areas

- **`docker/uv.lock` re-pin cadence.** No documented schedule for refreshing the lock. Currently bound to the engine pins; we re-lock when bumping `jentic-apitools-pipelines` / `jentic-apitools-common`.
- **Engine signal stability.** `jentic-apitools-pipelines` and `jentic-apitools-common` are `1.0.0aN` (alpha). Signal names, model fields, and metadata shapes may change in breaking ways before 1.0; the formatter (when it lands) needs to tolerate unknown / missing keys per `docs/architecture.md` §7.
- **LLM provider selection logic.** Architecture.md §5 says the engine "picks a provider" when multiple LLM keys are forwarded. The selection algorithm is not documented here; defer to upstream engine docs.
