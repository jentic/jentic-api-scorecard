# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is the Jentic API Scorecard?

A zero-install CLI that scores an OpenAPI document against the Jentic API AI Readiness Framework (JAIRF) and prints a Jentic API Readiness Scorecard. Distribution: an npm package (`@jentic/api-scorecard-cli`) that orchestrates a public Docker image (`ghcr.io/jentic/jentic-api-scorecard`). The CLI fully abstracts image management; no backend service is in the loop. See `docs/architecture.md` — that document is the **single source of truth** for product, architecture, and decisions; do not duplicate its content here or in memory.

## Repository state today

- **`docker/`** — Python 3.14 + uv runner image that wraps `jentic-apitools-cli` (the JAIRF scoring engine). This is the GHCR artifact (`ghcr.io/jentic/jentic-api-scorecard`). Local dev floor is Python 3.12 (`requires-python = ">=3.12"`); ruff and the type-syntax rule track 3.12 too.
- **`packages/`** — Lerna fixed-version npm workspaces root (`package.json`, `lerna.json`, `tsconfig.base.json` at the repo root). Two packages:
  - `packages/cli/` (`@jentic/api-scorecard-cli`) — TypeScript CLI built with [commander](https://www.npmjs.com/package/commander). One subcommand: `score <input>` with `--with-llm` and `-d, --detail <level>`. Local files are bundled via `@redocly/openapi-core` and piped to the container's stdin; URLs are forwarded as `--url` so the container-side gate stays authoritative. `--bundle` is the URL escape hatch: the CLI fetches and Redocly-bundles the URL host-side, then pipes via stdin (key-required, since the anonymous allowlist no longer applies); for local files `--bundle` is a no-op. The CLI hard-codes `ghcr.io/jentic/jentic-api-scorecard:<cli-version>` and forwards `JENTIC_API_KEY` via docker's `-e` passthrough. When `--with-llm` is set, the CLI scans the host environment for LLM provider credentials and routing variables (cloud providers + OpenAI-compatible local endpoints), exits with guidance if none are detected, and forwards the detected set to the container via `-e <NAME>` passthrough (see `docs/architecture.md` §5 "Bring your own LLM"). The pretty formatter is the unconditional default; `--detail summary | dimensions | signals | diagnostics` (default `dimensions`) selects payload depth — diagnostics in pretty renders a severity tally followed by the top 5 findings per severity (terminal-width truncated), since the full evidence bundle isn't useful in a terminal (`--format json --detail diagnostics` surfaces the full evidence bundle). `-f, --format <pretty|json>` (default `pretty`) selects the output encoding; JSON is engine-verbatim, filtered by `--detail`. `-o, --output <file>` writes the formatted report to a path instead of stdout; spinner stays on stderr. `-q, --quiet` suppresses the stderr spinner regardless of TTY. **`--verbose` ships in Phase 7; the Markdown formatter is deferred to Later Phases.**
  - `packages/formatter-html/` (`@jentic/api-scorecard-formatter-html`) — typed `format(result): string` stub. Throws "not implemented" until Phase 14.
- **`docs/architecture.md`** — the architecture document and the source of truth for every product/architectural claim.
- **`specs/`** — the SDD constitution: `specs/mission.md`, `specs/tech-stack.md`, `specs/roadmap.md` (plus an empty `specs/lessons.md` placeholder that `/sdd-distill-lessons` will fill once retrospectives land). The constitution captures load-bearing invariants and points at `docs/architecture.md` for operational detail. Bootstrapped via `/sdd-create-constitution`; future phases append via `/sdd-new-phase` and materialize via `/sdd-new-spec`.

When you read this file and find a mismatch with what's on disk, update this file in the same change.

### Local dev loop (image)

The CLI hard-codes `ghcr.io/jentic/jentic-api-scorecard:<cli-version>` with no env-var override (per `docs/architecture.md` §2 — image management is fully abstracted). For a published version, Docker resolves that to the GHCR image; while developing, run **`npm run build`** (TypeScript) and **`npm run build:image`** (docker build at the canonical tag) from the repo root. Both scripts live at the npm root: `build` delegates via `lerna run build` to per-package `tsc`; `build:image` is a single `docker build -t … ./docker` invocation that reads the version from `packages/cli/package.json` so the tag tracks the CLI release. Docker's local cache wins over the registry for an exact `name:tag` match, so the CLI then runs against your local build with no flag, no env var, no mode switch. If you want to force-pull the published image instead, `npm run clean:image` (also a root script) removes the local tag.

## Architecture

### Container entrypoint and order (CRITICAL)

`docker/src/jentic_scorecard_runner/__main__.py` runs three stages in this order:

1. Parse `score [--url <url>] [--with-llm]` (or read bundled spec JSON from stdin if `--url` is absent).
2. **Gate check** — `gate.check_gate(url)` decides whether the request is allowed.
3. **Score** — `score.run_score(url, with_llm)` invokes `jentic-apitools score …` and streams the JSON result to stdout.

**The gate MUST run before the engine.** If you reorder the two, anonymous inputs reach the scoring engine without the URL allowlist enforcement, defeating the auth model in `docs/architecture.md` §9. Symptom: `--url` to a non-allowlisted host returns a normal score instead of exit code 3.

### Auth and the gate (`docker/src/jentic_scorecard_runner/gate.py`)

| `JENTIC_API_KEY` | Effect |
|---|---|
| Unset | Anonymous mode — only URLs matching `https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/` are allowed; stdin inputs are rejected. |
| `mvp-preview` | All inputs allowed. This is the documented public placeholder for Delivery 1 — **not a secret**, see `docs/architecture.md` §9. |
| Anything else | Rejected with a guidance message pointing back at `mvp-preview`. |

The allowlist regex lives in `gate.py` as `_ALLOWLIST_PATTERN`. The placeholder key value lives in `gate.py` as `_MVP_KEY`. Real key issuance (HTTP validation against `api.jentic.com`) is deferred to a follow-up delivery; until then, do not extend the gate to add new accepted values.

### Scoring (`docker/src/jentic_scorecard_runner/score.py`)

`run_score` shells out to `jentic-apitools score <target> --format json --include-diagnostics --quiet` (with `--enable-llm-analysis` when `--with-llm`). URL inputs are passed through verbatim; stdin inputs are written to a tempfile first and the path is passed to the engine. Engine timeout is 300s. Engine exit code 2 is mapped to `ExitCode.SPEC_FAILURE` (5); any other non-zero is `ExitCode.ENGINE_FAILURE` (6).

### Exit codes (`docker/src/jentic_scorecard_runner/exit_codes.py`)

`SUCCESS=0`, `GENERIC_ERROR=1`, `AUTH_INVALID_KEY=2`, `GATE_REJECTED=3`, `SPEC_FAILURE=5`, `ENGINE_FAILURE=6`. These are part of the public CLI contract — see `docs/architecture.md` §6 before changing values.

### Image build (`docker/Dockerfile`)

Multi-stage `python:3.14-slim` + `node:24-slim` (engine spawns Redocly / Spectral / Speclynx via `npx`). The builder stage runs `uv sync --frozen --no-dev --no-install-project` to materialize `/app/.venv`; the runtime stage copies the venv and prepends `/app/.venv/bin` to `PATH`, so uv is not present in the final image. The build runs a real score against `docker/.build/sample.yaml` to warm the npm cache so the first user-facing run doesn't pay validator-download cost. Entrypoint: `python -m jentic_scorecard_runner`.

## Common commands

All Python tooling resolves from inside `docker/` — `pyproject.toml` and `poethepoet` are not at the repo root, so `uv run poe …` from the root fails with `Failed to spawn: poe`. JS tooling resolves from the repo root (npm workspaces).

| Task | Command |
|---|---|
| Install JS deps | `npm install` (run from repo root) |
| Build all packages (CLI builds JS + image, formatter-html builds JS) | `npm run build` |
| Clean all packages' build output | `npm run clean` |
| Build only the CLI's TypeScript | `npm run build:typescript -w @jentic/api-scorecard-cli` |
| Build only the CLI's image at the matching tag | `npm run build:image` |
| Remove the CLI's local image | `npm run clean:image` |
| Run Python tests | `cd docker && uv run poe test` |
| Run a Python test subset | `cd docker && uv run poe test tests/test_gate.py` |
| Run JS/TS tests | `npm test` (delegates via `lerna run test`) |
| Run JS/TS tests for one package | `npm test -w @jentic/api-scorecard-cli` |
| Run JS/TS e2e tests (chains build + image build) | `npm run test:e2e` |
| Python lint check | `cd docker && uv run poe lint` |
| Python lint fix | `cd docker && uv run poe lint:fix` |
| JS/TS lint check (all packages) | `npm run lint` |
| JS/TS lint fix (all packages) | `npm run lint:fix` (Prettier runs via `eslint-plugin-prettier`) |
| Dockerfile lint (hadolint via Docker) | `npm run lint:docker` |
| Build the image | `docker build -t jentic-scorecard:dev ./docker` |
| Smoke an allowlisted URL via image | `docker run --rm jentic-scorecard:dev score --url https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/<path>` |
| Smoke an allowlisted URL via CLI | `node packages/cli/bin/jentic-api-scorecard.mjs score https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/<path>` |
| Smoke a local file via CLI | `JENTIC_API_KEY=mvp-preview node packages/cli/bin/jentic-api-scorecard.mjs score docker/.build/sample.yaml` |
| Smoke from stdin via image | `cat openapi.json \| docker run -i --rm -e JENTIC_API_KEY=mvp-preview jentic-scorecard:dev score` |

Tests use pytest, no mocking — `tests/test_main.py` and `tests/test_gate.py` exercise the runner directly; `tests/test_integration.py` exercises the engine end-to-end.

## Lint and commit hooks at the npm root

ESLint (`eslint.config.js` — flat config), Prettier (`.prettierrc`), and commitlint (`.commitlintrc.json`) all live at the repo root. `husky` installs git hooks on `npm install` via the root `prepare` script, and the hooks delegate to lint-staged + commitlint:

- `.husky/pre-commit` → `npx lint-staged` runs `eslint` on staged `packages/**/*.ts`, `cd docker && uv run ruff check && uv run ruff format --check` on staged `docker/**/*.py`, and `npm run lint:docker` (hadolint via Docker) when `docker/Dockerfile` is staged (config: `.lintstagedrc.json`).
- `.husky/commit-msg` → `npx commitlint -e` validates the commit message against `@commitlint/config-conventional` plus the project's `header-max-length: 69` and `scope-case` rules.

The `.claude/hooks/commitlint-before-commit.py` PreToolUse hook (which guards Claude-driven commits) and `.husky/commit-msg` (which guards human-driven commits) share the same `.commitlintrc.json` config, so they enforce the same rules.

## Harness layout (`.claude/`)

- **`rules/`** — always-on guidance. `git-workflow.md` (branches, atomic commits, DCO sign-off, `Refs #N` vs `Closes #N`), `conventional-commits.md` (header format, ≤69 chars, scopes), `python-code-style.md` (ruff, top-level imports only, modern type syntax), `typescript-code-style.md` (ESLint flat config, Prettier 100-col, `.ts` import suffix via `rewriteRelativeImportExtensions`, `as const` over enums), `testing.md` (pytest in `docker/tests/`, no mocking, when to run), `karpathy-guidelines.md` (think before coding, simplicity, surgical changes), `sdd-constitution.md` (SDD workflow), `cli-readme-sync.md` (README `## CLI reference` must be updated whenever `packages/cli/src/index.ts` / `detail.ts` / `format.ts` / `exit-codes.ts` change), `update-tech-stack-on-deps.md` (constitution updates on dependency role changes), `review-auto-apply.md` + `copilot-review-comments.md` (review behavior).
- **`hooks/`** — `commitlint-before-commit.py` (PreToolUse) blocks malformed `git commit -m` payloads; active now that `node_modules/.bin/commitlint` is installed at the repo root. `ruff-fix.sh` (PostToolUse) runs `cd docker && uv run ruff check --fix && uv run ruff format` on every edited `.py` file. `eslint-fix.sh` (PostToolUse) runs `eslint --fix` on every edited `.ts` file under `packages/` (Prettier runs via `eslint-plugin-prettier`). `typescript-check.sh` (PostToolUse) runs `tsc --noEmit -p <package-tsconfig>` after every `.ts` edit under `packages/`; on type errors it exits 2 with the `tsc` output on stderr so Claude Code surfaces them back into the conversation. `hadolint-check.sh` (PostToolUse) runs `docker run --rm -i hadolint/hadolint:v2.14.0 < docker/Dockerfile` whenever `docker/Dockerfile` is edited; on findings it exits 2 with hadolint output on stderr so Claude Code surfaces them back into the conversation.
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
