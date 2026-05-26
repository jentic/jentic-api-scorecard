# Phase 6 Requirements — JSON formatter (`--format json`)

## Scope

Phase 6 reintroduces machine-readable JSON output to the npm CLI through a new `--format <pretty|json>` flag. `pretty` stays the unconditional default; `--format json` produces engine-verbatim JSON, pretty-printed with 2-space indentation, filtered by the existing `--detail` level so a CI integrator can pipe `score … --format json | jq .summary.score` and gate on the result.

The phase also restores the `--format json --detail diagnostics` footer hint that was removed from the pretty formatter's `appendHint()` in commit `337b55e` (a deliberate Phase 5 stop-gap so the formatter never recommended an unimplemented flag). Once Phase 6 ships the flag, the hint becomes a live, working recommendation again — restoring the canonical sample output documented at `docs/architecture.md:34`.

## Out of Scope

- **TTY-aware default switching.** `docs/architecture.md` §5 currently says "json is the default when stdout is not a TTY (piped/redirected)"; the roadmap bullet says "Default stays `pretty`." This phase honors the roadmap-literal reading: `pretty` is the default regardless of stdout TTY status. The architecture-doc text is dialed back in this same PR to match.
- **`--json` convenience alias.** `docs/architecture.md` §5 line 164 documents `--json` as an alias for `--format json`. The roadmap bullet does not mention it. Deferred; the architecture doc is updated in this PR to mark `--json` as deferred.
- **`-f` short flag.** Same rationale as `--json` — documented in architecture §5 but not in the roadmap bullet. Deferred to a later doc-alignment phase.
- **`-o FILE`.** Phase 8.
- **`--quiet` / `--verbose`.** Phases 9 / 7.
- **`--format markdown`.** Listed under Later Phases in `specs/roadmap.md:222`. Commander rejects it as an invalid choice.
- **`--format html`.** Phase 14. Commander rejects it as an invalid choice.
- **`--min-score N` and any new exit code.** Later Phases. Phase 6 unblocks manual `jq`-based gating but does not implement a built-in gate.
- **Container-side changes.** Phase 6 is host-CLI-only. The container already emits engine-verbatim JSON via `jentic-apitools score --format json --include-diagnostics --quiet` (`docs/architecture.md:510`). No image rebuild.
- **JSON schema validation in the CLI.** `docs/architecture.md` §10 explicitly defers this. The formatter is `JSON.stringify(filtered, null, 2)` — no validation.
- **Snapshot tests of the entire JSON byte-stream.** Engine version drift would break a strict-snapshot test on every engine bump. Tests assert *shape* (top-level keys, projection rules) and a small set of *verbatim values* (engine version string, fixture's `summary.score`, dimension `kind`s) — not bit-for-bit equality.

## Decisions

### Roadmap-literal interpretation of the default

`pretty` is the unconditional default for `--format`. There is no TTY-aware fallback to `json`. The rationale: the roadmap bullet states "Default stays `pretty`" plainly, and matching `--detail`'s commander-driven default keeps the CLI surface uniform — both flags use `Option.choices([...]).default(<constant>)` and neither inspects `process.stdout.isTTY`. Users who pipe to `jq` pass `--format json` explicitly. The architecture doc's TTY-aware language at `docs/architecture.md:163` is updated in this PR to say `pretty` is the unconditional default.

### Restore all three `appendHint()` lines

Commit `337b55e` removed three lines from `appendHint()` — one per non-DIAGNOSTICS detail level (`SUMMARY`, `DIMENSIONS`, `SIGNALS`). All three are restored verbatim, including the `Full evidence:` wording on the SIGNALS branch (the other two read `Full report:`). This restores the canonical samples in `docs/architecture.md:34` and `:321` and is the symmetric inverse of `337b55e`. Restoring only one line would leave two of the three pre-regression sample positions empty.

### `Format` lives in its own module

A new `packages/cli/src/format.ts` mirrors the shape of `packages/cli/src/detail.ts`: `Format = { PRETTY: 'pretty', JSON: 'json' } as const`, derived `type Format`, `FORMATS` readonly array, `DEFAULT_FORMAT`, and an `isFormat()` narrower. This is co-pattern with `detail.ts` (and `exit-codes.ts`) and matches `.claude/rules/typescript-code-style.md`'s ban on `enum`. Inlining in `index.ts` would diverge from the established layering.

### JSON formatter is a single TS module under `packages/cli/src/formatters/`

`packages/cli/src/formatters/json.ts` exports `formatJson(result: ScorecardResult): string`. Body is `JSON.stringify(result, null, 2) + '\n'`. The architecture decision rule at `docs/architecture.md:151` mandates that string-projection formatters live inside `packages/cli/src/formatters/`; only `formatter-html` (Phase 14) earns its own package because of the React + bundler weight. JSON imposes none of that weight, so a separate package would be unjustified abstraction.

### Filtering happens once, upstream of every formatter

`commands/score.ts:154` already calls `filterByDetail(parsed, detail)` and passes the result to `formatPretty`. Phase 6 inserts a format-dispatch branch at the formatter call site (`score.ts:155`) that picks `formatJson` or `formatPretty` based on `options.format`. The JSON formatter consumes the same already-filtered `ScorecardResult` — it does not re-filter. This is the invariant the roadmap framing for Phase 5 explicitly preserved (`specs/roadmap.md:90`).

## Constraints

- **Engine-verbatim — no key renames or restructuring.** `specs/mission.md:42`; `specs/tech-stack.md:86`; `docs/architecture.md:529` (§7). The formatter must be pure projection: `JSON.stringify` of the already-filtered result, no additional fields, no envelope keys, no rename of engine keys.
- **Stable result JSON for automation.** `specs/mission.md:42`. CI integrators must be able to `jq .summary.score` without paying attention to CLI version. Phase 6's output must keep the field stable.
- **Engine signal stability tolerance.** `specs/tech-stack.md:114-115`. The engine is alpha (`1.0.0a16`); signal names and metadata shapes may change in breaking ways. `JSON.stringify` is structurally tolerant of unknown keys; tests must assert *shape and known verbatim values*, not strict snapshots.
- **Exit codes are public CLI contract.** `specs/tech-stack.md:87`; `docs/architecture.md` §6. Phase 6 introduces no new exit codes. Invalid `--format` value is rejected by commander at parse time and exits 1 (the existing commander-rejection path).
- **Stdout/stderr discipline.** `docs/architecture.md:348` — stdout stays clean so `--format json | jq` works without filtering. The spinner remains on stderr; Phase 6 does not silence it (`--quiet` is Phase 9). Phase body bullet 3 explicitly preserves stdout-on-TTY emission so users can pipe interactively.
- **No deep relative imports across packages; `.ts` extension on relative imports inside the package.** `.claude/rules/typescript-code-style.md`. `format.ts` and `formatters/json.ts` import `result.ts`, `detail.ts` etc. with explicit `.ts` suffixes.
- **No mocking in tests.** `specs/tech-stack.md:90`; `.claude/rules/testing.md`. JSON formatter unit tests consume the real fixture (`packages/cli/test/fixtures/scorecard.sample.json`) captured from a real engine run. e2e tests spawn the real CLI against a real Docker image.
- **Lerna fixed-version invariant.** `specs/tech-stack.md`; `docs/architecture.md` §2. Phase 6 implementation does NOT bump `package.json` versions; the alpha-release CI flow (Phase 12) cuts the next prerelease at tag time.

## Context

Phase 4 made `pretty` the unconditional default and dropped engine-verbatim JSON from the npm CLI's stdout. Phase 5 introduced `--detail` filtering and made `filterByDetail()` engine-verbatim by construction. Both phases shipped knowing Phase 6 would eventually reintroduce JSON; commit `337b55e` even removed forward-references to `--format json` from the pretty formatter's footer hints once Copilot review on PR #14 noted that recommending an unimplemented flag would error with "unknown option". Phase 6 closes that loop.

The named secondary persona in `specs/mission.md:30` is "CI integrators" — teams that want to gate merges on JAIRF score thresholds. Until Phase 6 lands, the npm CLI cannot serve that persona end-to-end: there is no documented way to get machine-readable output through `npx @jentic/api-scorecard-cli score …`. Users who need JSON have to bypass the CLI and run `docker run …` directly, which is exactly the UX the architecture wants to avoid (`docs/architecture.md` §1). Once `--format json` ships, the canonical recipe `score --format json | jq .summary.score` becomes live and the deferred `--min-score N` flag (Later Phases) becomes optional sugar rather than a blocker.

The `--format json --detail diagnostics` recipe in particular is load-bearing for diagnostics evidence: pretty's diagnostics rendering is intentionally a small severity tally + top-5 preview because the full evidence bundle isn't useful in a terminal (`.claude/CLAUDE.md` line 13). Users who actually need the full bundle — e.g. for archival, CI artifacts, or LLM-assisted review — must go through `--format json --detail diagnostics`. Restoring the `appendHint()` footer makes the path discoverable from the default invocation.

This is the second SDD-scaffolded feature spec in the project (after `specs/2026-05-25-with-llm-plumbing/` for Phase 10). Scope and validation conventions follow that precedent.

## Stakeholder Notes

- **CI integrators** — get a stable, documented `score … --format json` channel they can `jq` without depending on CLI version. Manual gating via `jq '.summary.score < N' && exit 1` becomes possible immediately; the Later-Phases `--min-score N` becomes additive, not foundational.
- **OpenAPI spec authors / maintainers** — the pretty default is unchanged. They benefit indirectly: the restored `appendHint()` footer points them at `--format json --detail diagnostics` when they want the full evidence bundle.
- **Future formatter authors (HTML — Phase 14; Markdown — Later)** — Phase 6 finalizes the format-dispatch shape in `commands/score.ts` and the `packages/cli/src/formatters/<name>.ts` co-located convention. New formatters slot into this dispatch with one branch each.
