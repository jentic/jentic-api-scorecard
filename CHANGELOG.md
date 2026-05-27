# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.0.0-alpha.26](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.25...v1.0.0-alpha.26) (2026-05-27)

### Bug Fixes

- **cli:** show '✔ Scoring done' above the report ([#87](https://github.com/jentic/jentic-api-scorecard/issues/87)) ([fa948ee](https://github.com/jentic/jentic-api-scorecard/commit/fa948ee249cc0acbcd957f7d46ff6722ad4ec364)), closes [#84](https://github.com/jentic/jentic-api-scorecard/issues/84)

# [1.0.0-alpha.25](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.24...v1.0.0-alpha.25) (2026-05-27)

### Features

- **cli:** add -q/--quiet to suppress the stderr spinner ([#83](https://github.com/jentic/jentic-api-scorecard/issues/83)) ([8171496](https://github.com/jentic/jentic-api-scorecard/commit/81714964626127e83b4d6f2ae960e86ba14377dd))

# [1.0.0-alpha.24](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.23...v1.0.0-alpha.24) (2026-05-26)

### Features

- **cli:** add -o/--output to write report to file ([#77](https://github.com/jentic/jentic-api-scorecard/issues/77)) ([f596734](https://github.com/jentic/jentic-api-scorecard/commit/f5967344de8f0e2b8930f828a09bbc9d1c14110f))

# [1.0.0-alpha.23](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.22...v1.0.0-alpha.23) (2026-05-26)

### Bug Fixes

- **cli:** validate engine output shape, not just JSON syntax ([#56](https://github.com/jentic/jentic-api-scorecard/issues/56)) ([7d10201](https://github.com/jentic/jentic-api-scorecard/commit/7d102018015d96b1555f1b14902c99fb19bc8101)), closes [#55](https://github.com/jentic/jentic-api-scorecard/issues/55)

### Features

- **cli:** add -f short flag for --format ([#57](https://github.com/jentic/jentic-api-scorecard/issues/57)) ([e6bf510](https://github.com/jentic/jentic-api-scorecard/commit/e6bf510415d029670b70b6e518bf449373f78f73))

# [1.0.0-alpha.22](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.21...v1.0.0-alpha.22) (2026-05-26)

### Features

- **cli:** ship --format json (phase 6) ([#52](https://github.com/jentic/jentic-api-scorecard/issues/52)) ([fda9084](https://github.com/jentic/jentic-api-scorecard/commit/fda9084157c262e3adc87f8ca0f61b1e59a9f95d)), closes [#53](https://github.com/jentic/jentic-api-scorecard/issues/53) [#51](https://github.com/jentic/jentic-api-scorecard/issues/51)

# [1.0.0-alpha.21](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.20...v1.0.0-alpha.21) (2026-05-25)

### Bug Fixes

- **ci:** strip devDependencies before SBOM generation ([#49](https://github.com/jentic/jentic-api-scorecard/issues/49)) ([00b801d](https://github.com/jentic/jentic-api-scorecard/commit/00b801db04b23295811ecce2dc13bb800988d4b8)), closes [#25](https://github.com/jentic/jentic-api-scorecard/issues/25)

# [1.0.0-alpha.20](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.19...v1.0.0-alpha.20) (2026-05-25)

### Features

- **cli:** add support for LLM-based signals ([#48](https://github.com/jentic/jentic-api-scorecard/issues/48)) ([efdcb97](https://github.com/jentic/jentic-api-scorecard/commit/efdcb971f662a9f2789f4d62717428d79e4b4077))

# [1.0.0-alpha.19](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.18...v1.0.0-alpha.19) (2026-05-25)

### Bug Fixes

- **release:** gate release on full ci suite ([#46](https://github.com/jentic/jentic-api-scorecard/issues/46)) ([70ff9f5](https://github.com/jentic/jentic-api-scorecard/commit/70ff9f5b6fb0e8f995120c0726c17796448b4d3b)), closes [#23](https://github.com/jentic/jentic-api-scorecard/issues/23)

# [1.0.0-alpha.18](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.17...v1.0.0-alpha.18) (2026-05-24)

### Bug Fixes

- **release:** push docker image before cli npm tarball ([38d9191](https://github.com/jentic/jentic-api-scorecard/commit/38d91919fa9fb7aa951549a92f519ef1ffae2402))

# [1.0.0-alpha.17](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.16...v1.0.0-alpha.17) (2026-05-24)

### Features

- **docker:** add support for unprivileged mode ([270b1c9](https://github.com/jentic/jentic-api-scorecard/commit/270b1c9775091a2dd7d9242a549451c60b1eef94))

# [1.0.0-alpha.16](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.15...v1.0.0-alpha.16) (2026-05-24)

### Features

- **dockerfile:** split build/runtime, drop uv from runtime ([#38](https://github.com/jentic/jentic-api-scorecard/issues/38)) ([bdc96c6](https://github.com/jentic/jentic-api-scorecard/commit/bdc96c648ae5709782e4d8e9b7b574d9183baacf))

# [1.0.0-alpha.15](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.14...v1.0.0-alpha.15) (2026-05-24)

### Bug Fixes

- **docker-publish:** annotate index with OCI metadata ([#37](https://github.com/jentic/jentic-api-scorecard/issues/37)) ([b141d45](https://github.com/jentic/jentic-api-scorecard/commit/b141d45531cf0839a2e8b74f07b47c4ecf32faa4))

# [1.0.0-alpha.14](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.13...v1.0.0-alpha.14) (2026-05-24)

### Bug Fixes

- **dockerfile:** add OCI image labels ([#36](https://github.com/jentic/jentic-api-scorecard/issues/36)) ([72a9d5a](https://github.com/jentic/jentic-api-scorecard/commit/72a9d5a319852786718e3e20f8dcc880e8dbd52a))

# [1.0.0-alpha.13](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.12...v1.0.0-alpha.13) (2026-05-24)

### Bug Fixes

- **release:** widen tarball retry to handle slow CDN writes ([#34](https://github.com/jentic/jentic-api-scorecard/issues/34)) ([844d178](https://github.com/jentic/jentic-api-scorecard/commit/844d1788de03ae39ebe39a788bb81179d7453fca))

# [1.0.0-alpha.12](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.11...v1.0.0-alpha.12) (2026-05-24)

### Bug Fixes

- **docker-publish:** resolve per-platform digests from registry index ([#33](https://github.com/jentic/jentic-api-scorecard/issues/33)) ([f0daee3](https://github.com/jentic/jentic-api-scorecard/commit/f0daee3771eb9a728261f74f44b7a382f0fb8cdc))

# [1.0.0-alpha.11](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.10...v1.0.0-alpha.11) (2026-05-24)

### Bug Fixes

- **release:** use tarball CDN for SBOM attestation download ([#30](https://github.com/jentic/jentic-api-scorecard/issues/30)) ([5e6ce44](https://github.com/jentic/jentic-api-scorecard/commit/5e6ce442f2940de8dc25f98873eddad5a9ab4365))

# [1.0.0-alpha.10](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.9...v1.0.0-alpha.10) (2026-05-24)

### Bug Fixes

- **release:** widen npm pack retry budget for CDN propagation ([#29](https://github.com/jentic/jentic-api-scorecard/issues/29)) ([84d636b](https://github.com/jentic/jentic-api-scorecard/commit/84d636b887de4824be440bdd1b9cf3991e0c7036))

# [1.0.0-alpha.9](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.8...v1.0.0-alpha.9) (2026-05-24)

### Bug Fixes

- **release:** attest the registry-served tarball ([#28](https://github.com/jentic/jentic-api-scorecard/issues/28)) ([d72dc5f](https://github.com/jentic/jentic-api-scorecard/commit/d72dc5fca400d8a1b78b88c70301fb82f028847e)), closes [#27](https://github.com/jentic/jentic-api-scorecard/issues/27)

# [1.0.0-alpha.8](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.7...v1.0.0-alpha.8) (2026-05-24)

### Bug Fixes

- **release:** pack and attest before lerna publish ([#27](https://github.com/jentic/jentic-api-scorecard/issues/27)) ([430e5cd](https://github.com/jentic/jentic-api-scorecard/commit/430e5cd2d716888e0ca143888cc8c9e5818adedf))

# [1.0.0-alpha.7](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.6...v1.0.0-alpha.7) (2026-05-24)

### Features

- **release:** attest SPDX SBOM for the CLI tarball ([#26](https://github.com/jentic/jentic-api-scorecard/issues/26)) ([597a28d](https://github.com/jentic/jentic-api-scorecard/commit/597a28dc7f75cd0427268cc3fcee33606c469da0))

# [1.0.0-alpha.6](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.5...v1.0.0-alpha.6) (2026-05-23)

### Bug Fixes

- **ci:** use package URL in npm-release env ([23670d0](https://github.com/jentic/jentic-api-scorecard/commit/23670d07022d3bd81591e795df1fd6fdbc753ea2)), closes [#20](https://github.com/jentic/jentic-api-scorecard/issues/20)

# [1.0.0-alpha.5](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.4...v1.0.0-alpha.5) (2026-05-23)

### Bug Fixes

- **release:** remove dist-tag alignment step ([516f7e9](https://github.com/jentic/jentic-api-scorecard/commit/516f7e9bf2b9161e4fcb850dd30516847fdc357e))
- **release:** remove dist-tag alignment step ([f434efd](https://github.com/jentic/jentic-api-scorecard/commit/f434efdb5df89b551522671e169c025f458b84c8))

# [1.0.0-alpha.4](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.3...v1.0.0-alpha.4) (2026-05-23)

### Bug Fixes

- **release:** remove dist-tag alignment step ([#22](https://github.com/jentic/jentic-api-scorecard/issues/22)) ([e284923](https://github.com/jentic/jentic-api-scorecard/commit/e284923e93905985a9ac1ab8762cb66ec22ee849))

# [1.0.0-alpha.3](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.2...v1.0.0-alpha.3) (2026-05-23)

**Note:** Version bump only for package jentic-api-scorecard-monorepo

# [1.0.0-alpha.2](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.1...v1.0.0-alpha.2) (2026-05-23)

### Bug Fixes

- **release:** fix failed 1.0.0-alpha.1 release ([6047f20](https://github.com/jentic/jentic-api-scorecard/commit/6047f20ef965aa3a14604a96252c4d58c096f60a))

# 1.0.0-alpha.1 (2026-05-23)

### Features

- alpha release CI + Pulling spinner + README rewrite ([#18](https://github.com/jentic/jentic-api-scorecard/issues/18)) ([805e417](https://github.com/jentic/jentic-api-scorecard/commit/805e417fd336cf0455912633fe4d53e04a83444d)), closes [#12](https://github.com/jentic/jentic-api-scorecard/issues/12)
- **cli:** add --detail level filtering for score output ([#14](https://github.com/jentic/jentic-api-scorecard/issues/14)) ([7b6196a](https://github.com/jentic/jentic-api-scorecard/commit/7b6196ae3299162f502940f3e93673f8d4e1c01a))
- **cli:** add pretty formatter and stderr spinner ([#10](https://github.com/jentic/jentic-api-scorecard/issues/10)) ([358568e](https://github.com/jentic/jentic-api-scorecard/commit/358568e5785c182122ece5f7811421242011e0a2))
- **cli:** scaffold packages/ and ship first end-to-end score smoke ([#5](https://github.com/jentic/jentic-api-scorecard/issues/5)) ([eec65c6](https://github.com/jentic/jentic-api-scorecard/commit/eec65c6be10998d726e87a6364c92f379154dda2))
- **harness:** add eslint, prettier, husky, commitlint, lint-staged ([#6](https://github.com/jentic/jentic-api-scorecard/issues/6)) ([2c5c8b4](https://github.com/jentic/jentic-api-scorecard/commit/2c5c8b4533a3817e25e4cc54c8c700163173449a))
- implement docker/ scoring runner ([#2](https://github.com/jentic/jentic-api-scorecard/issues/2)) ([2f18f21](https://github.com/jentic/jentic-api-scorecard/commit/2f18f2105d4798f9993c97e83ba89a39cfe3c1b6))
