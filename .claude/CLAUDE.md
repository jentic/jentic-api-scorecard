# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is the Jentic API Scorecard?

A zero-install CLI that scores an OpenAPI document against the Jentic API AI Readiness Framework (JAIRF) and prints a Jentic API Readiness Scorecard. Distribution: an npm package (`@jentic/api-scorecard`) that orchestrates a public Docker image (`ghcr.io/jentic/jentic-api-scorecard`). The CLI fully abstracts image management; no backend service is in the loop. See @../docs/architecture.md — that document is the **single source of truth** for product, architecture, and decisions; do not duplicate its content here or in memory.

## Repository state today

- **`docker/`** — the only code that exists. A Python 3.12 + uv runner image that wraps `jentic-apitools-cli` (the JAIRF scoring engine). This is everything that ships in v0.1.
- **`packages/`** — does **not** exist yet. The TypeScript CLI (`@jentic/api-scorecard`) and a stub HTML renderer are on the roadmap per @../docs/architecture.md §4.
- **`docs/architecture.md`** — the architecture document and the source of truth for every product/architectural claim.
- **`specs/`** — the SDD constitution: `specs/mission.md`, `specs/tech-stack.md`, `specs/roadmap.md` (plus an empty `specs/lessons.md` placeholder that `/sdd-distill-lessons` will fill once retrospectives land). The constitution captures load-bearing invariants and points at `docs/architecture.md` for operational detail. Bootstrapped via `/sdd-create-constitution`; future phases append via `/sdd-new-phase` and materialize via `/sdd-new-spec`.

When you read this file and find a mismatch with what's on disk (e.g. `packages/` now exists, `specs/` is populated), update this file in the same change.

## Architecture

### Container entrypoint and order (CRITICAL)

`docker/src/jentic_scorecard_runner/__main__.py` runs three stages in this order:

1. Parse `score [--url <url>] [--with-llm]` (or read bundled spec JSON from stdin if `--url` is absent).
2. **Gate check** — `gate.check_gate(url)` decides whether the request is allowed.
3. **Score** — `score.run_score(url, with_llm)` invokes `jentic-apitools score …` and streams the JSON result to stdout.

**The gate MUST run before the engine.** If you reorder the two, anonymous inputs reach the scoring engine without the URL allowlist enforcement, defeating the auth model in @../docs/architecture.md §9. Symptom: `--url` to a non-allowlisted host returns a normal score instead of exit code 3.

### Auth and the gate (`docker/src/jentic_scorecard_runner/gate.py`)

| `JENTIC_API_KEY` | Effect |
|---|---|
| Unset | Anonymous mode — only URLs matching `https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/` are allowed; stdin inputs are rejected. |
| `mvp-preview` | All inputs allowed. This is the documented public placeholder for Delivery 1 — **not a secret**, see @../docs/architecture.md §9. |
| Anything else | Rejected with a guidance message pointing back at `mvp-preview`. |

The allowlist regex lives in `gate.py` as `_ALLOWLIST_PATTERN`. The placeholder key value lives in `gate.py` as `_MVP_KEY`. Real key issuance (HTTP validation against `api.jentic.com`) is deferred to a follow-up delivery; until then, do not extend the gate to add new accepted values.

### Scoring (`docker/src/jentic_scorecard_runner/score.py`)

`run_score` shells out to `jentic-apitools score <target> --format json --include-diagnostics --quiet` (with `--enable-llm-analysis` when `--with-llm`). URL inputs are passed through verbatim; stdin inputs are written to a tempfile first and the path is passed to the engine. Engine timeout is 300s. Engine exit code 2 is mapped to `ExitCode.SPEC_FAILURE` (5); any other non-zero is `ExitCode.ENGINE_FAILURE` (6).

### Exit codes (`docker/src/jentic_scorecard_runner/exit_codes.py`)

`SUCCESS=0`, `GENERIC_ERROR=1`, `AUTH_INVALID_KEY=2`, `GATE_REJECTED=3`, `SPEC_FAILURE=5`, `ENGINE_FAILURE=6`. These are part of the public CLI contract — see @../docs/architecture.md §6 before changing values.

### Image build (`docker/Dockerfile`)

Multi-stage `python:3.12-slim` + `node:24-slim` (engine spawns Redocly / Spectral / Speclynx via `npx`). `uv sync --frozen --no-dev --no-install-project` installs the engine. The build runs a real score against `docker/.build/sample.yaml` to warm the npm cache so the first user-facing run doesn't pay validator-download cost. Entrypoint: `uv run python -m jentic_scorecard_runner`.

## Common commands

All Python tooling resolves from inside `docker/` — `pyproject.toml` and `poethepoet` are not at the repo root, so `uv run poe …` from the root fails with `Failed to spawn: poe`.

| Task | Command |
|---|---|
| Run tests | `cd docker && uv run poe test` |
| Run a subset | `cd docker && uv run poe test tests/test_gate.py` |
| Lint check | `cd docker && uv run poe lint` |
| Lint fix | `cd docker && uv run poe lint:fix` |
| Build the image | `docker build -t jentic-scorecard:dev ./docker` |
| Smoke an allowlisted URL | `docker run --rm jentic-scorecard:dev score --url https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/<path>` |
| Smoke from stdin | `cat openapi.json \| docker run -i --rm -e JENTIC_API_KEY=mvp-preview jentic-scorecard:dev score` |

Tests use pytest, no mocking — `tests/test_main.py` and `tests/test_gate.py` exercise the runner directly; `tests/test_integration.py` exercises the engine end-to-end.

## Harness layout (`.claude/`)

- **`rules/`** — always-on guidance. `git-workflow.md` (branches, atomic commits, DCO sign-off, `Refs #N` vs `Closes #N`), `conventional-commits.md` (header format, ≤69 chars, scopes), `python-code-style.md` (ruff, top-level imports only, modern type syntax), `karpathy-guidelines.md` (think before coding, simplicity, surgical changes), `sdd-constitution.md` (SDD workflow), `review-auto-apply.md` + `copilot-review-comments.md` (review behavior).
- **`hooks/`** — `commitlint-before-commit.py` (PreToolUse) blocks malformed `git commit -m` payloads; soft no-op until `node_modules/.bin/commitlint` is installed at the repo root. `ruff-fix.sh` (PostToolUse) runs `cd docker && uv run ruff check --fix && uv run ruff format` on every edited `.py` file.
- **`skills/`** — invokable slash commands. SDD: `/sdd-create-constitution`, `/sdd-new-phase`, `/sdd-new-spec`, `/sdd-implement-spec`, `/sdd-distill-lessons`. Review: `/review-community` (someone else's PR with the diplomatic tone in `output-styles/review-comments.md`).
- **`templates/sdd/`** — structural scaffolds for constitution and feature-spec files. `/sdd-create-constitution` and `/sdd-new-spec` consume these.
- **`worktrees/`** — git-worktree mount points (gitignored content; only `.gitkeep` is tracked).
- **`output-styles/review-comments.md`** — diplomatic-review tone, used as a turn-instruction overlay by `/review-community`.

## Conventions

- **Branch + PR for every change.** No direct push to `main` — branch (`feat/`, `fix/`, `chore/`, `docs/`, `test/`), commit there, push, open a PR via `gh pr create`. PRs are squash-merged; the squash header must follow Conventional Commits.
- **Atomic commits, DCO sign-off.** `git commit -s`. One logical change per commit. Header ≤69 chars; scope reflects the primary subject (e.g. `feat(gate): allow github-raw spec URLs anonymously`, `fix(score): handle engine timeout cleanly`).
- **No mocking in tests.** Hit the real CLI / real engine; tests are organized around behavior at the runner boundary.
- **Python 3.12 type syntax.** `list[str]`, `dict[str, int]`, `X | None`. No `typing.List` / `typing.Optional`. All imports at module top (ruff `PLC0415`). Don't import other modules' `_private` names (ruff `PLC2701`).

## Open scope

When something needs to ship that doesn't fit the items above (a new CI workflow, the first npm package, a new docs file), align with `docs/architecture.md` first. If the architecture doc disagrees with what you're about to build, update the doc in the same PR — the doc is canonical, not aspirational.
