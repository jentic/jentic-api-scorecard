## Testing

This repo has two test suites: pytest in `docker/tests/` (Python runner) and mocha in `packages/cli/test/` (TypeScript CLI). Both follow the same no-mocking rule.

- **Runner unit / behavior (Python)**: `docker/tests/test_main.py`, `docker/tests/test_gate.py` exercise the runner module directly. These are the boundary the CLI's contract is defined at — gate decisions, exit codes, stdin/URL dispatch.
- **Image-level integration (Python)**: `docker/tests/test_integration.py` runs a built Docker image end-to-end via `subprocess.run(["docker", "run", ...])`. Defaults to `jentic-api-scorecard:dev`; honors `IMAGE=<other-tag>` to point at a published GHCR image.
- **CLI unit (JS/TS)**: `packages/cli/test/formatters/pretty.test.ts`, `packages/cli/test/detail.test.ts`, `packages/cli/test/exit-codes.test.ts`. Pure-logic assertions against `packages/cli/test/fixtures/scorecard.sample.json` — a real engine output captured once via `docker run`. Catches chalk regressions, engine JSON shape drift, column-alignment regressions, `--detail` projection drift, and exit-code contract drift.
- **CLI e2e (JS/TS)**: `packages/cli/test/e2e/score.e2e.test.ts` spawns `node packages/cli/bin/jentic-api-scorecard.mjs score …` so the test exercises the full stack: CLI → docker run → container → formatted output. Requires the local docker image at the matching `cli-version` tag. Run with `npm run test:e2e` from the repo root — the root script chains `build` + `build:image` + `lerna run test:e2e` so prerequisites are always satisfied. Excluded from `npm test` (the unit `.mocharc.json` ignores `test/e2e/**`).
- **No mocking.** Python tests hit the real gate, the real engine, the real Docker image. JS/TS unit tests assert against fixtures captured from the real engine; JS/TS e2e tests spawn the real CLI against a real image — never hand-mocked shapes. Environment is manipulated with pytest's `monkeypatch` on the Python side. This rule is load-bearing — see `specs/tech-stack.md` and `.claude/CLAUDE.md`.
- **CI**: `.github/workflows/ci.yml` runs `python-lint` + `python-test` (`cd docker && uv sync --frozen` → `uv run poe lint:ci` / `uv run poe test`), plus `typescript-lint` + `typescript-build` + `typescript-test` + `test-e2e` (`npm ci` → `npm run lint` / `npx lerna run build:typescript` / `npm test` / build CLI + buildx-cached image + `npx lerna run test:e2e`) on every PR. No path filters. The `test-e2e` job uses `docker/build-push-action@v7` with `cache-from: type=gha, cache-to: type=gha,mode=max` so unchanged docker layers are reused across PRs.

### When to run

Run tests when your change could affect behavior covered by a suite. Skip them for pure docs, harness configs (`.claude/`), or `packages/` work that no Python test touches.

- Changed anything in `docker/src/` or `docker/tests/` → run pytest (`cd docker && uv run poe test`).
- Changed `docker/Dockerfile`, `docker/pyproject.toml`, or `docker/uv.lock` → rebuild the image (`docker build -t jentic-api-scorecard:dev ./docker`) and run the integration subset.
- Changed anything in `packages/cli/src/` or `packages/cli/test/` → run mocha (`npm test -w @jentic/api-scorecard-cli`).
- Changed orchestration code in `packages/cli/src/` (`commands/score.ts`, `docker.ts`, `bundle.ts`, `index.ts`) or anything in `docker/src/` → also run e2e (`npm run test:e2e` from the repo root). The script chains `build` (TypeScript) and `build:image` (docker) before mocha.
- Changed only `docs/`, `specs/`, `.claude/`, or root configs → no test suites required.

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

See `.claude/CLAUDE.md` ("Common commands") for the canonical list. The relevant entries are `cd docker && uv run poe test` (Python full suite), `cd docker && uv run poe test tests/<file>.py` (Python subset), and `npm test` (JS/TS full suite — delegates via `lerna run test`).
