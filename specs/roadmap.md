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

The starting point is the current repository state: the `docker/` runner ships, but no CI, no npm CLI, no real auth, and no HTML renderer exist. Reference design lives in `docs/architecture.md`; this roadmap sequences how we close the gap.

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

## Phase 2 — Scaffold packages/ + first end-to-end CLI smoke

**Goal:** stand up the npm workspaces root and the smallest `score` subcommand that orchestrates the published GHCR image.
**Depends on:** Phase 1
**Priority:** High

The npm CLI is the user-facing UX (`npx @jentic/api-scorecard score …`) per `docs/architecture.md` §1. Until it ships, the public README has to point users at raw `docker run` invocations. This phase lands the minimum vertical slice that delivers the documented UX end-to-end (rough, but real).

- Create the npm workspaces root: `package.json`, `lerna.json`, `tsconfig.base.json`. Fixed/locked Lerna versioning (`docs/architecture.md` §2).
- Scaffold `packages/cli/` (`@jentic/api-scorecard`) with a single `score` subcommand that:
  - Reads `JENTIC_API_KEY` from env and forwards it via `-e JENTIC_API_KEY` to `docker run`.
  - Hard-codes the image tag matching its own npm version (CLI version = image tag invariant).
  - Pipes spec input through stdin (local file → bundle via `@redocly/openapi-core`; URL → forward `--url` to the container; gate enforcement stays container-side).
  - Streams container stdout to host stdout; prints engine errors on stderr.
- Scaffold `packages/html-renderer/` (`@jentic/api-scorecard-html`) with the typed `render(result): string` stub only — no implementation yet.
- README and `.claude/CLAUDE.md` repository-state sections are updated to reflect that `packages/` now exists.

## Phase 3 — Pretty / JSON / Markdown output + verbose & diagnostics flags

**Goal:** ship the human-readable scorecard, the canonical JSON form, and the Markdown projection so the UX matches `docs/architecture.md` §5.
**Depends on:** Phase 2
**Priority:** High

Phase 2 lands a working CLI that streams engine JSON. This phase layers the renderers on top so the default `npx … score` shows the scorecard headline + dimensions (matching the sample output in `docs/architecture.md` §1), with `--format`, `--verbose`, `--include-diagnostics`, `-o`, and `--quiet` doing what the spec describes.

- Implement `pretty` renderer (default) with headline + dimension table. Treat `summary.dimensions[]` as the canonical shape; tolerate unknown keys.
- Implement `json` renderer (engine-verbatim, `diagnostics` array stripped unless `--include-diagnostics`).
- Implement `markdown` renderer (Markdown table; `--include-diagnostics` adds a Markdown list).
- Add `--verbose` (per-signal breakdown in pretty mode only — no effect on JSON / Markdown payloads).
- Add `-o FILE` (writes report to file; spinner stays on stderr).
- Add `--quiet` (suppresses spinner explicitly; auto-suppresses when stderr is not a TTY).

## Phase 4 — npm publish CI on tag (both packages)

**Goal:** automate npm publishing so cutting a git tag also publishes `@jentic/api-scorecard` and `@jentic/api-scorecard-html` (Lerna fixed-version means both ship together).
**Depends on:** Phase 3
**Priority:** High

The CLI version = image tag invariant requires that the same git tag triggers both publishes. Manual npm publish is brittle and easy to mis-version.

- Add `.github/workflows/npm-publish.yml` triggered on tag refs `v*`.
- Run `npm publish` for `packages/cli` and `packages/html-renderer` with provenance enabled (`--provenance`).
- Smoke-test post-publish: `npx @jentic/api-scorecard@<version> score --help` succeeds; the version string reported by `--version` matches the tag.
- Document the release ritual: branch → tag → both workflows fire → image and packages land together.

## Phase 5 — Husky + commit-msg hook for human commits

**Goal:** enforce Conventional Commits and DCO sign-off on every human / CI commit, not just Claude-driven ones.
**Depends on:** Phase 2 (needs the npm root)
**Priority:** Medium–High

Today only the Claude PreToolUse hook checks `git commit` payloads. Direct `git commit` from a contributor's terminal can land malformed messages, and the squash-merge commit message must follow Conventional Commits (per `.claude/rules/git-workflow.md`).

- Install `husky`, `@commitlint/cli`, `@commitlint/config-conventional`, and `lint-staged` at the npm root.
- Add `.husky/commit-msg` running commitlint against the staged message.
- Add `.husky/pre-commit` running `lint-staged` (ruff for Python files in `docker/`; eslint for TS files in `packages/`).
- The Claude PreToolUse hook continues to soft-no-op until `node_modules/.bin/commitlint` exists; once Phase 5 ships, the hook activates.

## Phase 6 — `--with-llm` plumbing end-to-end

**Goal:** the CLI scans for LLM provider keys, errors fast if `--with-llm` is set without one, and forwards present keys via docker's passthrough form.
**Depends on:** Phase 3
**Priority:** Medium–High

Architecture.md §5 describes `--with-llm` precisely. The container already accepts `--with-llm` and forwards `--enable-llm-analysis` to the engine. The host-side scan-and-forward is the remaining piece. Until it ships, users can only invoke `--with-llm` by piping their own `docker run -e …` invocation.

- CLI scans its env for `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, and `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` / `AWS_REGION`.
- If `--with-llm` is set and none are present, exit non-zero **before** `docker run` is invoked, with a guidance message.
- Forward each present key via `-e <NAME>` (docker passthrough form). Do not log keys in spinner / error / telemetry output.
- Document the security note (provider keys appear in `docker inspect` for the run; this is standard Docker behavior, see `docs/architecture.md` §5).

## Phase 7 — `--bundle` host-side fetch + bundling

**Goal:** support scoring URLs that only the host can reach (internal networks, VPN-gated specs, auth-required URLs).
**Depends on:** Phase 3
**Priority:** Medium

`--bundle` is the escape hatch from `docs/architecture.md` §5. It implies key-required (the anonymous allowlist does not apply once the source URL stops reaching the container).

- CLI fetches the URL on the host, runs Redocly bundling (`@redocly/openapi-core`), pipes bundled JSON to the container's stdin.
- For local paths, `--bundle` is a no-op (bundling is always how local files are handled).
- Update the input-dispatch table in the CLI's help output to match `docs/architecture.md` §5.

## Phase 8 — Real auth: replace `mvp-preview` with an HTTP validator

**Goal:** `JENTIC_API_KEY=<real-key>` validates against `api.jentic.com`; the placeholder check becomes a deprecation message pointing users to signup.
**Depends on:** Phase 4 (so signup-driven onboarding can flow through the documented `npx` UX)
**Priority:** High

The `mvp-preview` placeholder is explicitly transitional (`docs/architecture.md` §9). The phase that ships real keys is a release-gate moment for the project — it's the difference between an MVP preview and a real product. **Not a `(blocker)` today**, because the placeholder system is documented and safe; this is forward-looking work that unblocks the next product phase.

- Replace the static comparison in `docker/src/jentic_scorecard_runner/gate.py` with `httpx.get("https://api.jentic.com/v1/validate", headers={"Authorization": f"Bearer {key}"})`.
- Keep the `mvp-preview` value temporarily as a recognized placeholder with a deprecation message ("This MVP key is deprecated; sign up at https://jentic.com/signup for a real key.") for one minor version, then remove.
- Add `httpx` to `docker/pyproject.toml`.
- Bump the engine pin if needed and rebuild the image (CLI version bump rides along).
- Update `docs/architecture.md` §9 to mark the MVP scheme as superseded.

## Phase 9 — HTML renderer implementation

**Goal:** `@jentic/api-scorecard-html`'s `render(result): string` ships a real HTML scorecard suitable for embedding in CI artifacts and dashboards.
**Depends on:** Phase 3 (so the input shape — engine-verbatim JSON minus `diagnostics` unless requested — is settled)
**Priority:** Medium

The HTML renderer is scaffolded in `packages/html-renderer/` after Phase 2 but ships a stub. This phase lands the actual rendering.

- Implement `render(result): string` returning self-contained HTML (no external CSS / JS dependencies).
- Render headline, dimensions, optional per-signal breakdown when the input includes signals, optional diagnostics block when present.
- Add a CLI flag `--format html` (and `-o report.html`) wiring the renderer in.
- Snapshot-test the renderer against a representative result JSON.

## Phase 10 — `--min-score N` for CI gating

**Goal:** `score --min-score 70` exits non-zero if the final score is below 70, enabling CI to gate on JAIRF compliance.
**Depends on:** Phase 3 (output formats settled)
**Priority:** Medium

Sequenced after Phase 3 ships JSON / Markdown stably — CI integrators need a stable JSON shape before the gate flag is interesting.

- Add `--min-score <N>` flag that exits non-zero if `summary.score < N`. New exit code or reuse `GENERIC_ERROR=1`? Default to a new code (e.g. `7 — score below threshold`) and document it in `docs/architecture.md` §6.
- Document the CI recipe in the README ("score --min-score 70 --format json -o report.json && upload report.json").

## Later Phases (Not Yet Planned)

- Multi-spec / portfolio scoring across many APIs in one invocation
- Plugins / custom rubrics on top of JAIRF
- `--cpus` / `--memory` flags + matching engine worker-pool hints (deferred until a concrete user-pain signal)
- Login subcommand / persistent credentials file
- Server-side calls to Jentic for usage tracking / rate limiting

<!-- Items above are clearly out of current scope for the initial product trajectory. -->
