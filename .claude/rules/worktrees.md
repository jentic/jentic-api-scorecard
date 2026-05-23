## Parallel sessions via worktrees

This repo has no long-running service — the user-facing artifact is a one-shot `docker run` per scoring invocation. So worktree coordination is much simpler than for a typical full-stack project: there are no port pairs to allocate, no DB files to keep separate, no compose stacks to stop.

When the user asks for a worktree:

1. Create it with `EnterWorktree`. Worktree mount points are gitignored under `.claude/worktrees/`; only `.gitkeep` is tracked.
2. Install deps (run in parallel):
   - **Python**: `cd docker && uv sync` at the worktree's `docker/` directory. uv always uses the project-local `.venv`, so no env-var prefix is needed.
   - **JS**: `npm install` at the worktree root (npm workspaces hoist into a single `node_modules/`).
   The `.venv`, `node_modules/`, `__pycache__/`, and `dist/` are all gitignored, so a fresh worktree has none of them — `husky` reinstalls its trampoline directory on `prepare`.

### What's shared vs. isolated

There is no `.worktreeinclude` file in this repo today. Nothing needs to be copied into a fresh worktree — every artifact a worktree consumes (`docker/.venv/`, `docker/.build/sample.yaml` if you re-warm the cache, `node_modules/`, `dist/`) is either gitignored, regeneratable, or already part of the tracked tree. There is no `.env` to forward; the only env vars the runner reads are `JENTIC_API_KEY` and the optional LLM-provider keys, all set per-shell.

### Docker image tag is the one collision risk

`npm run build:image -w @jentic/api-scorecard-cli` builds the local image at `ghcr.io/jentic/jentic-api-scorecard:<cli-version>` (read from `packages/cli/package.json`). Two worktrees on the same `cli-version` will race for that tag — whichever finishes `docker build` last wins, and the other worktree's next `docker run` picks up the wrong sources.

Mitigations, in order of preference:

1. **Don't rebuild the image in the second worktree.** Most workflow changes (TypeScript edits, doc edits, harness edits) don't require a fresh image. Only Python / `Dockerfile` / `pyproject.toml` / `uv.lock` changes do.
2. **Bump `version` in the worktree's `packages/cli/package.json`** to a worktree-local placeholder (e.g. `1.0.0-wt-<slug>`) before running `npm run build:image`. Don't commit the bump — it's a per-worktree convenience.
3. **Run the engine outside Docker** for fast iteration: `cd docker && uv run python -m jentic_scorecard_runner score …` exercises the runner directly, no image build needed.

### Tests across worktrees

`docker/tests/test_main.py` and `docker/tests/test_gate.py` exercise the runner module — no Docker dependency, safe to run concurrently.

`docker/tests/test_integration.py` shells out to `docker run`. Concurrent runs across worktrees are fine *as long as both reference the same image tag* (each `docker run --rm` spins a fresh container). If a worktree has rebuilt at a placeholder tag, set `IMAGE=jentic-api-scorecard:<placeholder>` for that worktree's pytest invocation: `IMAGE=jentic-api-scorecard:wt-foo cd docker && uv run poe test tests/test_integration.py`.
