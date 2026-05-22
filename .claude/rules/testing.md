## Testing

This repo has **one** test suite today: pytest in `docker/tests/`. It covers the Python runner that wraps `jentic-apitools-cli`. There are no JS/TS tests yet — `packages/` ships scaffolding plus the Phase 2 CLI smoke; suites land when behavior lands.

- **Runner unit / behavior**: `docker/tests/test_main.py`, `docker/tests/test_gate.py` exercise the runner module directly. These are the boundary the CLI's contract is defined at — gate decisions, exit codes, stdin/URL dispatch.
- **Image-level integration**: `docker/tests/test_integration.py` runs a built Docker image end-to-end via `subprocess.run(["docker", "run", ...])`. Defaults to `jentic-api-scorecard:dev`; honors `IMAGE=<other-tag>` to point at a published GHCR image.
- **No mocking.** Tests hit the real gate, the real engine, the real Docker image. Environment is manipulated with pytest's `monkeypatch`. This rule is load-bearing — see `specs/tech-stack.md` and `.claude/CLAUDE.md`.
- **CI**: `.github/workflows/ci.yml` runs `cd docker && uv sync --frozen` then `uv run poe lint:ci` and `uv run poe test` on every PR. No path filters.

### When to run

Run tests when your change could affect behavior covered by a suite. Skip them for pure docs, harness configs (`.claude/`), or `packages/` work that no Python test touches.

- Changed anything in `docker/src/` or `docker/tests/` → run pytest (`cd docker && uv run poe test`).
- Changed `docker/Dockerfile`, `docker/pyproject.toml`, or `docker/uv.lock` → rebuild the image (`docker build -t jentic-api-scorecard:dev ./docker`) and run the integration subset.
- Changed only `packages/`, `docs/`, `specs/`, `.claude/`, or root configs → no Python tests required.

If unsure whether a change is behavior-affecting, run the relevant subset.

### Integration test prerequisite

`test_integration.py` needs a built image. Before running it locally:

```
docker build -t jentic-api-scorecard:dev ./docker
```

Then run the subset directly:

```
cd docker && uv run poe test tests/test_integration.py
```

To exercise a published image instead of a local build, set `IMAGE`: `IMAGE=ghcr.io/jentic/jentic-api-scorecard:unstable cd docker && uv run poe test tests/test_integration.py`.

### Commands

See `.claude/CLAUDE.md` ("Common commands") for the canonical list. The relevant entries are `cd docker && uv run poe test` (full suite) and `cd docker && uv run poe test tests/<file>.py` (subset).
