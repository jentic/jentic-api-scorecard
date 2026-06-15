# Phase 18 Requirements — Markdown formatter (`--format markdown`)

## Scope

Add `markdown` as a value of the CLI's `-f, --format` flag. When selected, the CLI emits a GitHub-flavored Markdown (GFM) projection of the scorecard: a headline (score / level / grade), a dimension table, an optional per-signal section, and an optional diagnostics section. The output is plain text suitable for `$GITHUB_STEP_SUMMARY`, PR comments, and status checks — no ANSI color, no terminal-only formatting.

The Markdown formatter is the Markdown analogue of the existing `pretty` formatter: it renders the same scorecard sections from the same engine-result fields, gated by the same `--detail` levels, but as rendered GFM (headings, tables, lists) instead of ANSI-colored terminal text. It is a pure function of the engine result JSON, so a downstream consumer (the Phase 19 GitHub Action) can derive it from a captured `report.json` with no re-scoring.

## Out of Scope

- The GitHub Action that consumes this formatter (Phase 19). This phase ships only the `--format markdown` CLI capability.
- Posting Markdown to PR comments or the GitHub Checks API — that is the Action's job; the CLI only produces the string.
- A `./markdown` subpath export from the CLI package. The Action renders Markdown by invoking `score … --format markdown` (the formatter need not be importable). If a future consumer needs the function directly, exporting it is a non-breaking follow-up.
- Any change to `pretty`, `json`, or `html` output, or to the `--detail` filter semantics.
- Emoji / shields.io badges / collapsible `<details>` chrome. Keep the first cut to clean GFM headings, tables, and lists; richer presentation can follow if the Action wants it.

## Decisions

### Full parity with `pretty`, gated by `--detail`

The Markdown formatter renders every section `pretty` renders, gated by the same `--detail` levels: the headline always; the dimension table at `dimensions` and above; a per-signal section at `signals` and above; a diagnostics section at `diagnostics`. This makes `--format markdown --detail diagnostics` a complete run summary — the shape the GitHub Action wants for `$GITHUB_STEP_SUMMARY`. The alternative (headline + dimensions only) was rejected because a `--detail diagnostics` invocation would then silently drop findings from the summary.

### Markdown is a sibling formatter inside the CLI package

`markdown.ts` lives in `packages/cli/src/formatters/` next to `pretty.ts` / `json.ts`, exported as `formatMarkdown(result, options)`. It is plain string-building (no new dependency — unlike `html`, which needs the bundled React package), so it stays in the CLI rather than becoming a separate package. It mirrors `formatPretty`'s signature and `--detail` handling.

### TTY-safe; no `validateScoreOptions` refusal

Unlike `html` (a full document) and `sarif` (machine output), Markdown is human-readable plain text, so it is safe to print to an interactive terminal. `--format markdown` adds no entry to `validateScoreOptions`. With `-o`, the Markdown is written verbatim — no `stripAnsi` is needed because the formatter emits no ANSI codes (it must not import `chalk`).

### GFM tables, escaping pipes

The dimension table (and any signal/diagnostic tables) use GFM pipe-table syntax. Cell content that can contain a literal `|` (e.g. diagnostic messages) is escaped (`\|`), and literal newlines are collapsed to a space, so neither a stray pipe nor a multi-line message breaks a table row. Scores render as integers (rounded, matching `pretty`); signal scores — which are `[0, 1]` in the engine — render as percentages, consistent with `pretty`.

### Independent of SARIF (Phase 17)

This phase only adds `markdown` to the `Format` union and a new formatter file; it does not depend on Phase 17's `sarif` value existing. The two phases extend `Format` independently. (`Format` is currently `pretty | json | html`; whichever of `sarif` / `markdown` lands first adds its value, the other adds its own.)

## Constraints

- **Result JSON is engine-verbatim; formatters are read-only projections** (`specs/tech-stack.md`; `docs/architecture.md` §7). The Markdown formatter reads `summary`, `summary.dimensions[]`, `details[].dimensions[].signals[]`, and `diagnostics[]` without renaming, restructuring, or mutating them.
- **Tolerate unknown / missing keys** (`docs/architecture.md` §7; engine signals are alpha and may drift). The formatter must render a valid (if sparse) document when optional sections are absent — e.g. a minimal result with only `summary.{score,level,grade}` produces a headline and nothing else, never a crash.
- **Signal scores are `[0, 1]`, dimension/overall scores are `[0, 100]`** (`docs/architecture.md` §7). The formatter must not multiply one by 100 and forget the other — match `pretty`'s convention (signals → `%`, dimensions/overall → integer out of 100).
- **`--detail` filter is applied upstream** in `commands/score.ts` via `filterByDetail` before the formatter runs (`docs/architecture.md` §7). The formatter consumes the already-filtered result and renders whatever depth is present; it does not re-filter.
- **CLI surface changes require README + SKILL sync** (`.claude/rules/cli-readme-sync.md`). Adding `markdown` to `--format` updates `README.md` `## CLI reference` and `skills/jentic-api-scorecard/SKILL.md`'s flag table in the same commit.
- **TypeScript style** (`.claude/rules/typescript-code-style.md`): `.ts` import suffixes, extend the existing `Format` `as const` record, strict-mode types, no mocking in tests.

## Context

This formatter was parked in Later Phases pending "concrete CI-integrator demand." The Phase 19 GitHub Action is that demand: `$GITHUB_STEP_SUMMARY` renders Markdown, not ANSI-colored `pretty` output, so a rich inline run summary needs a real Markdown projection rather than stripped-`pretty` text in a code fence (which would be a monospace blob with no rendered tables).

It serves the **CI integrators** secondary persona in `specs/mission.md`: a human-readable, paste-able report for PRs and status checks, complementing the machine-readable `--format json`. Sequencing it before Phase 19 keeps each phase small — the formatter is a reviewable concern of its own, and the Action depends on it.

## Stakeholder Notes

- **CI integrators** — want an at-a-glance scorecard rendered on the run/PR without downloading anything. Satisfied by `--format markdown` feeding `$GITHUB_STEP_SUMMARY`.
- **OpenAPI spec authors** — paste a Markdown scorecard into a PR description or issue. Satisfied by the GFM headline + dimension table.
