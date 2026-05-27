---
type: constitution
section: roadmap
generated_by: spec-driven-agent
generated_at: 2026-05-21T20:06:51Z
confidence: medium
---

# Roadmap

**Phases marked ✅ have shipped; everything else is planned.**

Phases are intentionally small — each one must be a **shippable, independently reviewable, and testable slice of work**.

The starting point is the current repository state: the `docker/` runner ships, but no CI, no npm CLI, no real auth, and no HTML formatter exist. Reference design lives in `docs/architecture.md`; this roadmap sequences how we close the gap.

**Priority values:** `High`, `Medium–High` (en-dash, U+2013), `Medium`. `(blocker)` is reserved for phases that fix a current trust/security gap making the system unsafe for its **today** use; forward-looking production work uses normal priority and states the rationale in the phase body. `(blocker)` implies a release gate for today's bar; other levels express relative queue position.

**Lifecycle:** when a phase ships, append ` ✅` (a single space followed by the U+2705 checkmark) to its `## Phase N — Title` heading and leave the rest of the block in place — do not delete or renumber. The leading space is load-bearing — completion-verify steps `grep -F` for the exact ` ✅` suffix. Phase numbers are stable identifiers; completed phases stay in the file as history. New work takes the next number after the largest existing phase.

## Phase 1 — Ship CI: checks and unstable image from main ✅

**Goal:** establish CI quality gates on PRs, publish an `:unstable` image from every green `main` push, and publish versioned images on git tags.
**Depends on:** none (self-contained CI scaffolding)
**Priority:** High

Currently every image is hand-built and hand-pushed; there's no recorded provenance, no enforcement that the image on GHCR matches the source tree at any tag, and no automated quality checks run on PRs. This phase makes the runner shippable and the development loop trustworthy.

- Add `.github/workflows/ci.yml` triggered on PRs to `main` (no paths filter — runs unconditionally). Also expose `workflow_call` + `workflow_dispatch` for reuse by the publish workflow.
- Concurrency: `group: ci-${{ github.ref }}`, cancel in-progress on non-main refs.
- Lint job: `uv sync --frozen` → `uv run poe lint` (ruff check + format check).
- Test job: `uv sync --frozen` → `uv run poe test` (pytest).
- Use `astral-sh/setup-uv` with Python 3.12 and uv cache enabled.
- Add `.github/workflows/docker-publish.yml` triggered on pushes to `main` (no paths filter) and on `workflow_dispatch`.
- Gate on CI: call `.github/workflows/ci.yml` via `workflow_call` as a prerequisite (`needs: ci`).
- Build context `./docker`; tag the image as `:unstable`; push to `ghcr.io/jentic/jentic-api-scorecard`.
- Use Docker Buildx with GHA cache (`cache-from: type=gha`, `cache-to: type=gha,mode=max`).
- Update `docs/architecture.md` §4 / §8 only if the implemented workflows diverge from the descriptions there.

## Phase 2 — Scaffold packages/ + first end-to-end CLI smoke ✅

**Goal:** stand up the npm workspaces root and the smallest `score` subcommand that orchestrates the published GHCR image.
**Depends on:** Phase 1
**Priority:** High

The npm CLI is the user-facing UX (`npx @jentic/api-scorecard-cli score …`) per `docs/architecture.md` §1. Until it ships, the public README has to point users at raw `docker run` invocations. This phase lands the minimum vertical slice that delivers the documented UX end-to-end (rough, but real).

- Create the npm workspaces root: `package.json`, `lerna.json`, `tsconfig.base.json`. Fixed/locked Lerna versioning (`docs/architecture.md` §2).
- Scaffold `packages/cli/` (`@jentic/api-scorecard-cli`) with a single `score` subcommand that:
  - Reads `JENTIC_API_KEY` from env and forwards it via `-e JENTIC_API_KEY` to `docker run`.
  - Hard-codes the image tag matching its own npm version (CLI version = image tag invariant).
  - Pipes spec input through stdin (local file → bundle via `@redocly/openapi-core`; URL → forward `--url` to the container; gate enforcement stays container-side).
  - Streams container stdout to host stdout; prints engine errors on stderr.
- Scaffold `packages/formatter-html/` (`@jentic/api-scorecard-formatter-html`) with the typed `format(result): string` stub only — no implementation yet.
- README and `.claude/CLAUDE.md` repository-state sections are updated to reflect that `packages/` now exists.

## Phase 3 — Husky + commit-msg hook for human commits ✅

**Goal:** enforce Conventional Commits and DCO sign-off on every human / CI commit, not just Claude-driven ones.
**Depends on:** Phase 2 (needs the npm root)
**Priority:** Medium–High

Today only the Claude PreToolUse hook checks `git commit` payloads. Direct `git commit` from a contributor's terminal can land malformed messages, and the squash-merge commit message must follow Conventional Commits (per `.claude/rules/git-workflow.md`).

- Install `husky`, `@commitlint/cli`, `@commitlint/config-conventional`, and `lint-staged` at the npm root.
- Add `.husky/commit-msg` running commitlint against the staged message.
- Add `.husky/pre-commit` running `lint-staged` (ruff for Python files in `docker/`; eslint for TS files in `packages/`).
- The Claude PreToolUse hook continues to soft-no-op until `node_modules/.bin/commitlint` exists; once Phase 3 ships, the hook activates.

## Phase 4 — Pretty formatter (default human-readable output) ✅

**Goal:** ship the human-readable scorecard so the default `npx … score` shows the headline + dimension table that matches the sample output in `docs/architecture.md` §1, replacing today's engine-verbatim JSON default.
**Depends on:** Phase 2
**Priority:** High

Phase 2 lands a working CLI that streams engine JSON. This phase swaps the default to a pretty-formatted scorecard so the documented sample-output UX (`docs/architecture.md` §1) finally matches reality. **JSON access is temporarily regressed:** there is no `--format` flag yet, so engine-verbatim JSON disappears from the npm CLI until Phase 6 reintroduces it via `--format json`. Users who need JSON in the meantime can still go through the `docker run` path, which always emits engine JSON to stdout.

The other knobs the spec describes (`--detail`, `--format json`, `-o`, `--verbose`, `--quiet`) each ship in their own follow-up phase below.

- Implement the `pretty` formatter inside `packages/cli/src/formatters/` with the headline + dimension table. Treat `summary.dimensions[]` as the canonical shape; tolerate unknown keys.
- Wire it as the unconditional default — no `--format` flag yet (added in Phase 6).
- Add a stderr spinner that auto-suppresses when stderr is not a TTY (per `docs/architecture.md` §5). The explicit `--quiet` override is deferred to Phase 9.

## Phase 5 — `--detail <level>` filtering ✅

**Goal:** ship the graduated `--detail` hierarchy (`summary`, `dimensions` (default), `signals`, `diagnostics`) so users can choose how much of the engine result the CLI surfaces.
**Depends on:** Phase 4
**Priority:** High

Sequenced before the JSON formatter because `--detail` is what makes it interesting — JSON-verbatim with no filtering is just `docker run`. Settling the filter semantics first means JSON (and any later formatters such as HTML) all consume one canonical filtered shape rather than each redefining what `signals` means.

- Add `--detail <level>` with values `summary`, `dimensions` (default), `signals`, `diagnostics`. Each level includes everything below it.
- Apply the filter once, in a shared step that produces the canonical filtered result the formatters consume — see `docs/architecture.md` §7 for the per-level field map.
- Initial wiring covers the `pretty` formatter only; subsequent formatter phases (JSON, HTML) inherit the filter automatically.

## Phase 6 — JSON formatter (`--format json`) ✅

**Goal:** reintroduce engine-verbatim JSON via `--format json`, filtered by `--detail` level.
**Depends on:** Phase 5
**Priority:** High

Phase 4 dropped engine-verbatim JSON from the npm CLI's default output. This phase introduces the `--format` flag with `pretty` (default, from Phase 4) and `json` (engine-verbatim, filtered by Phase 5's `--detail` level). After this phase, `npx … score --format json` is the supported way to get machine-readable output.

- Add `--format <pretty|json>` to `packages/cli/`. Default stays `pretty`.
- Implement the `json` formatter inside `packages/cli/src/formatters/`: pretty-printed engine JSON, filtered by `--detail`. No key renames, no restructuring (per `docs/architecture.md` §7).
- When `--format json` is set and stdout is a TTY, still emit JSON to stdout — JSON is the documented machine-readable channel and users may want to pipe it.
- Reintroduce the `--format json --detail diagnostics` footer hint in the pretty formatter's `appendHint()` (removed in Phase 5 because the flag did not yet exist).

## Phase 7 — `--verbose` / `-v` stderr logging

**Goal:** opt-in verbose stderr logging (engine progress, validator timings, debug info) without changing the report payload on stdout.
**Depends on:** Phase 15
**Priority:** Medium

The stdout/stderr split is part of the documented UX (`docs/architecture.md` §5): stdout carries the report; stderr carries human-facing progress. `--verbose` decides what shows up on stderr when something is wrong, without making the spinner default-noisy. Selective verbose output needs a structured channel to filter — Phase 15's progress events provide it; today's `'inherit'` stdio doesn't.

- Add `--verbose` / `-v`. Host-side only — the report payload on stdout is unchanged.
- Independent of `--quiet` (Phase 9): `--verbose` controls verbosity *level*; `--quiet` controls whether the spinner renders at all.

## Phase 8 — `-o FILE` (write report to file) ✅

**Goal:** support writing the formatted report to a file path while keeping the spinner on stderr.
**Depends on:** Phase 6 (so file output covers `pretty` and `json`)
**Priority:** Medium

`-o` is the recipe `score … --format json -o report.json` that CI integrators want for archiving artifacts.

- Add `-o FILE` to `packages/cli/`. Writes the formatted report (whatever `--format` selects, whatever `--detail` selects) to the path; spinner output continues to land on stderr.
- When `-o` is set with `--format html` (Phase 14), behavior stays the same — write the HTML to the file.
- File-write errors surface on stderr with non-zero exit. A partial write is possible if the process is killed mid-write or the disk fills — re-run in that case.

## Phase 9 — `--quiet` (explicit spinner suppression) ✅

**Goal:** the explicit `--quiet` flag turns the spinner off even when stderr is a TTY.
**Depends on:** Phase 4
**Priority:** Medium

Phase 4 already auto-suppresses the spinner when stderr is not a TTY (the common CI case). `--quiet` is for the interactive case where the user wants no spinner anyway — e.g. piping stderr into a file, or running inside a recording session.

- Add `--quiet` to `packages/cli/`. When set, no spinner is rendered regardless of TTY detection.
- Independent of `--verbose` (Phase 7): `--quiet` does not silence verbose / error logs, only the progress spinner.

## Phase 10 — `--with-llm` plumbing end-to-end ✅

**Goal:** the CLI detects available LLM provider configuration — cloud-provider credentials *or* a local OpenAI-compatible endpoint — errors fast if `--with-llm` is set without a usable provider, and forwards detected configuration into the container.
**Depends on:** Phase 4
**Priority:** Medium–High

Architecture.md §5 describes `--with-llm` precisely. The container already accepts `--with-llm` and forwards `--enable-llm-analysis` to the engine. The host-side scan-and-forward is the remaining piece. Until it ships, users can only invoke `--with-llm` by piping their own `docker run -e …` invocation.

Local-LLM support is load-bearing for enterprise users: many organizations cannot send OpenAPI specs to third-party LLMs for compliance, data-residency, or contractual reasons. The upstream engine already supports OpenAI-compatible local endpoints (Ollama, LM Studio, llama.cpp, vLLM, …) — Phase 10's job is to make that work end-to-end through the npm CLI's docker orchestration without users having to bypass `npx … score` and hand-craft their own `docker run -e …`.

- CLI detects two kinds of LLM configuration in the host environment: cloud-provider credentials (OpenAI / Anthropic / Gemini / AWS Bedrock) and local-LLM routing (provider selection, model, endpoint URL).
- If `--with-llm` is set and no usable provider is detected, exit non-zero **before** `docker run` is invoked, with a guidance message covering both cloud and local recipes.
- Forward detected configuration into the container; credentials never appear in logs, spinner output, or telemetry.
- A local-LLM endpoint pointing at the host machine works on Linux, macOS, and Windows Docker Desktop without per-OS user instructions — host-network reachability is the CLI's problem to solve, not the user's.
- Architecture.md §5 documents both recipes (cloud and local) and the security note that credentials forwarded via `docker run -e` are visible to anyone with access to the user's docker daemon (standard Docker behavior). README links to the new subsection from the `--with-llm` reference.

## Phase 11 — `--bundle` host-side fetch + bundling ✅

**Goal:** support scoring URLs that only the host can reach (internal networks, VPN-gated specs, auth-required URLs).
**Depends on:** Phase 4
**Priority:** Medium

`--bundle` is the escape hatch from `docs/architecture.md` §5. It implies key-required (the anonymous allowlist does not apply once the source URL stops reaching the container).

- CLI fetches the URL on the host, runs Redocly bundling (`@redocly/openapi-core`), pipes bundled JSON to the container's stdin.
- For local paths, `--bundle` is a no-op (bundling is always how local files are handled).
- Update the input-dispatch table in the CLI's help output to match `docs/architecture.md` §5.

## Phase 12 — Alpha channel publish CI ✅

**Goal:** an explicit release process cuts alpha versions on demand — `npx @jentic/api-scorecard-cli@alpha score …` pulls the latest cut, which runs the matching `ghcr.io/jentic/jentic-api-scorecard:<version>` image. Each cut bundles whichever phases have merged since the last one. Only `@jentic/api-scorecard-cli` publishes in alpha; `@jentic/api-scorecard-formatter-html` stays `"private": true` until Phase 14 ships its real implementation.
**Depends on:** Phase 4
**Priority:** High

The roadmap is structured so each phase is independently shippable; an alpha channel makes shipped phases reach users without waiting for a stable cut. Stable release (`@latest` npm dist-tag, real-auth onboarding) is deferred until the flag surface settles and Phase 13's real-auth cutover lands — alpha is the only published channel until then, and the README says so.

Releases are **explicit, not automatic**. Merging to `main` does not publish — it makes the change available to the next alpha cut. The first cut is `1.0.0-alpha.0`; subsequent cuts increment the prerelease counter (`1.0.0-alpha.1`, `1.0.0-alpha.2`, …). The release ritual: bump version on a release branch, tag (`v1.0.0-alpha.<N>`), let CI publish. This keeps the project in control of when an alpha goes out and what's in it; intermediate-merge users can still test against the `:unstable` image from Phase 1.

The CLI version = image tag invariant (`docs/architecture.md` §2) holds in alpha exactly as in stable: each cut publishes the npm prerelease version and builds the matching docker image at that same exact tag. Because the CLI only ever consumes exact-version tags, there is no floating `:alpha` or `:latest` on the docker side — the floating-tag audience is direct `docker run` users, who are already served by Phase 1's `:unstable` rolling-main tag. The npm `@alpha` dist-tag is the public discovery entry point so users don't have to track current alpha version numbers.

- Add `.github/workflows/alpha-publish.yml` triggered on tag refs matching `v*-alpha.*`. Gate on `.github/workflows/ci.yml` via `workflow_call` (`needs: ci`).
- Both packages stay at the same prerelease version via Lerna fixed-version (so the version bump on tag covers both); the tag carries the version.
- Build and push `ghcr.io/jentic/jentic-api-scorecard:<version>` (the exact alpha version, no floating tag).
- Run `npm publish --tag alpha --provenance` for `packages/cli`. `packages/formatter-html` is `"private": true` and skipped automatically by `npm publish`; it begins publishing once Phase 14 lifts the flag.
- Smoke-test post-publish: `npx @jentic/api-scorecard-cli@alpha score --help` succeeds; the version reported by `--version` matches the published version; `docker run --rm ghcr.io/jentic/jentic-api-scorecard:<version> score --help` succeeds.
- Document the alpha release ritual: release branch → version bump → tag (`v1.0.0-alpha.<N>`) → workflow fires → image and packages land together.
- Update `docs/architecture.md` §2 to document the alpha channel and the no-floating-docker-tag invariant. README adds the alpha disclaimer that flag surface is in flux until stable (`--format`, `--quiet`, `--verbose` arrive across Phases 6–9).

## Phase 13 — Real auth: replace `mvp-preview` with an HTTP validator

**Goal:** `JENTIC_API_KEY=<real-key>` validates against `api.jentic.com`; the placeholder check becomes a deprecation message pointing users to signup.
**Depends on:** Phase 12 (so signup-driven onboarding can flow through the documented `npx` UX)
**Priority:** High

The `mvp-preview` placeholder is explicitly transitional (`docs/architecture.md` §9). The phase that ships real keys is a release-gate moment for the project — it's the difference between an MVP preview and a real product. **Not a `(blocker)` today**, because the placeholder system is documented and safe; this is forward-looking work that unblocks the next product phase.

- Replace the static comparison in `docker/src/jentic_scorecard_runner/gate.py` with `httpx.get("https://api.jentic.com/v1/validate", headers={"Authorization": f"Bearer {key}"})`.
- Keep the `mvp-preview` value temporarily as a recognized placeholder with a deprecation message ("This MVP key is deprecated; sign up at https://jentic.com/signup for a real key.") for one minor version, then remove.
- Add `httpx` to `docker/pyproject.toml`.
- Bump the engine pin if needed and rebuild the image (CLI version bump rides along).
- Update `docs/architecture.md` §9 to mark the MVP scheme as superseded.

## Phase 14 — HTML formatter implementation

**Goal:** `@jentic/api-scorecard-formatter-html`'s `format(result): string` ships a real HTML scorecard suitable for embedding in CI artifacts and dashboards.
**Depends on:** Phase 5 (so the input shape — engine-verbatim JSON minus `diagnostics` unless requested — is settled)
**Priority:** Medium

The HTML formatter is scaffolded in `packages/formatter-html/` after Phase 2 but ships a stub. This phase lands the actual formatting.

- Implement `format(result): string` returning a single self-contained HTML document. The output is an interactive React SPA with the bundle (JS + CSS) inlined into `<script>` and `<style>` blocks — no external CDN, no sibling files, works offline. The result JSON is injected as `window.__SCORECARD__` before the bundle's `<script>` so the SPA reads it on mount with no fetch.
- React (or Preact via `preact/compat` if bundle size becomes uncomfortable) is acceptable here because the toolchain is fully encapsulated in this package — the CLI imports the built `format(result): string` and pays no JSX/bundler weight. This is the load-bearing reason this formatter is a separate package while `pretty` / `json` / `markdown` live inside `packages/cli/src/formatters/`.
- Render headline, dimensions, optional per-signal breakdown when the input includes signals, optional diagnostics block when present. Use virtualized rendering (e.g. `react-window`) for long lists so `--detail diagnostics` outputs at the high end (10K+ rows, ~100MB HTML) don't freeze the browser.
- Add a CLI flag `--format html` to `packages/cli/`. Behavior when `-o` is not set: error if stdout is a TTY (refuse to dump HTML into the terminal); stream to stdout if stdout is a pipe (so `score … --format html > scorecard.html` works).
- Lift `"private": true` from `packages/formatter-html/package.json` so the package starts publishing on the same alpha cuts as the CLI.
- Snapshot-test the formatter against a representative result JSON.

## Phase 15 — Runner becomes a long-lived HTTP server; CLI talks to it via `--api-url`

**Goal:** convert the runner from a one-shot process into a long-lived HTTP server. The CLI auto-manages a local container in local mode and bypasses Docker in remote mode (`--api-url <url>`), so multiple CLIs can share one deployment.
**Depends on:** Phase 12 (load-bearing breaking change to the container contract — needs the alpha channel to be the surface where it ships)
**Priority:** Medium–High

Today every `npx … score` is a fresh `docker run` — cold engine, cold validator caches, no path to a shared deployment. A long-lived server fixes both, and gives Phase 7 (`--verbose`) the structured progress channel that today's `'inherit'` stdio cannot provide.

- Container's only entrypoint is the HTTP server; the in-container `score` CLI is removed.
- Local mode: CLI auto-starts and reuses a container; teardown is a user action.
- Remote mode (`--api-url`): pure HTTP, no Docker on the client.
- LLM credentials stay server-side (set at container start in local mode, operator-configured in remote mode) — never per-request.
- Auth is the existing gate (`docker/src/jentic_scorecard_runner/gate.py`), promoted to per-request. Per-key throughput caps and API-level auth on top of the gate are sequenced separately.

This phase replaces the prior "Later Phases" entry "CLI connecting to remote docker instance with `--api-url` option" — removed in this change.

## Later Phases (Not Yet Planned)

- `--min-score N` for CI gating — `score --min-score 70` exits non-zero (proposed exit code `7 — score below threshold`, documented in `docs/architecture.md` §6) when `summary.score < N`. Deferred until concrete CI-integrator demand surfaces; once Phase 6 ships `--format json`, integrators can already gate manually with `jq` on the JSON output. Recipe to document when this lands: `score --min-score 70 --format json -o report.json && upload report.json`.
- Markdown formatter (`--format markdown`) — a Markdown table projection of the scorecard for pasting into PR comments / status checks. Deferred until concrete CI-integrator demand surfaces; `--format json` (Phase 6) covers the machine-readable channel in the meantime.
- Structured logger across `packages/cli/` — replace ad-hoc `process.stderr.write('error: …')` / `'warning: …'` calls with a level-based logger (likely `consola`). Not a phase on its own — refactor, no user-visible capability. The decision to introduce one (or not) belongs in Phase 7's `plan.md`, since `--verbose` is the first feature that makes log levels load-bearing. Listed here so the question isn't lost.
- Native binary distribution via `curl -fsSL | bash` (self-extracting archive bundling Node + node_modules; platform-specific builds in CI; requires code signing for macOS/Windows)
- Multi-spec / portfolio scoring across many APIs in one invocation
- Plugins / custom rubrics on top of JAIRF
- `--cpus` / `--memory` flags + matching engine worker-pool hints (deferred until a concrete user-pain signal)
- Login subcommand / persistent credentials file
- Server-side calls to Jentic for usage tracking / rate limiting

<!-- Items above are clearly out of current scope for the initial product trajectory. -->