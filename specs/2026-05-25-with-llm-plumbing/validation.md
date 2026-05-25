# Phase 10 Validation — `--with-llm` plumbing end-to-end

## Definition of Done

All of the following must be true before this branch is merged.

### 1. CLI package builds clean

```
npm run build:typescript -w @jentic/api-scorecard-cli
```

Exits 0 with no `tsc` diagnostics. Mirrors CI's `typescript-build` job.

### 2. CLI package lints clean

```
npm run lint -w @jentic/api-scorecard-cli
```

Exits 0. Mirrors CI's `typescript-lint` job; covers Prettier via `eslint-plugin-prettier`.

### 3. Type-check passes

```
npm run typescript:check-types -w @jentic/api-scorecard-cli
```

Exits 0. Same gate the `.claude/hooks/typescript-check.sh` PostToolUse hook fires after every `.ts` edit. (If the script name in `package.json` differs, run the equivalent that the hook actually invokes.)

### 4. Fail-fast missing-provider path (CI-reproducible; no LLM call)

```
env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u GEMINI_API_KEY \
    -u AWS_ACCESS_KEY_ID -u AWS_SECRET_ACCESS_KEY -u AWS_SESSION_TOKEN \
    -u AWS_REGION -u AWS_BEARER_TOKEN_BEDROCK \
    -u OPENAI_API_URL -u ANTHROPIC_API_URL -u GEMINI_API_URL \
    -u LLM_PROVIDER -u LIGHT_LLM_PROVIDER -u LLM_MODEL -u LLM_LIGHT_MODEL -u LLM_MAX_TOKENS \
  JENTIC_API_KEY=mvp-preview \
  node packages/cli/bin/jentic-api-scorecard.mjs \
    score https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/<allowlisted-path> \
    --with-llm
```

Exits `1` (`GENERIC_ERROR`). Stderr contains a guidance string that names at minimum `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `AWS_ACCESS_KEY_ID`, `OPENAI_API_URL`, `LLM_PROVIDER`, `LIGHT_LLM_PROVIDER`, and `LLM_LIGHT_MODEL` — the full non-Bedrock export contract, since omitting any of the last three drops the run into the engine's Bedrock defaults. **No `docker run` is invoked** — verifiable by running the same command in a shell where `docker` is not on `PATH`; the exit code must remain `1` (env-scan failure), not `4` (docker missing).

### 5. Cloud-credential path no longer fails fast

```
OPENAI_API_KEY=fake-key-for-test \
  node packages/cli/bin/jentic-api-scorecard.mjs \
    score https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/<allowlisted-path> \
    --with-llm
```

The CLI proceeds past the env-scan gate and invokes `docker run` (verifiable by observing the spinner and the docker pull / image-inspect output). The downstream engine call will likely fail (the credential is fake, and `LLM_PROVIDER` is unset → engine defaults to `BEDROCK` and rejects) — that is **not** what this check asserts; the gate is single-purpose: "fail-fast no longer triggers when a credential is present." `JENTIC_API_KEY` is omitted on purpose — the URL is in the gate allowlist, so this test isolates the LLM env-scan path from the gate path.

### 6. Roadmap completion marker

```
grep -F "## Phase 10 — \`--with-llm\` plumbing end-to-end ✅" specs/roadmap.md
```

Exits 0. The leading space before ✅ is load-bearing per the roadmap lifecycle rule.

### 7. Architecture doc updated

```
grep -F "Bring your own LLM" docs/architecture.md
grep -F "OPENAI_API_URL" docs/architecture.md
grep -F "Ollama" docs/architecture.md
grep -F "host-gateway" docs/architecture.md
grep -F "LLM_LIGHT_MODEL" docs/architecture.md
grep -F "Without \`LLM_LIGHT_MODEL\` the engine falls back to a Bedrock model ID" docs/architecture.md
```

All six exit 0. The first asserts the new subsection heading anchor exists; the next three lock down the load-bearing recipe + mechanism keywords; the last two enforce the canonical sentence that keeps non-Bedrock users out of the silent-failure trap. `docs/architecture.md` §5 contains a "Bring your own LLM" subsection that:

- Names the cloud-provider env-var allowlist.
- Names the local-endpoint env vars (`LLM_PROVIDER`, `LIGHT_LLM_PROVIDER`, `OPENAI_API_URL`, `OPENAI_API_KEY` placeholder, `LLM_MODEL`, `LLM_LIGHT_MODEL`).
- Includes the canonical phrasing *"Without `LLM_LIGHT_MODEL` the engine falls back to a Bedrock model ID and the run will fail for non-Bedrock providers."*
- Documents the host-network mechanism (`--add-host=host.docker.internal:host-gateway` injected when a host-loopback URL is detected).
- Repeats the security note that credentials are visible to anyone with access to the docker daemon during the run.

### 8. README updated

```
grep -E "with-llm|LLM analysis|Bring your own LLM" README.md
```

Exits 0. README has an LLM-analysis pointer (subsection or sentence) that cross-references `docs/architecture.md` §5.

### 9. CLAUDE.md repository-state in sync

`.claude/CLAUDE.md` repository-state section's `--with-llm` mention reflects the env-scan + forward-set behavior introduced by this phase. (Per the file's own "When you read this file and find a mismatch with what's on disk, update this file in the same change." rule.)

## Not Required

- **JS/TS unit tests in `packages/cli/`** — `.claude/rules/testing.md` explicitly defers a JS test runner ("no JS/TS tests yet — `packages/` ships scaffolding plus the Phase 2 CLI smoke; suites land when behavior lands"). Adding a runner would be its own un-roadmapped phase.
- **Cloud-LLM end-to-end smoke in CI** — requires real provider credentials Jentic does not store in CI. Manual smoke only: `JENTIC_API_KEY=mvp-preview OPENAI_API_KEY=<real> node packages/cli/bin/jentic-api-scorecard.mjs score <allowlisted-url> --with-llm` should exit 0 and surface LLM-derived signals at `--detail signals` or higher.
- **Local-LLM end-to-end smoke in CI** — requires a host-side Ollama (or LM Studio / vLLM / llama.cpp). Manual smoke only: with `ollama pull llama3.1:8b && ollama serve` running, `JENTIC_API_KEY=mvp-preview OPENAI_API_KEY=ollama OPENAI_API_URL=http://localhost:11434/v1/chat/completions LLM_PROVIDER=OPENAI LLM_MODEL=llama3.1:8b node packages/cli/bin/jentic-api-scorecard.mjs score <allowlisted-url> --with-llm` should exit 0 with LLM signals.
- **Container-side changes** — `docker/src/jentic_scorecard_runner/__main__.py` already accepts `--with-llm`; no image rebuild required for this phase.
- **A new exit code for missing-provider** — `GENERIC_ERROR=1` is reused per the architecture doc's existing language. Introducing `LLM_NO_PROVIDER=7` is deferred until a CI-integrator pain signal warrants it.
- **`--verbose` interaction** — `--verbose` ships in Phase 7; how the new env-scan output integrates with verbose mode is decided then.
- **Secret-leak grep regression test** — covered by the no-leak invariant in code (passthrough form `-e <NAME>` only), not by an automated grep against output. The `-e <NAME>` form makes leakage structurally impossible at the docker-argv layer; an output grep would only catch a regression that re-introduces value interpolation, which is out of scope for this phase's surface.
- **Real-auth gate replacement (Phase 13) and `--bundle` interactions (Phase 11)** — separate phases.
- **Python tests (`cd docker && uv run poe test`)** — Phase 10 is host-CLI-only, scoped to `packages/cli/`, `docs/`, and `specs/`. Per `.claude/rules/testing.md` ("Changed only `packages/`, `docs/`, `specs/`, `.claude/`, or root configs → no Python tests required"), running pytest is not a DoD gate for this phase. CI runs the suite unconditionally on every PR anyway as a regression guard, so any accidental container-side change still surfaces — there is no need to duplicate that gate as a manual DoD step here.
