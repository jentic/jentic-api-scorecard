---
paths:
  - "docker/pyproject.toml"
  - "docker/Dockerfile"
  - "package.json"
  - "packages/*/package.json"
---

When a change touches `docker/pyproject.toml`, `docker/Dockerfile`, the root `package.json`, or any `packages/*/package.json`, and either **adds a library, removes a library, or changes its role in the architecture**, update `specs/tech-stack.md` in the same commit.

Version bumps do NOT require a constitution update — `docker/pyproject.toml`, `docker/uv.lock`, `package.json`, and `package-lock.json` are the version source of truth. Do not re-add version numbers to `specs/tech-stack.md`.

The bar for "belongs in `specs/tech-stack.md`" is: **would swapping this out force an architectural change?**

- **Yes (load-bearing, list in tech-stack.md):** `jentic-apitools-pipelines` + `jentic-apitools-common` (the scoring engine, called in-process), `uv`, Docker multi-stage build, `python:3.12-slim` + `node:24-slim` (engine's `npx` dispatch depends on Node being present in-image), `pytest` (no-mocks invariant), `ruff` (the entire formatting/linting contract), `poethepoet`, `lerna` (fixed-version monorepo orchestration), npm workspaces, `typescript`, ESLint 9 flat config + `typescript-eslint` + `eslint-plugin-import-x` + `eslint-plugin-prettier`, `prettier`, `husky` + `lint-staged` + `@commitlint/cli` + `@commitlint/config-conventional` (commit-hook pipeline), `@redocly/openapi-core` (local-spec bundling — drives the stdin-vs-URL dispatch in §5 of `docs/architecture.md`).
- **No (swappable implementation detail, do NOT list):** CLI argument parsers (`commander` vs `yargs` vs `cac`), filesystem helpers (`rimraf` vs `del`), `@types/*` packages, future HTTP-client picks for the auth validator (`httpx` vs `aiohttp` vs `requests`), JSON-schema validators, glob libraries.

If in doubt, ask the same question again: would replacing it with an equivalent competitor change the shape of the system? If no, leave it out of the constitution. The "What We Are Not Using" and "Roadmap, not yet built" sections of `specs/tech-stack.md` are equally important — when removing a load-bearing library or marking a planned one as shipped, update those sections too.
