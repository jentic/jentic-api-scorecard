# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.10.1](https://github.com/jentic/jentic-api-scorecard/compare/v1.10.0...v1.10.1) (2026-07-21)

### Bug Fixes

- **improve:** correct oasdiff invocation and exit-code contract ([8a52e5e](https://github.com/jentic/jentic-api-scorecard/commit/8a52e5eccb13db5ac43b7637e52b1e17da69a36b)), closes [#303](https://github.com/jentic/jentic-api-scorecard/issues/303)
- **improve:** gate re-score on new validation errors vs baseline ([1314839](https://github.com/jentic/jentic-api-scorecard/commit/1314839e1ae6c428c1f6ff90704ee8fe329eaa3f)), closes [#303](https://github.com/jentic/jentic-api-scorecard/issues/303)

### Features

- **improve:** add change-scope modes + oasdiff to skill ([573e82c](https://github.com/jentic/jentic-api-scorecard/commit/573e82cffd170617cb93d89dfa9e6b9bc0d1b417)), closes [#303](https://github.com/jentic/jentic-api-scorecard/issues/303)
- **improve:** mirror modes + oasdiff into agent and references ([ed59329](https://github.com/jentic/jentic-api-scorecard/commit/ed59329e595b4bcfdae5f31de8ab2802e139ddaf)), closes [#303](https://github.com/jentic/jentic-api-scorecard/issues/303)

# [1.10.0](https://github.com/jentic/jentic-api-scorecard/compare/v1.9.3...v1.10.0) (2026-07-11)

### Bug Fixes

- **extract-docs:** rewrite improve-skill cross-link on extraction ([97bb1d6](https://github.com/jentic/jentic-api-scorecard/commit/97bb1d6af91e2344f6a219f79583d5c819b924a3))
- **extract-docs:** rewrite requirements anchor in improve-skill ([1f02432](https://github.com/jentic/jentic-api-scorecard/commit/1f0243261b4c568a621b5d0ae2be02d819cbd877))
- **score:** make engine tokenUsage opt-in via --report-token-usage ([c542268](https://github.com/jentic/jentic-api-scorecard/commit/c542268b317570bf412dcbdf3cc6534d8d2515dc)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)
- **scripts:** derive benchmark metrics from raw scorecards ([b623161](https://github.com/jentic/jentic-api-scorecard/commit/b623161da21e80e7509af09327d9002a36e9d7b6)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)
- **scripts:** exercise proxy self-check + real plumbing in dry-run ([a84aa55](https://github.com/jentic/jentic-api-scorecard/commit/a84aa55c5349e6a75e47c3aeba703c8bd883ce74)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)
- **scripts:** match raw scorecards by content, not exact name ([c9c15c4](https://github.com/jentic/jentic-api-scorecard/commit/c9c15c4735b47faca68a0ee591516786cc924a6a)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)
- **skill:** guard jentic-api-improve against shipping regressions ([b301395](https://github.com/jentic/jentic-api-scorecard/commit/b301395af9285efdc65a7fc5ec730e5ab60d87d0)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)
- **skills:** make token-usage.json opt-in on explicit request ([d0382ea](https://github.com/jentic/jentic-api-scorecard/commit/d0382eaf874adb0a92905d77ec2a74cd37a1bed2)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)

### Features

- **cli:** add hidden --report-token-usage flag ([dfad477](https://github.com/jentic/jentic-api-scorecard/commit/dfad477bbc45846fa4da432f0871bfc83bc5fb6a)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)
- **scripts:** add benchmark results data-file sample fixture ([0b1a3be](https://github.com/jentic/jentic-api-scorecard/commit/0b1a3be4dc0be4ae205fe799fa71a2f99ec1f5d4)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)
- **scripts:** add improve-benchmark matrix driver + dry-run ([ffd3750](https://github.com/jentic/jentic-api-scorecard/commit/ffd3750cefa614e176718cc0fcc8cf44dc7b4248)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)
- **scripts:** add token-counting proxy for engine LLM spend ([d7c3890](https://github.com/jentic/jentic-api-scorecard/commit/d7c389095e3ee624ec00d61db8a9b6531c4f2b6e)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)
- **scripts:** benchmark 6 default specs, --specs, output dir ([1a42db1](https://github.com/jentic/jentic-api-scorecard/commit/1a42db1b0db8beb35a8ec5ead12195490cbff1c9)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)
- **scripts:** capture + render score before/after + iters ([c210984](https://github.com/jentic/jentic-api-scorecard/commit/c210984c3d8f601a111ccfd3d307084113e744f1)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)
- **scripts:** implement real benchmark measurement run ([be3ded4](https://github.com/jentic/jentic-api-scorecard/commit/be3ded40a67dd4b95e2d94ab7115e8d8f6f83be3)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)
- **scripts:** render benchmark doc from results data file ([cc3ed72](https://github.com/jentic/jentic-api-scorecard/commit/cc3ed72dc4f3656c50bcd4971190494c456e44e7)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)
- **scripts:** request engine token usage in benchmark prompt ([4aaceb5](https://github.com/jentic/jentic-api-scorecard/commit/4aaceb5d4b6e5694b266612cc5d67518251ee43d)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)
- **scripts:** sample benchmark cells N times, report median + range ([d480d69](https://github.com/jentic/jentic-api-scorecard/commit/d480d69d8831787219794db8f9a7456b8532668f)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)
- **skills:** emit benchmark-summary.json with run outcome ([7ae3dae](https://github.com/jentic/jentic-api-scorecard/commit/7ae3dae2603662a245c5d66470d25e50b4b5953a)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)
- **skills:** emit token-usage.json from engine tokenUsage ([2424387](https://github.com/jentic/jentic-api-scorecard/commit/2424387fc47ebeaef44a07e16b8ebde57426d602)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)

### Performance Improvements

- **scripts:** run benchmark samples concurrently, isolated per cwd ([30df98d](https://github.com/jentic/jentic-api-scorecard/commit/30df98d0d0a4e059d2c3de1521fcbd3994a0bcc6)), closes [#284](https://github.com/jentic/jentic-api-scorecard/issues/284)

## [1.9.3](https://github.com/jentic/jentic-api-scorecard/compare/v1.9.2...v1.9.3) (2026-07-01)

### Bug Fixes

- **publish-to-docs:** fix checkout of existing remote branch ([f08a53a](https://github.com/jentic/jentic-api-scorecard/commit/f08a53a0613ec627cd5714f7ddf3801efbb0c2a5))
- **skills:** bind rmtree path to a var to clear SkillSpector ([48f8514](https://github.com/jentic/jentic-api-scorecard/commit/48f8514e9d270990169c0f151d171243d17846d0)), closes [#267](https://github.com/jentic/jentic-api-scorecard/issues/267)

### Features

- **marketplace:** add api-improve plugin (skill + agent) ([476348a](https://github.com/jentic/jentic-api-scorecard/commit/476348aa5174fa44e4a6b4c1ed630126cf29b91c)), closes [#267](https://github.com/jentic/jentic-api-scorecard/issues/267)

## [1.9.2](https://github.com/jentic/jentic-api-scorecard/compare/v1.9.1...v1.9.2) (2026-06-24)

### Bug Fixes

- **docker:** detect daemon-not-running and show friendly message ([#236](https://github.com/jentic/jentic-api-scorecard/issues/236)) ([fa02592](https://github.com/jentic/jentic-api-scorecard/commit/fa025921bd980e7dc1d0ae105856bdce8a696d87)), closes [#224](https://github.com/jentic/jentic-api-scorecard/issues/224)

## [1.9.1](https://github.com/jentic/jentic-api-scorecard/compare/v1.9.0...v1.9.1) (2026-06-22)

### Bug Fixes

- **docker:** patch undici CVE-2026-12151 in image ([#230](https://github.com/jentic/jentic-api-scorecard/issues/230)) ([fa96270](https://github.com/jentic/jentic-api-scorecard/commit/fa96270a26b83071f708e744b65169c9289ed052)), closes [#321](https://github.com/jentic/jentic-api-scorecard/issues/321) [#322](https://github.com/jentic/jentic-api-scorecard/issues/322)

### Features

- **docs:** add automated docs publishing to jentic-docs ([38c82cf](https://github.com/jentic/jentic-api-scorecard/commit/38c82cf50b54145d8893415726aa4746d7acea2b))

# [1.9.0](https://github.com/jentic/jentic-api-scorecard/compare/v1.8.7...v1.9.0) (2026-06-19)

### Features

- **action:** map SARIF pointers to real source line/column range ([#218](https://github.com/jentic/jentic-api-scorecard/issues/218)) ([fbddd6b](https://github.com/jentic/jentic-api-scorecard/commit/fbddd6b56fd38d3c373c12d2fe672d7043351a37)), closes [#191](https://github.com/jentic/jentic-api-scorecard/issues/191)

## [1.8.7](https://github.com/jentic/jentic-api-scorecard/compare/v1.8.6...v1.8.7) (2026-06-18)

### Bug Fixes

- **action:** show source origin in SARIF location for URL inputs ([#208](https://github.com/jentic/jentic-api-scorecard/issues/208)) ([c327bc2](https://github.com/jentic/jentic-api-scorecard/commit/c327bc2a778d8373f7cf01f1dc0f279014fd9396)), closes [#200](https://github.com/jentic/jentic-api-scorecard/issues/200)

## [1.8.6](https://github.com/jentic/jentic-api-scorecard/compare/v1.8.5...v1.8.6) (2026-06-17)

### Bug Fixes

- **action:** meet marketplace description cap and brand color ([#202](https://github.com/jentic/jentic-api-scorecard/issues/202)) ([82c4d85](https://github.com/jentic/jentic-api-scorecard/commit/82c4d857f7a99511ba50463271c2e6519d1f8499))
- **README:** render header badges inline on marketplace ([#203](https://github.com/jentic/jentic-api-scorecard/issues/203)) ([bbe768e](https://github.com/jentic/jentic-api-scorecard/commit/bbe768e23151675461f75fa392eb0d7838cccdba))

## [1.8.5](https://github.com/jentic/jentic-api-scorecard/compare/v1.8.4...v1.8.5) (2026-06-17)

### Bug Fixes

- **cli:** show friendly message when docker is missing ([#192](https://github.com/jentic/jentic-api-scorecard/issues/192)) ([b860a07](https://github.com/jentic/jentic-api-scorecard/commit/b860a07ace22c0f77b775a9361b3cbdbbdb3e6f3)), closes [#183](https://github.com/jentic/jentic-api-scorecard/issues/183)

## [1.8.4](https://github.com/jentic/jentic-api-scorecard/compare/v1.8.3...v1.8.4) (2026-06-17)

### Bug Fixes

- **action:** float major tag so README example tracks releases ([#201](https://github.com/jentic/jentic-api-scorecard/issues/201)) ([862efac](https://github.com/jentic/jentic-api-scorecard/commit/862efaccfa18e017b20205a027280473162035da))

## [1.8.3](https://github.com/jentic/jentic-api-scorecard/compare/v1.8.2...v1.8.3) (2026-06-17)

### Bug Fixes

- **release:** fix failed v1.8.2 release ([3215d44](https://github.com/jentic/jentic-api-scorecard/commit/3215d44fd565c619cf9d11256b3e35079f0d388a))

## [1.8.2](https://github.com/jentic/jentic-api-scorecard/compare/v1.8.1...v1.8.2) (2026-06-17)

### Bug Fixes

- **release:** fix failed v1.8.1 release ([4328da7](https://github.com/jentic/jentic-api-scorecard/commit/4328da77db7dd3c4bbe236665e29ddc370b15251))

## [1.8.1](https://github.com/jentic/jentic-api-scorecard/compare/v1.8.0...v1.8.1) (2026-06-17)

### Bug Fixes

- **action:** anchor postprocess npm install to action/ dir ([#198](https://github.com/jentic/jentic-api-scorecard/issues/198)) ([41a7ae9](https://github.com/jentic/jentic-api-scorecard/commit/41a7ae92dad77f1a4836d0f409286c637cdf82f2)), closes [#190](https://github.com/jentic/jentic-api-scorecard/issues/190)

# [1.8.0](https://github.com/jentic/jentic-api-scorecard/compare/v1.7.0...v1.8.0) (2026-06-17)

### Features

- add GitHub Action for CI scoring ([#190](https://github.com/jentic/jentic-api-scorecard/issues/190)) ([51a6cc8](https://github.com/jentic/jentic-api-scorecard/commit/51a6cc8caf24b342c9c0e0ef55a429d6f12a746e)), closes [#191](https://github.com/jentic/jentic-api-scorecard/issues/191)

# [1.7.0](https://github.com/jentic/jentic-api-scorecard/compare/v1.6.0...v1.7.0) (2026-06-15)

### Features

- **cli:** add --format sarif diagnostics encoder ([#182](https://github.com/jentic/jentic-api-scorecard/issues/182)) ([9d7b41b](https://github.com/jentic/jentic-api-scorecard/commit/9d7b41b587cfa04ce28b6f60dcfb884e458052ff)), closes [#176](https://github.com/jentic/jentic-api-scorecard/issues/176)

# [1.6.0](https://github.com/jentic/jentic-api-scorecard/compare/v1.5.2...v1.6.0) (2026-06-15)

### Features

- **cli:** add --format markdown GFM scorecard formatter ([#181](https://github.com/jentic/jentic-api-scorecard/issues/181)) ([94a6667](https://github.com/jentic/jentic-api-scorecard/commit/94a666700f023fd73930d8d76c784ac15e80da65))

## [1.5.2](https://github.com/jentic/jentic-api-scorecard/compare/v1.5.1...v1.5.2) (2026-06-11)

### Bug Fixes

- **score:** correct schema depth via jentic-apitools 1.0.0a18 ([#167](https://github.com/jentic/jentic-api-scorecard/issues/167)) ([8ac0c71](https://github.com/jentic/jentic-api-scorecard/commit/8ac0c71fb67f8631838467b1d2eb3bc48aebf4f6))

## [1.5.1](https://github.com/jentic/jentic-api-scorecard/compare/v1.5.0...v1.5.1) (2026-06-11)

### Features

- **plugin:** add Claude Code plugin marketplace ([#162](https://github.com/jentic/jentic-api-scorecard/issues/162)) ([58db2fe](https://github.com/jentic/jentic-api-scorecard/commit/58db2fe527c60a612c8a0a84faad2e58ac79ebd8))

# [1.5.0](https://github.com/jentic/jentic-api-scorecard/compare/v1.4.3...v1.5.0) (2026-06-11)

### Features

- **skills:** agent-skill distribution for the CLI ([#158](https://github.com/jentic/jentic-api-scorecard/issues/158)) ([d2b9df2](https://github.com/jentic/jentic-api-scorecard/commit/d2b9df29f87e9e065910fcef0f8ac532eb3cc622))

## [1.4.3](https://github.com/jentic/jentic-api-scorecard/compare/v1.4.2...v1.4.3) (2026-06-10)

### Bug Fixes

- **release:** fix failed v1.4.2 release ([68d2356](https://github.com/jentic/jentic-api-scorecard/commit/68d2356c77b183ebe625b9da6e673de8ac2269de))

## [1.4.2](https://github.com/jentic/jentic-api-scorecard/compare/v1.4.1...v1.4.2) (2026-06-10)

### Bug Fixes

- **docker:** patch CVE-2026-45447 by bumping openssl ([#157](https://github.com/jentic/jentic-api-scorecard/issues/157)) ([bbeb44d](https://github.com/jentic/jentic-api-scorecard/commit/bbeb44d9a5d6132c4474ec761096b10442f8aae2))

## [1.4.1](https://github.com/jentic/jentic-api-scorecard/compare/v1.4.0...v1.4.1) (2026-06-10)

### Bug Fixes

- **gate:** point key links at stable app.jentic.com URL ([#149](https://github.com/jentic/jentic-api-scorecard/issues/149)) ([b2f7ab8](https://github.com/jentic/jentic-api-scorecard/commit/b2f7ab8b66b79468e347f9d98181a5f4139a6650)), closes [#126](https://github.com/jentic/jentic-api-scorecard/issues/126)

# [1.4.0](https://github.com/jentic/jentic-api-scorecard/compare/v1.3.0...v1.4.0) (2026-06-08)

### Features

- **cli:** fail with exit 8 when --with-llm analysis fails ([#144](https://github.com/jentic/jentic-api-scorecard/issues/144)) ([2d38433](https://github.com/jentic/jentic-api-scorecard/commit/2d38433659bdc06fc15d6d531dcdaa3c1f610883)), closes [#142](https://github.com/jentic/jentic-api-scorecard/issues/142)

# [1.3.0](https://github.com/jentic/jentic-api-scorecard/compare/v1.2.1...v1.3.0) (2026-06-08)

### Features

- **formatter-html:** show score/100 with grade in summary card ([#143](https://github.com/jentic/jentic-api-scorecard/issues/143)) ([f394732](https://github.com/jentic/jentic-api-scorecard/commit/f3947328598bca8f0935a56e2ac2beb498b1b918))

## [1.2.1](https://github.com/jentic/jentic-api-scorecard/compare/v1.2.0...v1.2.1) (2026-06-05)

### Bug Fixes

- **release:** fix SBOM generation for CLI ([39360c7](https://github.com/jentic/jentic-api-scorecard/commit/39360c728f6d357debc32ed22f40ae9e78d3ac1e))

# [1.2.0](https://github.com/jentic/jentic-api-scorecard/compare/v1.1.0...v1.2.0) (2026-06-05)

### Features

- **cli:** add --format html backed by the formatter-html package ([#134](https://github.com/jentic/jentic-api-scorecard/issues/134)) ([3cbfbb7](https://github.com/jentic/jentic-api-scorecard/commit/3cbfbb718e356726a4a48a581af14416b21b9903))

# [1.1.0](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.1...v1.1.0) (2026-06-05)

### Features

- **formatter-html:** implement HTML scorecard renderer ([#133](https://github.com/jentic/jentic-api-scorecard/issues/133)) ([d0372e1](https://github.com/jentic/jentic-api-scorecard/commit/d0372e16808f47824854d2839a30e199d8e18986))

## [1.0.1](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0...v1.0.1) (2026-06-04)

### Bug Fixes

- **cli:** capture container stderr to keep spinner intact ([#125](https://github.com/jentic/jentic-api-scorecard/issues/125)) ([f649cb6](https://github.com/jentic/jentic-api-scorecard/commit/f649cb6fffcd8497e7142c0355d12752215b9324)), closes [#107](https://github.com/jentic/jentic-api-scorecard/issues/107)

# [1.0.0](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.29...v1.0.0) (2026-06-04)

### Features

- graduate to stable 1.0.0 with [@latest](https://github.com/latest) npm dist-tag ([#106](https://github.com/jentic/jentic-api-scorecard/issues/106)) ([0942b05](https://github.com/jentic/jentic-api-scorecard/commit/0942b0547cdf0461295507460e9f1a54198389bf)), closes [#115](https://github.com/jentic/jentic-api-scorecard/issues/115) [#114](https://github.com/jentic/jentic-api-scorecard/issues/114) [#114](https://github.com/jentic/jentic-api-scorecard/issues/114) [#115](https://github.com/jentic/jentic-api-scorecard/issues/115)

### BREAKING CHANGES

- `JENTIC_API_KEY=mvp-preview` is no longer recognized.
  Sign up at https://jentic.com/signup for a real key.

# [1.0.0-alpha.29](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.28...v1.0.0-alpha.29) (2026-06-02)

### Bug Fixes

- **gate:** warn on unexpected validator result; sync exit-code list ([57de79b](https://github.com/jentic/jentic-api-scorecard/commit/57de79b0458565728c25fb26be4dc3ca7bd1a20b))

### Features

- **gate:** validate real keys live and enforce rate limits ([09bfeb7](https://github.com/jentic/jentic-api-scorecard/commit/09bfeb7516a855283dbed5edc5cd0af5dfaf3fb8))

# [1.0.0-alpha.28](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.27...v1.0.0-alpha.28) (2026-06-01)

### Features

- **score:** call engine pipeline in-process, drop apitools-cli ([#98](https://github.com/jentic/jentic-api-scorecard/issues/98)) ([1170b5f](https://github.com/jentic/jentic-api-scorecard/commit/1170b5fb8a12307299f1d53bac257d0a8e0de440)), closes [#92](https://github.com/jentic/jentic-api-scorecard/issues/92)

# [1.0.0-alpha.27](https://github.com/jentic/jentic-api-scorecard/compare/v1.0.0-alpha.26...v1.0.0-alpha.27) (2026-05-27)

### Features

- **cli:** add --bundle for host-side fetch + bundling ([#89](https://github.com/jentic/jentic-api-scorecard/issues/89)) ([229edb3](https://github.com/jentic/jentic-api-scorecard/commit/229edb3847eb118d630019733a36292d8b8608f2))

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
