---
type: constitution
section: mission
generated_by: spec-driven-agent
generated_at: 2026-05-21T20:06:51Z
confidence: high
---

# Mission

Jentic API Scorecard exists because OpenAPI authors have no clean way to tell whether their API is *ready for AI agents and LLM integrations*. Standards like spec-validity tell you the document parses; nothing tells you whether an agent can actually understand, authenticate against, and operate the API safely. The Jentic API AI Readiness Framework (JAIRF) names the missing rubric — operational signals across foundational compliance, developer experience, AI-readiness, agent usability, security, and AI discoverability — and this project ships the rubric as a runnable scorecard.

Run target: score an OpenAPI spec from one shell command, with no install required, and get back a graded report plus per-signal evidence.

## What We Do

Jentic API Scorecard is a CLI tool that scores an OpenAPI document against JAIRF and emits a Jentic API Readiness Scorecard. The user-facing UX is `npx @jentic/api-scorecard-cli score <input>` (npm CLI orchestrating a public Docker image — see `docs/architecture.md` §1). For Delivery 1 only the public Docker image (`ghcr.io/jentic/jentic-api-scorecard`) ships; the npm wrapper is on the roadmap.

We:

- **Score an OpenAPI spec by URL or piped JSON** — six JAIRF dimensions (FC, DXJ, ARAX, AU, SEC, AID) with overall score, level (`ai-aware`, etc.), and grade (A+ … F).
- **Run scoring locally** in an isolated Docker container — no spec content leaves the user's machine. The only outbound call to Jentic is a small validator round-trip that authenticates the key and increments the per-key usage counter; allowlisted (jentic-public-apis) URLs skip even that.
- **Gate anonymous use** to specs in [`jentic/jentic-public-apis`](https://github.com/jentic/jentic-public-apis) (which always score for free); other inputs require a real `JENTIC_API_KEY` issued at [jentic.com/signup](https://jentic.com/signup), validated live against `api.jentic.com` (see `docs/architecture.md` §9).
- **Emit machine-readable JSON** verbatim from the engine, plus pretty / Markdown projections for human readers (deferred to the npm CLI; today the image emits JSON only).
- **Optionally invoke LLM-backed analysis** via `--with-llm` when an LLM provider key (OpenAI / Anthropic / Gemini / AWS Bedrock) is forwarded by the host.

## Who We Serve

- **OpenAPI spec authors and maintainers** — the primary persona. The team that owns an OpenAPI document and wants a concrete, evidence-grounded answer to "how AI-ready is this spec, and what should I fix first?" Today they consume the tool by running the Docker image; once the npm CLI ships, by `npx @jentic/api-scorecard-cli score …`.
- **CI integrators (secondary)** — the same teams once they want to gate merges on JAIRF score thresholds. Delivery 1 emits stable JSON and exit codes that make this trivial; a `--min-score N` gate flag is explicitly deferred (see `docs/architecture.md` §10).

## Target Audience

- **Public API teams** publishing OpenAPI specs that will be consumed by AI agents — the value lift is highest here, since the score directly predicts agent compatibility.
- **Internal platform teams** evaluating their own catalog before exposing it to agents — the same scoring works against private specs (with `JENTIC_API_KEY` set).
- **Open-source maintainers of OpenAPI specs in the [jentic-public-apis](https://github.com/jentic/jentic-public-apis) catalog** — anonymous mode is built precisely for them; no signup, just `docker run` against a raw GitHub URL.

## What Success Looks Like

- A user with an OpenAPI spec and Docker installed can score it from one shell command and read a graded report in under 30 seconds.
- Scoring is **reproducible**: pinning one CLI version pins one image tag pins one engine version. Two users with the same CLI version against the same spec get the same score (modulo LLM-backed signals, which are stochastic).
- The result JSON is **stable enough to be consumed by automation** — verbatim engine output, no CLI-introduced schema, no envelope keys (see `docs/architecture.md` §7). CI integrators can `jq` the score field without paying attention to CLI version.
- The **key scheme is real**: `JENTIC_API_KEY=<real-key>` is validated live against `api.jentic.com`; rate limits are enforced by the same call. `JENTIC_API_KEY=mvp-preview` remains as a deprecated free-pass during the alpha migration window and is removed in a follow-up minor release (see `docs/architecture.md` §9).
- Anonymous use is **safe by default**: only specs in the documented allowlist can be scored without a key. The container enforces this; the host CLI cannot bypass it.

## Assumptions & Unknowns

- **`jentic-apitools-pipelines` + `jentic-apitools-common` are the engine.** The mission assumes the upstream engine remains the JAIRF reference implementation. If JAIRF and the engine diverge, the constitution will need to revisit which one the mission describes.
- **Real-key validation is live.** The container POSTs to `https://api.jentic.com/api/v1/usage/api-scoring` with header `X-Jentic-API-Key` to validate every real key, and the same call increments the per-key usage counter. `JENTIC_API_KEY=mvp-preview` is a deprecated free-pass kept around only for the alpha migration window. See `docs/architecture.md` §9.
- **The npm CLI is on the roadmap, not shipped today.** Delivery 1 ships only the Docker image. The user-facing `npx @jentic/api-scorecard-cli …` UX is the target; today's actual UX is `docker run …`. Both paths are documented in the README.
- **Sandboxing assumption.** We assume `docker run --rm` provides sufficient isolation for arbitrary public OpenAPI specs to score safely. We do not currently sandbox further (no `--cpus`, no `--memory`, no network namespaces). Architecture.md §10 defers concurrency / CPU control to "concrete user pain."
