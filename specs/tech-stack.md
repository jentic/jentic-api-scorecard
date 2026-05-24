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
| Language | Python 3.12 | `docker/pyproject.toml:5` (`requires-python = ">=3.12"`); `docker/Dockerfile:1` (`FROM python:3.12-slim`) |
| Runtime (host) | Docker | `docker/Dockerfile`; `ghcr.io/jentic/jentic-api-scorecard` is the deliverable |
| Runtime (in image) | Python 3.12 + Node 24 LTS | `docker/Dockerfile:1, 3-6` (Node copied from `node:24-slim` for engine's `npx` dispatch) |
| Scoring engine | `jentic-apitools-cli` (PyPI) | `docker/pyproject.toml:7` (pinned exactly); shells out to `npx`-launched Redocly / Spectral / Speclynx validators |
| Dependency manager | uv (build-time only) | `docker/uv.lock`; `docker/Dockerfile` builder stage pins `ghcr.io/astral-sh/uv:0.8.5`; `[tool.uv]` in `docker/pyproject.toml:17-18` |
| Build / packaging | Docker multi-stage | `docker/Dockerfile`; builder stage materializes `.venv` via `uv sync`, runtime stage copies it and runs plain `python`; build-time `npx` cache warming via `docker/.build/sample.yaml` |
| Test framework | pytest | `docker/pyproject.toml:12, 51`; tests in `docker/tests/` |
| Lint / format (Python) | ruff | `docker/pyproject.toml:13, 20-31`; PostToolUse hook `.claude/hooks/ruff-fix.sh` runs on every Python edit |
| Lint / format (JS/TS) | ESLint 9 (flat config) + Prettier 3 | `eslint.config.js`, `.prettierrc` at repo root; `eslint-plugin-import-x`, `typescript-eslint`, `eslint-plugin-prettier` recommended |
| Commit-message lint | commitlint + `@commitlint/config-conventional` | `.commitlintrc.json` at repo root; `header-max-length: 69`; shared by `.husky/commit-msg` (humans) and `.claude/hooks/commitlint-before-commit.py` (Claude) |
| Pre-commit hooks | husky + lint-staged | `.husky/{pre-commit,commit-msg}`; `.lintstagedrc.json` runs eslint on TS, ruff check + format check on Python |
| Task runner | poethepoet (poe) | `docker/pyproject.toml:14, 33-48`; tasks: `lint`, `lint:fix`, `test` |

## Key Libraries and Frameworks

- **`jentic-apitools-cli`** — the JAIRF scoring engine. Invoked as `jentic-apitools score <target> --format json --include-diagnostics --quiet [--enable-llm-analysis]`. Pinned exactly in `docker/pyproject.toml`; reproducibility is "pin one CLI version → pin one image tag → pin one engine version" (see `docs/architecture.md` §8).
- **uv** — fast Python resolver/installer; lockfile (`docker/uv.lock`) is the source of truth for dependency versions. `uv sync --frozen --no-dev --no-install-project` runs in the Dockerfile's builder stage only — uv is not present in the runtime image. `[tool.uv]` declares `package = false` because the runner is image-internal, never published to PyPI.
- **Docker (multi-stage build)** — builder stage on `python:3.12-slim` runs `uv sync` to materialize `/app/.venv`; runtime stage on `python:3.12-slim` copies the venv plus binaries from `node:24-slim`, prepends `/app/.venv/bin` to `PATH`, and runs plain `python` (no `uv run` wrapper). `ENTRYPOINT ["python", "-m", "jentic_scorecard_runner"]` is fixed; every `docker run` appends arguments.

## Data and Storage

- **Primary storage:** NONE. The container processes a single spec per invocation and exits. No DB, no persistent state, no cache between runs. The build-time npm cache lives in image layers (read-only at runtime).
- **Access pattern:** stdin → tempfile → engine; URL → engine (engine fetches). I/O is chunked (`read(65536)`) to avoid RSS blow-up on large specs.
- **Migrations:** N/A.
- **Caching:** image-layer npm cache (`/var/cache/npm`) populated by the build-time score against `docker/.build/sample.yaml`. **Invariant:** containers must perform no package installs at runtime — see `docs/architecture.md` §6 ("Pre-baked dependencies").

## Testing

- **Test framework:** pytest 9.x (`docker/pyproject.toml:12`).
- **Test types visible:** unit (`docker/tests/test_gate.py`, `test_main.py`) + integration (`docker/tests/test_integration.py` exercises a built Docker image end-to-end).
- **Convention: no mocks.** Tests use the real gate logic and (for integration) the real engine via subprocess. Environment is manipulated with pytest's `monkeypatch`; external services are not stubbed. Run with `cd docker && uv run poe test`.

## Tooling and Developer Experience

- **Local development:** `cd docker && uv sync` to install; `cd docker && uv run python -m jentic_scorecard_runner score …` to invoke the runner outside Docker.
- **Build / release:** `docker build ./docker` produces the image. Release is **manual today** — tag, build, push to GHCR by hand. Automation is on the roadmap.
- **Formatting / linting (Python):** ruff (rules `E4`, `E7`, `E9`, `F`, `I`, `PLC0415`, `PLC2701`; line length 100; `lines-after-imports = 2`). Run `cd docker && uv run poe lint:fix`.
- **Formatting / linting (JS/TS):** ESLint 9 flat config (`eslint.config.js`) + Prettier 3 (`.prettierrc`, `printWidth: 100`, single quotes, `trailingComma: all`). `eslint-plugin-import-x` rules cover `import/extensions`, `import/order`, `import/no-extraneous-dependencies`. Run `npm run lint` / `npm run lint:fix` from the repo root (delegates via `lerna run lint`).
- **Type checking:** none on Python (no mypy / pyright in CI). TypeScript itself runs strict-mode (`tsconfig.base.json`); `lerna run typescript:check-types` verifies via `tsc --noEmit` per package.
- **CI/CD:** GitHub Actions — `ci.yml` runs python-lint, python-test, typescript-lint, typescript-build, and lint-commit-messages on PRs to `main`. `docker-publish.yml` triggers on push to `main` (or manual dispatch), reuses `ci.yml` via `workflow_call`, and pushes `ghcr.io/jentic/jentic-api-scorecard:unstable`. Versioned tags from git tags are roadmap, not yet wired. See `docs/architecture.md` §4.
- **Conventional Commits enforcement:** two hooks share `.commitlintrc.json` — `.husky/commit-msg` runs `npx commitlint -e` for human / CI commits; `.claude/hooks/commitlint-before-commit.py` (PreToolUse) intercepts Claude-driven `git commit -m` payloads before they fire. Both are active now that `node_modules/.bin/commitlint` is installed at the repo root (Phase 5).
- **Pre-commit lint pipeline:** `.husky/pre-commit` invokes `npx lint-staged`; `.lintstagedrc.json` runs `eslint` on staged `packages/**/*.ts` and `cd docker && uv run ruff check && uv run ruff format --check` on staged `docker/**/*.py`.
- **DCO sign-off:** required by convention. `git commit -s` adds `Signed-off-by:` per `.claude/rules/git-workflow.md`.

## Deployment and Operations

- **Deployment target:** GHCR (`ghcr.io/jentic/jentic-api-scorecard`). Manual today; automated via `docker-image.yml` on the roadmap.
- **Environment management:** env-vars only (`JENTIC_API_KEY`, optional LLM provider keys). No `.env` file, no secret manager.
- **Observability:** stderr for engine warnings + (eventual) host-side spinner phases. No metrics, no tracing, no telemetry — and no calls to Jentic's backend during scoring (see `docs/architecture.md` §9).
- **Error handling / resilience:** structured exit codes (`docker/src/jentic_scorecard_runner/exit_codes.py`: `SUCCESS=0`, `GENERIC_ERROR=1`, `AUTH_INVALID_KEY=2`, `GATE_REJECTED=3`, `SPEC_FAILURE=5`, `ENGINE_FAILURE=6`). Engine exit code 2 is mapped to `SPEC_FAILURE`; any other non-zero is `ENGINE_FAILURE`. 300s engine timeout enforced in `score.py`.

## Constraints and Conventions

- **Gate before score (CRITICAL).** `docker/src/jentic_scorecard_runner/__main__.py:45-49` calls `check_gate(url)` before `run_score(...)`. Reordering lets anonymous inputs reach the engine, defeating the auth model. Symptom: `--url` to a non-allowlisted host returns a normal score instead of exit code 3.
- **Anonymous URL allowlist is hard-coded regex.** `_ALLOWLIST_PATTERN` in `docker/src/jentic_scorecard_runner/gate.py:18-20` matches `^https://raw\.githubusercontent\.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/`. Do not extend the gate to add new accepted values until real auth ships (see `docs/architecture.md` §9).
- **`JENTIC_API_KEY=mvp-preview` is the only non-anonymous accepted value.** Hard-coded as `_MVP_KEY` in `gate.py:16`. **Not a secret** — the image is public and the value is trivially extractable. Its purpose is to exercise auth plumbing now so swapping in a real validator is a one-function change.
- **Engine invocation is rigid.** Always `--format json --include-diagnostics --quiet` (+ `--enable-llm-analysis` when applicable). The runner does not expose these on its own surface; the container always emits canonical JSON.
- **Result JSON is engine-verbatim.** The runner does not invent a schema, rename keys, or restructure. The CLI consumes whatever `jentic-apitools score --format json` emits (minus `diagnostics` unless `--include-diagnostics` is set on the host CLI). See `docs/architecture.md` §7.
- **Exit codes are public CLI contract.** Container codes 0/1/2/3/5/6 plus host code 4 (Docker missing) are documented in `docs/architecture.md` §5–§6. Changes break automation.
- **No runtime package installs.** All Python wheels and JS tarballs are baked at build time; `RUN jentic-apitools score sample.yaml …` warms the npm cache. Any image change that re-introduces runtime installs is a Dockerfile bug.
- **Python tooling resolves only from `docker/`.** `pyproject.toml`, `uv.lock`, and `poethepoet` live there; `uv run poe …` from the repo root fails (`Failed to spawn: poe`). Always `cd docker &&` first. The root may host an npm workspaces tree later (see roadmap), but Python stays in `docker/`.
- **Tests use no mocks.** Hit the real gate / real engine. Tests are the source of truth for the runner's contract; if a test passes it's because the real boundary works, not because a fake one does.
- **Modern Python type syntax only.** `list[str]`, `dict[str, int]`, `X | None` (PEP 585 / PEP 604). No `typing.List` / `typing.Optional`. Top-level imports only (ruff `PLC0415`); no cross-module `_private` imports (ruff `PLC2701`). See `.claude/rules/python-code-style.md`.
- **Git workflow:** branch (`feat/`, `fix/`, `chore/`, `docs/`, `test/`) → atomic commits with DCO sign-off → PR → squash-merge. Direct push to `main` is forbidden. See `.claude/rules/git-workflow.md`.

## What We Are Not Using

- **No FastAPI / web server.** This is a CLI, not a service. The architecture deliberately has no backend in the loop (`docs/architecture.md` §1).
- **No database.** No persistent state; one spec per `docker run` invocation.
- **No type checker (mypy / pyright).** Ruff handles Python linting; Python type checks are not enforced. TypeScript runs strict-mode `tsc --noEmit` for `packages/`.
- **No usage tracking / telemetry / rate-limiting beyond the static URL allowlist.** Explicit non-goals (`docs/architecture.md` §10).
- **No `dockerode` (Docker SDK).** When the npm CLI lands, it shells out to `docker` via `child_process.spawn`. Decision recorded in `docs/architecture.md` §2.

## Roadmap, not yet built

These exist in `docs/architecture.md` but **not on disk**. Future phases will land them:

- **`.github/workflows/npm-publish.yml`** — publish npm packages on tag (Phase 12 of the roadmap).
- **Output formats and CLI surface.** `--format` (pretty / json / html), `--detail`, `-o`, `--quiet`, `--verbose` are deferred to Phase 3+. The CLI streams engine-verbatim JSON today.
- **Real auth validator.** Replaces the static `mvp-preview` check with an HTTP call to `api.jentic.com`. One-function change inside the container (Phase 13).
- **HTML formatter implementation.** `@jentic/api-scorecard-formatter-html` ships as a stub today (per the architecture doc); the actual formatter lands in Phase 14.

## Open Questions / Uncertain Areas

- **`docker/uv.lock` re-pin cadence.** No documented schedule for refreshing the lock. Currently bound to the engine pin; we re-lock when bumping `jentic-apitools-cli`.
- **Engine signal stability.** `jentic-apitools-cli` is `1.0.0a16` (alpha). Signal names and metadata shapes may change in breaking ways before 1.0; the formatter (when it lands) needs to tolerate unknown / missing keys per `docs/architecture.md` §7.
- **LLM provider selection logic.** Architecture.md §5 says the engine "picks a provider" when multiple LLM keys are forwarded. The selection algorithm is not documented here; defer to upstream engine docs.
