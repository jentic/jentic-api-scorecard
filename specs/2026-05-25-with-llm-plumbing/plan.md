# Phase 10 Plan — `--with-llm` plumbing end-to-end

## Group 1 — Detection module

1. Create `packages/cli/src/llm-env.ts` exporting two allowlist constants and one pure detection function.
2. Define `CLOUD_CREDENTIAL_ENV_VARS` (string[]): `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_REGION`, `AWS_BEARER_TOKEN_BEDROCK`.
3. Define `LLM_ROUTING_ENV_VARS` (string[]): `LLM_PROVIDER`, `LIGHT_LLM_PROVIDER`, `LLM_MODEL`, `LLM_LIGHT_MODEL`, `LLM_MAX_TOKENS`, `OPENAI_API_URL`, `ANTHROPIC_API_URL`, `GEMINI_API_URL`.
4. Implement `detectLlmEnv(env: NodeJS.ProcessEnv): LlmEnvDetection` returning `{ forwardEnvVars: string[]; addHostFlag: boolean; hasUsableProvider: boolean }`. Iterate both allowlists; an env var is "present" when `env[name] !== undefined && env[name] !== ''`. `hasUsableProvider` is `true` when any cloud credential is present **or** when `LLM_PROVIDER === 'OPENAI'` and `OPENAI_API_URL` is present (any non-empty value — do not compare against the engine's default URL).
5. Implement `isHostLoopbackUrl(value: string): boolean` using Whatwg `URL`. Wrap construction in `try`; return `false` on `TypeError`. Return `true` when `hostname` is `localhost`, `127.0.0.1`, `0.0.0.0`, or `host.docker.internal`. Set `addHostFlag` to `true` in the detection result when any forwarded `*_API_URL` is host-loopback.
6. Export the detection result type as an `interface` (per `.claude/rules/typescript-code-style.md` — `interface` for record shapes).

## Group 2 — Docker invocation surface

7. Extend `DockerRunOptions` in `packages/cli/src/docker.ts`: add `forwardEnvVars: string[]` (new) and `addHostFlag: boolean` (new). Keep `forwardJenticKey: boolean` as-is for diff minimization.
8. In `runDocker`, after the existing `forwardJenticKey` block (around line 70–72), iterate `opts.forwardEnvVars` and append `'-e', name` per entry — same docker passthrough form (`-e <NAME>` with no `=value`).
9. When `opts.addHostFlag` is `true`, append `'--add-host=host.docker.internal:host-gateway'` to `dockerArgs` before `imageRef()` (around line 74). The flag is no-op-or-overwrite on macOS / Windows Docker Desktop.
10. Confirm by reading the file that dockerArgs construction stays in the order: `run` → `--rm` → `-i` (when stdin) → `-e <names>` → `--add-host` → `imageRef()` → user `args`.

## Group 3 — Score command wiring + guidance

11. In `packages/cli/src/commands/score.ts`, after the existing `JENTIC_API_KEY` detection (line 34–35) and before any spinner / image pull / `runDocker` call, gate on `options.withLlm`. When set, call `detectLlmEnv(process.env)`.
12. When `options.withLlm && !detection.hasUsableProvider`, write a multi-line guidance message to `process.stderr.write(...)` and `return ExitCode.GENERIC_ERROR`. Guidance names both recipes — cloud (one of `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `AWS_ACCESS_KEY_ID` **plus** the matching `LLM_PROVIDER`, `LIGHT_LLM_PROVIDER`, and `LLM_LIGHT_MODEL` for non-Bedrock providers — engine defaults all three to Bedrock-shaped values, and without `LLM_LIGHT_MODEL` the engine falls back to a Bedrock model ID and the run fails) and local (`LLM_PROVIDER=OPENAI`, `LIGHT_LLM_PROVIDER=OPENAI`, `OPENAI_API_URL=http://localhost:11434/v1/chat/completions`, `OPENAI_API_KEY=ollama`, `LLM_MODEL=<your-model>`, `LLM_LIGHT_MODEL=<your-model>`). The guidance does **not** contain any captured env values; only the variable names.
13. When `options.withLlm && detection.hasUsableProvider`, pass `forwardEnvVars: detection.forwardEnvVars` and `addHostFlag: detection.addHostFlag` into the `runDocker` opts.
14. When `options.withLlm` is unset, pass `forwardEnvVars: []` and `addHostFlag: false`. The existing `--with-llm`-conditional append to `containerArgs` in `score.ts:30–32` is unchanged — the flag still goes into container argv only when `options.withLlm` is true.

## Group 4 — Docs and roadmap completion

15. Edit `docs/architecture.md` §5: add a "Bring your own LLM" subsection covering (a) the cloud recipe with the full export contract (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `AWS_*` **plus** `LLM_PROVIDER`, `LIGHT_LLM_PROVIDER`, `LLM_LIGHT_MODEL`), (b) the local recipe (`LLM_PROVIDER=OPENAI`, `LIGHT_LLM_PROVIDER=OPENAI`, `OPENAI_API_URL`, `OPENAI_API_KEY=<placeholder>`, `LLM_MODEL`, `LLM_LIGHT_MODEL`), (c) host-network reachability (CLI auto-injects `--add-host=host.docker.internal:host-gateway` when a host-loopback URL is detected), (d) the security note (credentials visible in `docker inspect` for the run's lifetime — standard Docker behavior). The subsection MUST contain the canonical sentence *"Without `LLM_LIGHT_MODEL` the engine falls back to a Bedrock model ID and the run will fail for non-Bedrock providers."* — that sentence is verified by the validation #7 grep gate.
16. Edit `docs/architecture.md` §5 flag table row for `--with-llm` to mention that local OpenAI-compatible endpoints are supported alongside cloud providers.
17. Edit `docs/architecture.md` §6 "Inputs the container reads" — extend the LLM env-var row to enumerate the routing variables the CLI now forwards.
18. Edit `docs/architecture.md` §11 verification recipe — replace "exit 1 (or chosen code)" with the concrete contract: exits `1` (`GENERIC_ERROR`) before `docker run`.
19. Edit `README.md`: add an LLM-analysis subsection or sentence linking to `docs/architecture.md` §5's "Bring your own LLM" anchor. Cover both recipes briefly.
20. Edit `.claude/CLAUDE.md` repository-state section to note the env-scan / forwarding behavior alongside the existing `--with-llm` mention (per the file's "When you read this file and find a mismatch with what's on disk, update this file in the same change" rule).
21. Append ` ✅` (single space + U+2705 checkmark) to the `## Phase 10 — \`--with-llm\` plumbing end-to-end` heading in `specs/roadmap.md`. Leave the rest of the block untouched per the lifecycle rule.

## Group 5 — Verify

22. `npm run lint -w @jentic/api-scorecard-cli` exits 0.
23. `npm run build:typescript -w @jentic/api-scorecard-cli` exits 0.
24. `npm run typescript:check-types -w @jentic/api-scorecard-cli` exits 0. The script resolves to `tsc --noEmit` against `packages/cli/tsconfig.json`, matching the per-package check that `.claude/hooks/typescript-check.sh` runs after every `.ts` edit.
25. From a shell with no LLM env vars set, `JENTIC_API_KEY=mvp-preview node packages/cli/bin/jentic-api-scorecard.mjs score https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/<allowlisted-path> --with-llm` exits non-zero (specifically `1`); stderr contains the substring `OPENAI_API_KEY` (proves the guidance message names the contract); `docker run` is **not** invoked (verifiable with `PATH=` stripped of docker — the call must still exit `1` on the env-scan check, not `4` on docker-missing).
26. From the same shell, `JENTIC_API_KEY=mvp-preview OPENAI_API_KEY=fake-test-key node packages/cli/bin/jentic-api-scorecard.mjs score <allowlisted-url> --with-llm` reaches `docker run` (CLI no longer fails fast). The engine call may fail at the LLM provider — that's expected; the gate this checks is "fail-fast no longer triggers when a credential is present".
27. `grep -F "## Phase 10 — \`--with-llm\` plumbing end-to-end ✅" specs/roadmap.md` exits 0.
28. `grep -F "OPENAI_API_URL" docs/architecture.md` exits 0; `grep -E "Ollama|local LLM|OpenAI-compatible" docs/architecture.md` exits 0.
29. `grep -E "with-llm|LLM analysis|Bring your own LLM" README.md` exits 0.
30. `cd docker && uv run poe test` exits 0 (regression guard — Phase 10 should not change Python behavior).
