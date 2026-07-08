---
name: jentic-api-improve
description: "Improve OpenAPI documents for AI-readiness by fixing issues and enriching content based on Jentic API AI-Readiness Framework (JAIRF) scoring. Use when you need to raise an API's quality score, fix diagnostics, or add missing descriptions/summaries/examples \u2014 whether directly requested ('improve my API', 'fix OpenAPI issues', 'make my API more AI-ready') or as part of a broader workflow (post-audit remediation, pre-release quality gate, automated spec enhancement). Produces an improved spec and an OpenAPI Overlay (the reusable, non-breaking delta)."
license: Apache-2.0
metadata:
  author: Jentic
  version: "1.1"
  references-loading: lazy
compatibility: "Requires shell execution, python, Node.js (>= 20.19), a running Docker daemon, and the `@jentic/api-scorecard-cli` (run via `npx @jentic/api-scorecard-cli@latest`; needs a `JENTIC_API_KEY` env var from https://app.jentic.com/scorecard?tab=api-keys), plus `jentic-openapi-tools` (`pipx install jentic-openapi-tools`), `jentic-apitools` (`pipx install jentic-apitools-cli`), `check-jsonschema` (`pipx install check-jsonschema`), and `jq`."
argument-hint: "[path-or-url-of-openapi-document] [output-directory]"
allowed-tools: Bash(python3 *) Bash(jq *) Bash(jentic-openapi-tools *) Bash(jentic-apitools *) Bash(check-jsonschema *) Bash(npx *) Bash(mkdir *) Bash(cp *) 
---

# OpenAPI Improve

## Overview

Improve the OpenAPI document at the provided path or URL ($0) for AI-readiness. The target document is the first argument passed to this skill. An optional second argument ($1) specifies the output directory; when omitted, the outputs land in the input file's own directory (see "Output").

This skill runs a baseline score that includes diagnostics, identifies weak dimensions and actionable diagnostics, then applies targeted improvements — either inline for simple fixes or via a subagent for multi-iteration loops. Improvements are non-breaking (they only add to the spec, never change or remove existing paths, parameters, or response shapes) and produce both an improved spec and an OpenAPI Overlay (the reusable delta).

If the `jentic-api-scorecard` skill is installed, you can use it for a more thorough initial and/or final analysis before starting improvements or within iterations.

Reference files in `references/` are large and should be loaded lazily — only read a reference file when its content is specifically needed (e.g. to understand scoring formulas or overlay structure). Do not preload all references at once.

For Claude Code users: copy `agents/jentic-api-improve.md` (from the repo root) to your project's `.claude/agents/` or `~/.claude/agents/` to enable the declarative subagent definition. This is optional — the skill works without it by spawning subagents via inline brief.

## Running Autonomously

The skill is engineered to minimise permission prompts, but Claude Code's permission model is layered and the choice of permission mode decides which prompts you will actually see. Three paths get you to autonomous execution:

- **`--permission-mode bypassPermissions` (or `--dangerously-skip-permissions`)** — zero prompts; all guards off. Works regardless of what the skill's `allowed-tools` declares (the two are at different layers, not mutually exclusive). The simplest path when you want hands-off behaviour and accept the broader trust posture; appropriate for sandboxed/containerised runs. **Recommended for fully unattended automation.**

- **default mode + the settings snippet below** — pre-approves the skill and the wildcard `Bash(...)` patterns the skill uses, plus workspace-scope grants for the working directory. One paste per project and the skill runs prompt-free. **Recommended for everyday interactive use.**

- **auto mode** — Claude Code's newer classifier-based mode. **Important caveat: auto mode intentionally strips wildcarded interpreter rules** (e.g. `Bash(python3 *)`) from the effective allowlist on entry, to prevent auto-approval of arbitrary code. The settings snippet below relies on wildcards, so under auto mode the snippet is largely disarmed and individual invocations route through the classifier — many of them prompt. For autonomous runs under auto mode, either switch to `bypassPermissions`, or supply narrow exact-match `Bash(...)` rules (brittle because the skill issues many distinct commands).

The static-analyzer guards (command substitution, heredocs, multi-line `python3 -c` with `\n#`, etc.) fire in every mode including auto and bypass-precursors; the skill's "Forbidden Shell Idioms" section below enumerates them so neither the parent nor the subagent emits an invocation that triggers them.

## Pre-approving the skill in `.claude/settings.local.json`

**REQUIRED ONE-TIME SETUP per project under default mode** — paste this verbatim into `.claude/settings.local.json` BEFORE invoking the skill. Without these entries the skill will prompt several times per run. Under `bypassPermissions` this snippet is unnecessary; under `auto` it is largely disarmed (see "Running Autonomously" above).

Under `acceptEdits` mode the snippet's `Bash(...)` wildcards work, but the workspace-scope prompt for the working directory still fires once on the first invocation in each project unless the `Read/Edit/Write(./.jentic-improve-work/**)` entries below are pre-applied. Click "Yes, and always allow access to `.jentic-improve-work/` from this project" once and Claude Code persists the equivalent entry to your project settings — that one-time approval is the expected steady state if you choose not to paste the snippet upfront.

```json
{
  "permissions": {
    "allow": [
      "Skill(jentic-api-improve)",
      "Bash(python3 *)", "Bash(jq *)",
      "Bash(jentic-openapi-tools *)", "Bash(jentic-apitools *)", "Bash(check-jsonschema *)",
      "Bash(npx *)", "Bash(mkdir *)", "Bash(cp *)",
      "Read(./.jentic-improve-work/**)",
      "Edit(./.jentic-improve-work/**)",
      "Write(./.jentic-improve-work/**)"
    ]
  }
}
```

The `Skill(jentic-api-improve)` entry pre-approves the per-project skill-invocation consent prompt. The `Read/Edit/Write(./.jentic-improve-work/**)` entries pre-approve the workspace-scope guard that fires on first access to any new subdirectory of cwd (including hidden directories like `./.jentic-improve-work/`). The `Bash(...)` entries mirror the skill's `allowed-tools` field.

If you prefer a single entry for the working directory instead of three, you can use the equivalent `additionalDirectories` form:

```json
{
  "permissions": {
    "additionalDirectories": ["./.jentic-improve-work"],
    "allow": [
      "Skill(jentic-api-improve)",
      "Bash(python3 *)", "Bash(jq *)",
      "Bash(jentic-openapi-tools *)", "Bash(jentic-apitools *)", "Bash(check-jsonschema *)",
      "Bash(npx *)", "Bash(mkdir *)", "Bash(cp *)"
    ]
  }
}
```

Both forms work under default mode. Under `auto` mode the `Bash(...)` wildcards are stripped on entry to prevent auto-approval of arbitrary code — see "Running Autonomously" above. Under `bypassPermissions` mode the entire snippet is unnecessary.

The skill is engineered (see "Forbidden Shell Idioms" below) so that every bash invocation it issues is matched by one of the patterns above, with no `$(...)` substitution wrapping it and no `&&` chaining that would split the match.

## Forbidden Shell Idioms

Claude Code's static analyzer flags certain shell idioms with permission prompts that are NOT silenced by `Bash(...)` allowlist entries — the guard runs before the allowlist match. To run autonomously the skill MUST avoid all of the following in every bash invocation it issues. The parent agent and any subagent it spawns inherit these rules.

Forbidden:

- **`$(...)` and backtick `` `...` `` command substitution.** Inline every value the parent already knows (basename of `$0`, file extension, URL-vs-path decision, timestamps you've already computed). For values the parent doesn't know, use a single-line `python3 -c "..."` (with no `#` comments) that prints the value, capture the printed string from the tool result, then inline it as a literal in subsequent commands.
- **`<<` heredocs** of any flavour (`<< EOF`, `<< 'EOF'`, `<<-`). To create a multi-line file, use Claude Code's **Write tool** — it produces no shell-injection surface and bypasses the expansion-obfuscation guard entirely.
- **`cd` followed by another command** (`cd X && Y`). Use absolute or cwd-relative paths in every command.
- **`git` invocations of any kind.** The skill never needs git. If an edit produces a bad spec, recover by re-copying from `$0` (see the recovery clause in the Improvement Loop).
- **Pipes through commands not in `allowed-tools`** (`head`, `tail`, `sed`, `awk`, `grep`, `tr`, `cut`). Use `jq` or a single-line `python3 -c` instead.
- **Multi-line `python3 -c "..."` invocations**, especially any whose quoted argument contains `\n#` (newline followed by `#`, i.e. a Python comment). Claude Code's analyzer flags this as "Newline followed by # inside a quoted argument can hide arguments from path validation" and prompts, regardless of `Bash(python3 *)` allowlisting. `python3 -c "..."` is allowed ONLY for single-line expressions with no `#` comments. For anything multi-line, Write the script to `./.jentic-improve-work/<name>.py` and run `python3 ./.jentic-improve-work/<name>.py`.
- **Compound bash commands** — `A && B`, `A || B`, `A ; B`, `A | B`, `A |& B`, `A & B`. Claude Code evaluates compound forms as a single unit for prompting, and prompts on them even when each subcommand individually matches an allow rule. Issue each subcommand as a SEPARATE Bash tool call. The Improvement Loop's step 2 (run edit), step 3 (validate), and step 4 (re-score) are three distinct Bash calls — never a single `python3 … && jentic-openapi-tools … && npx … score …` chain.
- **`find`, `locate`, `which`, `whereis`** or any other file-discovery mechanism for locating files bundled with the skill. Files that ship with the skill (the overlay schema, reference docs) live under the skill's **base directory**, which Claude Code provides at session start as a system message of the form `Base directory for this skill: <PATH>`. Construct the absolute path by joining that base directory with the documented relative path — e.g. `<base-dir>/references/overlay-1.1.0-json-schema.yaml`. Never scan the filesystem; `find /home/.../skills …` trips a workspace-scope prompt on `skills/` AND violates several other Forbidden Idioms simultaneously (`|`, `head`, redirect to `/dev/null`).

(Footnote: also avoid status `echo "Found X..."` or `ls -la` calls — they aren't allowlisted, add nothing to autonomous runs, and prompt for no functional purpose. Report progress in user-facing prose, not in the shell.)

Canonical patterns:

- **Create a multi-line file** → Write tool call (never `cat > … << 'EOF'`).
- **Compute a value** → if the parent already knows it (basename of `$0`, file extension, URL prefix), inline as a literal; otherwise single-line `python3 -c "..."` (no `#`), capture stdout, inline.
- **Filter / extract / spot-check JSON** → `jq` with the query as a single argument, redirect to a file. For YAML, Write a small `verify.py` via Write tool, then run it — never a multi-line `python3 -c "import yaml; ...; # check ..."`.

## CLI Tools

Do NOT install or use external validators (spectral-cli, openapi-spec-validator, eslint-plugin-openapi, etc.). All validation and analysis is done through the CLIs listed below.

From the slash-command argument `$0`, the parent computes mentally (no shell substitution): the working-copy extension (`yaml` if `$0` ends in `.yaml`/`.yml`, else `json`), and whether `$0` is a URL (`http://` or `https://` prefix). These are inlined as literals into the bash commands below; `$(basename ...)` and similar substitutions MUST NOT appear in any command. See "Forbidden Shell Idioms" above.

Then issue these commands as **separate Bash calls** (no `&&` chaining). Cleanup runs first to remove any stale files left by a prior aborted run — they would otherwise cause Write-tool "file has not been read yet" failures when the iterative loop tries to create `edit-iter-N.py`:

```bash
python3 -c "import shutil; work_dir='./.jentic-improve-work'; shutil.rmtree(work_dir, ignore_errors=True)"
```

```bash
mkdir -p ./.jentic-improve-work
```

Then materialise the input as `./.jentic-improve-work/spec.<EXT>` (the **working copy**). For local file paths, substitute the literal `$0` value and the literal `<EXT>`. Quote the substituted path and use `--` so paths containing spaces or a leading `-` are handled correctly:

```bash
cp -- "<literal-value-of-$0>" ./.jentic-improve-work/spec.<EXT>
```

For `http(s)://` URL inputs use `python3` (covered by `Bash(python3 *)`). Pass the URL and destination as `argv` arguments rather than inlining the URL into the `-c` string — this avoids any quoting/code-injection issue if the URL contains a single quote, while staying a single-line invocation:

```bash
python3 -c "import sys, urllib.request; urllib.request.urlretrieve(sys.argv[1], sys.argv[2])" "<literal-value-of-$0>" "./.jentic-improve-work/spec.<EXT>"
```

Only `http://`/`https://` URLs are fetched this way (the parent has already classified `$0` as a URL); the destination is always the fixed working-copy path, never a value derived from `$0`.

After this step `$0` is read-only for the rest of the run — only the baseline `score` and the overlay-diff "before" side read it again. All editing, validation, and re-scoring inside the iterative loop operate on the working copy. `$0` MUST NOT be opened for write at any point.

All examples below refer to the working directory as `./.jentic-improve-work` (literal path) and the working spec as `./.jentic-improve-work/spec.<EXT>`. The parent inlines the literal extension when issuing each command. `./.jentic-improve-work` is the **only** temporary location — every intermediate file the run produces lives inside it — and it is always removed at the end of the run (see "Cleanup at end of run"). The `.gitignore` tip below is just a safety net for a run that is interrupted before cleanup: users tracking the project in git can add `.jentic-improve-work/` to `.gitignore`.

### `jentic-api-scorecard` (scoring + diagnostics)

The public `@jentic/api-scorecard-cli` scores the spec against JAIRF and, with `--with-llm`, emits the `POOR_OPERATION_SEMANTICS` diagnostics that drive the improvements. It runs the scoring engine in a Docker container the CLI manages, so **Node.js (>= 20.19) and a running Docker daemon are required** (the engine image is pulled on first run — a one-time latency cost). No install step is needed when run via `npx`; the canonical form is zero-install:

```bash
npx -y @jentic/api-scorecard-cli@latest score <input> [options]
```

Use `-y` so the first-run install prompt does not block an unattended run. Alternatively install it globally once (`npm install -g @jentic/api-scorecard-cli`, then call `jentic-api-scorecard score …`), or pin a version for reproducible CI (`npx -y @jentic/api-scorecard-cli@<version> score …`). The skill's `allowed-tools` already covers `Bash(npx *)`.

The single baseline call produces both the per-dimension scores and the semantic diagnostics in one file (`--detail diagnostics` is a superset that still includes `summary.dimensions[]`):

* Baseline: `npx -y @jentic/api-scorecard-cli@latest score "$0" --with-llm --format json --detail diagnostics -o ./.jentic-improve-work/scorecard.json -q`

Always use `--format json` (machine-readable), `--detail diagnostics` (full evidence bundle), `-o` (write to a file), and `-q` (suppress the spinner). There is no separate `analyze` command — `score --with-llm --detail diagnostics` is the equivalent. See [jentic-api-scorecard.md](references/jentic-api-scorecard.md) for the full reference, JSON shape, and exit codes.

Append `--report-token-usage` to this baseline call **and** every in-loop re-score **only when benchmark metrics were explicitly requested** (see "Benchmark metrics"); a normal run omits it.

The `--with-llm` flag is particularly valuable for the improve workflow — it produces `POOR_OPERATION_SEMANTICS` diagnostics with ready-to-use description and summary suggestions. It does not consume extra scorecard quota, but it adds latency and requires LLM provider credentials.

Privacy note: `--with-llm` sends spec context (operation summaries, descriptions, and schema names — not the full spec) to the configured LLM provider, and it loads that provider's credentials into the run. For a proprietary or sensitive API, confirm this outbound transmission is acceptable, or use a local OpenAI-compatible provider (e.g. Ollama) so nothing leaves your network. Without `--with-llm` no provider is contacted and no LLM credentials are read.

**`JENTIC_API_KEY` is required** for any local-file input (which is what this skill always scores). Export it from the environment — never put it on the command line — using a key from https://app.jentic.com/scorecard?tab=api-keys. The free tier allows 100 scorings/month; **each `score` call costs one unit regardless of `--with-llm`** (see "Scoring exit codes and quota" below).

The `--with-llm` flag also requires credentials for the configured LLM provider. Set the routing variables (`LLM_PROVIDER`, `LIGHT_LLM_PROVIDER`, `LLM_LIGHT_MODEL`; default provider `BEDROCK`) and provide the corresponding credential:

| Provider | Required environment variable |
|---|---|
| `OPENAI` | `OPENAI_API_KEY` (+ `LLM_PROVIDER=OPENAI`, `LIGHT_LLM_PROVIDER=OPENAI`, `LLM_LIGHT_MODEL`) |
| `ANTHROPIC` | `ANTHROPIC_API_KEY` (+ `LLM_PROVIDER=ANTHROPIC`, `LIGHT_LLM_PROVIDER=ANTHROPIC`, `LLM_LIGHT_MODEL`) |
| `GEMINI` | `GEMINI_API_KEY` (+ `LLM_PROVIDER=GEMINI`, `LIGHT_LLM_PROVIDER=GEMINI`, `LLM_LIGHT_MODEL`) |
| `BEDROCK` | AWS credentials (`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`, or `AWS_BEARER_TOKEN_BEDROCK`) + `LLM_LIGHT_MODEL` |

### `jentic-openapi-tools` (validation)

Install: `pipx install jentic-openapi-tools` (or `uv tool install jentic-openapi-tools`). Upgrade: `pipx upgrade jentic-openapi-tools`.

Use this to validate the spec after making edits — it runs multiple backends (Redocly, Spectral, Speclynx, openapi-spec) under one CLI. Validate the working copy `./.jentic-improve-work/spec.<EXT>`, never the original `$0`.

* Validate: `jentic-openapi-tools validate -a -q --format json -o ./.jentic-improve-work/diagnostics.json ./.jentic-improve-work/spec.<EXT>`

The `-a` flag uses all available backends. Output is JSON with a `diagnostics` array and a `summary` object. See [example-validate-output.json](references/example-validate-output.json) for the output format.

### `check-jsonschema` (overlay validation)

Install: `pipx install check-jsonschema`.

Use to validate generated overlay files against the Overlay 1.1.0 JSON Schema:

* Validate overlay: `check-jsonschema --schemafile <path-to-overlay-schema> <overlay-file>`

The overlay schema is at `references/overlay-1.1.0-json-schema.yaml` in this skill's directory.

### `jentic-apitools` (overlay verification)

Install: `pipx install jentic-apitools-cli` (or `uv tool install jentic-apitools-cli`). Upgrade: `pipx upgrade jentic-apitools-cli`. Note the PyPI package is `jentic-apitools-cli` but the command is `jentic-apitools`. The default overlay engine uses `npx` (Node.js), already required by this skill.

Schema validity is necessary but not sufficient — a schema-valid overlay can still target the wrong node or encode a lossy transform. **On top of** the `check-jsonschema` schema check, use `verify-improvement` to prove the overlay actually turns the original spec into the improved spec:

* Verify overlay: `jentic-apitools verify-improvement --original <original-spec> --improved <improved-spec> --overlay <overlay-file> -q`

`--overlay` is repeatable (applied in order); each slot accepts a path, an `http(s)://` URL, or `-` for stdin. Output is a single JSON document on stdout: `{success, match, overlay_count, diff}` (`diff` is a structural DeepDiff, empty when they match). Exit codes: `0` the overlay reproduces the improved spec; `2` a clean verification mismatch (overlay applied but the result differs — `diff` shows what); `1` an operational error (unreadable input, an overlay that fails Overlay 1.1.x schema validation, or an apply failure such as missing `npx`). See [jentic-apitools-cli.md](references/jentic-apitools-cli.md) for the full reference.

### `npx yaml` (YAML to JSON conversion)

Requires Node.js (no separate install). The `-y` flag skips the first-run install prompt for the `yaml` package so the command does not block an unattended run. Use at final placement to convert a YAML working copy to the always-JSON `openapi.json` output:

* Convert: `npx -y yaml --json --single < input.yaml > output.json`

## Baseline Assessment

Before making any improvements, confirm prerequisites and establish the baseline.

### Pre-flight check

The scorecard CLI needs three things before it can score the local working copy: a running Docker daemon, Node.js (>= 20.19) for `npx`, and a `JENTIC_API_KEY` in the environment (local-file inputs always require a key). If any is missing the CLI fails fast with a distinct exit code (2/3 for the key, 4 for Docker — see "Scoring exit codes and quota" below). Do not put `JENTIC_API_KEY` on the command line; it must be exported in the shell that launched the session.

To also get `POOR_OPERATION_SEMANTICS` suggestions you must run with `--with-llm`, which needs LLM provider credentials and routing (see the `jentic-api-scorecard` CLI section above). If those are absent the CLI exits 8 under `--with-llm`. If the user cannot provide LLM credentials, tell them: "LLM credentials for the configured provider are not set, so `--with-llm` cannot run and `POOR_OPERATION_SEMANTICS` suggestions will not be available, resulting in lower-quality improvements. Set the provider credentials and routing variables and retry for better results." — then, only with the user's agreement, decide **up front** (before establishing the baseline) to run the entire session without `--with-llm`, so the baseline and every re-score are mutually comparable. This is the only sanctioned way to drop `--with-llm`; once a `--with-llm` run is under way, an exit-8 mid-run is a STOP-and-report (see "Scoring exit codes and quota"), not an automatic fallback.

### Running the Baseline

The WORK-dir + working-copy setup described under "CLI Tools" must already have run, so `./.jentic-improve-work/` exists, `./.jentic-improve-work/spec.<EXT>` is the working copy, and the parent has computed the run timestamp in its head. The baseline is a single read-only `score` call against the original `$0` (the parent substitutes `$0` with the literal path passed to the slash command — there is no shell expansion of `$0` because it never reaches bash as a variable). It produces both the per-dimension scores and the semantic diagnostics in one file:

```bash
npx -y @jentic/api-scorecard-cli@latest score "$0" --with-llm --format json --detail diagnostics -o ./.jentic-improve-work/scorecard.json -q
```

Check the exit code before reading the output: on a non-zero exit the file may be absent or partial. React per "Scoring exit codes and quota" below — in particular stop on 2/3 (set `JENTIC_API_KEY`), 4 (start Docker), 7 (quota exhausted), and 8 (LLM failure). Only when the exit code is 0 proceed to extract the data.

### Extracting baseline data

Run each of the following `jq` commands as its own separate Bash tool call — they are listed together for reference only, NOT to be pasted as one multi-line invocation (compound invocations trigger Claude Code's permission prompts; see "Forbidden Shell Idioms"). The `#` lines are explanatory labels, not part of any command.

```bash
# Summary score, level (a slug string) and grade
jq '{score: .summary.score, level: .summary.level, grade: .summary.grade}' ./.jentic-improve-work/scorecard.json

# Dimensions scoring below 60 (improvement targets)
jq '[.summary.dimensions[] | select(.score < 60) | {kind, name, score}]' ./.jentic-improve-work/scorecard.json

# Extract POOR_OPERATION_SEMANTICS suggestions to a separate file
jq '[.diagnostics[] | select(.code == "POOR_OPERATION_SEMANTICS") | {operation_id: .data.operation_id, issues: .data.issues_found, path: .data.path, description_suggestion: .data.description_suggestion, summary_suggestion: .data.summary_suggestion}]' ./.jentic-improve-work/scorecard.json > ./.jentic-improve-work/semantic-suggestions.json

# Count diagnostics by severity (numeric: 1=error, 2=warning, 3=note)
jq '[.diagnostics | sort_by(.severity) | group_by(.severity)[] | {severity: .[0].severity, count: length}]' ./.jentic-improve-work/scorecard.json

# List error-level diagnostics (severity 1)
jq '[.diagnostics[] | select(.severity == 1) | {code, message, source}]' ./.jentic-improve-work/scorecard.json
```

### Interpreting scores

The scorecard reports `summary.level` as a slug string. The level↔score mapping is:

| Score | Level slug | Name | What it means |
|-------|-----------|------|---------------|
| < 40 | `not-ready` | Not Ready | Fundamentally unsuitable for AI agents |
| 40-60 | `foundational` | Foundational | Developer-usable, partially AI-usable |
| 60-75 | `ai-aware` | AI-Aware | Semantically interpretable, safe for guided use |
| 75-90 | `ai-ready` | AI-Ready | Structurally rich, semantically clear, agent-friendly |
| >= 90 | `agent-optimized` | Agent-Optimized | Highly composable, predictable, automation-ready |

### The Six Dimensions

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| FC -- Foundational Compliance | 16% | Structural validity, lint, ref resolution |
| DXJ -- Developer Experience | 18% | Examples, docs, response coverage, tooling health |
| ARAX -- AI-Readiness & Agent Experience | 24% | Semantic clarity, summaries, operationId quality |
| AU -- Agent Usability | 20% | Complexity, distinctiveness, navigation, safety |
| SEC -- Security | 12% | Auth coverage, auth strength, transport, hygiene |
| AID -- AI Discoverability | 10% | Descriptive richness, domain tags, registry signals |

Gating rule: an FC dimension score below 40 forces the overall score into the lowest band (`summary.level` becomes `not-ready`) regardless of other scores. Fix structural issues first.

### Scoring exit codes and quota

Each `score` call consumes **one** unit of the scorecard's monthly quota (100/month on the free tier) **regardless of `--with-llm`** — the flag adds latency and LLM-provider cost but no extra scorecard quota. A normal run is one baseline plus up to two in-loop re-scores, so budget at least three units per run; warn the user if they ask for many rounds. Validate locally (free) before every re-score so a metered call is never spent on a spec an edit just broke.

After every `score` call, check the exit code before reading the JSON and react as follows:

| Code | Meaning | Reaction |
|---|---|---|
| 0 | Scoring completed | Proceed; read the JSON. |
| 1 | Generic error (bad input, write failure) | Re-check the input path; do not retry blindly. |
| 2 | Auth — `JENTIC_API_KEY` missing/invalid | STOP; ask the user to export a valid `JENTIC_API_KEY`. |
| 3 | Gate rejected — non-OAK input without a key | STOP; same remedy as 2 for local files. |
| 4 | Docker not installed / daemon unreachable | STOP; ask the user to start Docker, then retry. |
| 5 | Spec fetch/parse failure | The spec itself is broken — report as a finding and STOP; do not try to improve an unparseable spec. |
| 6 | Engine invocation failure | Transient — retry once, then STOP. |
| 7 | Quota exhausted | STOP; report work done and not done. Do NOT retry — tell the user to wait for the monthly reset or upgrade. |
| 8 | LLM analysis failed under `--with-llm` | STOP and report; ask the user to fix LLM provider credentials/routing, then retry. Do NOT silently retry the same run without `--with-llm` (the resulting score would not be comparable to the LLM baseline). Dropping `--with-llm` is only acceptable as the up-front, user-approved decision described in "Pre-flight check" — i.e. chosen *before* establishing the baseline, so the whole run stays internally comparable — never as an automatic mid-run reaction to an exit-8. |

## Improvements are non-breaking

All improvements are non-breaking: they only add to the spec and never change, rename, remove, or restructure anything a client depends on. The operative constraints (what may be added, what must never change) are spelled out under "Constraints" in the Subagent Brief Template below and apply to inline edits too.

What is safe to add:
- `summary` and `description` fields on operations, parameters, schemas, properties
- `example` / `examples` fields
- `tags` on operations and top-level tags array (note: may affect SDK code generation)
- New non-required schema properties

What must never be done (would change contracts or generated client code):
- Adding `operationId` where missing (SDK generators rename previously auto-named methods)
- Adding new response codes (can't tell if unimplemented or just undocumented)
- RFC 9457 Problem Details on existing error responses (modifies existing response schema shape)
- Removing, renaming, or restructuring existing paths, parameters, or schemas
- Adding operation-level `security` where an operation had none (adding a `security` requirement changes the runtime auth contract — a caller that worked unauthenticated now gets 401). This is why "sensitive operations need auth" is NOT an additive fix; see the SEC strategy under "Dimension Improvement Strategies".
- Adding a sibling key (`description`, `summary`, `example`, …) next to a `$ref`. A node that is a bare `{"$ref": "..."}` must stay bare — a sibling trips the `no-$ref-siblings` lint (error severity) and craters Foundational Compliance. To describe such a node, add the `description` on the *referenced component* instead. **`jentic-openapi-tools validate` does not always flag this** (it can report `valid: true, 0 errors` while the FC score still collapses on re-score), so treat it as a hard authoring rule, not something validation will catch for you.

### Never ship a regression

Every change applied to the spec is strictly additive, so **no dimension score may drop below its baseline** — if one does, a spec edit broke something (most often a `$ref`-sibling or a lint regression) even when the overall score still rose from gains elsewhere. After each re-score, compare **every** `summary.dimensions[].score` against the baseline scorecard. If any dimension regressed, undo the offending spec change on the working copy and do a corrective re-score before shipping. Never place a spec whose overall score or any dimension score is below baseline; ship the highest-scoring iteration whose dimensions are all at or above baseline (falling back to the untouched baseline spec if no change cleared that bar). This mirrors the in-loop guard in the Improvement Loop (step 7) and applies to inline edits too.

### Inline vs subagent decision

If improvements are straightforward (few dimensions to fix, clear suggestions from `POOR_OPERATION_SEMANTICS`), apply them inline without spawning a subagent. Spawn a subagent for multi-iteration improvement loops or when multiple dimensions need work.

The iterative edits operate on the working copy `./.jentic-improve-work/spec.<EXT>` (created during the WORK-dir setup step), never on `$0`. The final placement step (described under "Output") copies `./.jentic-improve-work/spec.<EXT>` to its destination once iteration is complete.

The same Forbidden Shell Idioms apply to inline edits and to the subagent — inline mode is not exempt.

## Dimension Improvement Strategies

These describe what each dimension's low score *means* and what would ideally raise it — but this skill only ever applies the **additive** subset. Where a strategy below would require a change on the "What must never be done" list under "Improvements are non-breaking" (adding `operationId` where missing, adding new response codes, adding operation-level `security` where none existed), it names the ideal target for context, not an edit to make. Apply only the additive levers; report the non-additive gaps as findings for the API owner to fix by hand.

FC (low score = structural problems):
- Fix all error and warning diagnostics before attempting other improvements
- Resolve broken `$ref` references
- Fix impossible schema constraints (`minimum > maximum`, contradictory types, etc.)

DXJ (low score = poor documentation/examples):
- Add `example` or `examples` to request bodies and responses
- Missing `4XX`/`500` responses hurt DXJ, but **adding a new response code is not safe** (can't tell if unimplemented or just undocumented) — report the gap, do not add the code.
- Add descriptions to parameters and schema properties

ARAX (low score = poor semantic clarity):
- Add `summary` to every operation (concise, action-oriented: "List unread messages")
- Add `description` to operations, parameters, and key schema properties
- Inconsistent or missing `operationId` hurts ARAX, but **adding or renaming an `operationId` is breaking** (SDK generators rename previously auto-named methods) — report the gap, do not edit it.
- Bare `string` types where a `format`/enum would be clearer improve ARAX only as *new non-required* additions; never change an existing property's type.

AU (low score = hard for agents to use):
- If many endpoints: consider whether the spec should be split
- Add pagination metadata (Link headers or cursor fields in responses)
- Use clear verb-object operationIds (`createPayment`, `listUsers`)

SEC (low score = auth/security issues). Most SEC fixes are **not** additive and are out of scope — do not make them; surface them as findings for the API owner:
- Hardcoded credentials anywhere -> SEC capped at 20 (removing them is a fix, not an addition — report it, do not edit).
- Sensitive operations (POST/PUT/DELETE) lacking a `security` requirement — adding one where none existed changes the runtime auth contract (breaking). **Do NOT add operation-level `security`**; report the gap.
- Relative or non-HTTPS server URLs — changing an existing `servers[]` entry's URL alters the base path (breaking). Do not rewrite it. The one additive nudge available: *append* an absolute-HTTPS `servers[]` entry without removing or altering the existing index-0 entry (note this often does not clear the validator's relative-server / https-only diagnostics, which key off the existing entry).
- Weak auth schemes (API key in query vs OAuth2/OIDC/Bearer JWT) — changing a scheme is breaking; report it.
- The only clearly-additive SEC lever: add a `description` to existing `securitySchemes` entries that lack one.

AID (low score = hard to discover):
- Add rich `info.description` explaining what the API does and who it's for
- Use `tags` consistently to group operations by domain
- Add `externalDocs` links

## POOR_OPERATION_SEMANTICS Suggestions

When `score` is run with `--with-llm --detail diagnostics`, the output includes `POOR_OPERATION_SEMANTICS` diagnostics with ready-to-use improvement suggestions. Each diagnostic contains:

- `data.operation_id` -- the operation to improve
- `data.issues_found` -- list of quality issues (e.g. `vague_description`, `missing_input_details`)
- `data.description_suggestion` -- suggested replacement for the operation's `description`
- `data.summary_suggestion` -- suggested replacement for the operation's `summary` (when present)
- `data.path` -- path to the operation in the spec

Example diagnostic (trimmed):

```json
{
  "code": "POOR_OPERATION_SEMANTICS",
  "severity": 2,
  "source": "semantic_analyzer",
  "data": {
    "operation_id": "createUsersWithListInput",
    "issues_found": ["vague_description", "missing_input_details", "missing_output_details"],
    "path": ["paths", "/user/createWithList", "post"],
    "current_description": "Creates list of users with given input array.",
    "description_suggestion": "Creates multiple user accounts in a single batch operation. Accepts an array of User objects, each containing username, email, password, and profile information. Returns a success response confirming the number of users created."
  }
}
```

These suggestions can be applied directly via the edit-via-Python-script pattern or as overlay actions. Extract them to a separate file for the subagent:

```bash
jq '[.diagnostics[] | select(.code == "POOR_OPERATION_SEMANTICS") | {operation_id: .data.operation_id, issues: .data.issues_found, path: .data.path, description_suggestion: .data.description_suggestion, summary_suggestion: .data.summary_suggestion}]' ./.jentic-improve-work/scorecard.json > ./.jentic-improve-work/semantic-suggestions.json
```

## Output

The run produces three artifacts by default, all placed flat in a single output directory — no nested subdirectories. Two further artifacts (`token-usage.json` and `benchmark-summary.json`) are produced only when **benchmark metrics** are explicitly requested — see "Benchmark metrics". The final improved spec is **produced by copying `./.jentic-improve-work/spec.<EXT>` (the working copy) to the destination once iteration is complete** — never by editing `$0` in place. `$0` is read-only for the entire run.

Resolve the output directory and the spec filename ONCE, before final placement:

- **Output directory (`OUT_DIR`)**: the second argument `$1` if it was provided, otherwise `dirname($0)` (the input file's own directory; the current working directory if `$0` is a URL).
- **Output spec filename (`<output-spec-filename>`)**: `openapi-improved.json` when `OUT_DIR` is the same directory as `$0` (so the original is never overwritten), otherwise `openapi.json`.

The flat outputs are:

- `<OUT_DIR>/<output-spec-filename>` (`openapi.json` or `openapi-improved.json`) — improved spec, **always JSON**. Produced by `cp -- ./.jentic-improve-work/spec.<EXT> "<OUT_DIR>/<output-spec-filename>"` when the working copy is JSON, or `npx -y yaml --json --single < ./.jentic-improve-work/spec.<EXT> > "<OUT_DIR>/<output-spec-filename>"` when it is YAML. Iterative edits stay in the original format; the YAML→JSON conversion happens only at this final placement step.
- `<OUT_DIR>/overlay.json` — OpenAPI Overlay 1.1.0, **always JSON**. Produced by **Write tool to `./.jentic-improve-work/overlay.json`** (work-dir authoring), then **`cp -- ./.jentic-improve-work/overlay.json "<OUT_DIR>/overlay.json"`** (Bash).
- `<OUT_DIR>/changelog.md` — markdown summary with score before/after comparison. Produced by **Write tool to `./.jentic-improve-work/changelog.md`** (work-dir authoring), then **`cp -- ./.jentic-improve-work/changelog.md "<OUT_DIR>/changelog.md"`** (Bash).
- `<OUT_DIR>/token-usage.json` — **only when benchmark metrics are explicitly requested** (see "Benchmark metrics"). The LLM token usage the **scoring engine** consumed across this run. Produced by a `jq` aggregation over the run's scorecard files, redirected into `./.jentic-improve-work/token-usage.json`, then **`cp -- ./.jentic-improve-work/token-usage.json "<OUT_DIR>/token-usage.json"`** (Bash).
- `<OUT_DIR>/benchmark-summary.json` — **only when benchmark metrics are explicitly requested** (see "Benchmark metrics"). The run outcome — score/level/grade before and after, and iterations run. Produced by a `jq` read of the baseline and final scorecards, redirected into `./.jentic-improve-work/benchmark-summary.json`, then **`cp -- ./.jentic-improve-work/benchmark-summary.json "<OUT_DIR>/benchmark-summary.json"`** (Bash).

### Benchmark metrics

This is an **opt-in** step, off by default. Emit `token-usage.json` and `benchmark-summary.json` (and, for token usage, score with `--report-token-usage`) **only when the invoker explicitly asks** for benchmark metrics — e.g. a benchmarking harness whose task prompt says to report token usage and the run summary. A normal "improve my API" run produces **neither** file and does **not** add `--report-token-usage`; it emits only the three default artifacts.

**Token usage** (`token-usage.json`): add `--report-token-usage` to the baseline `score` call and every in-loop re-score (so the engine adds a top-level `tokenUsage` object — `{inputTokens, outputTokens, totalTokens, llmCalls, model, provider}` — to each scorecard). Then aggregate those with a single `jq` call over the run's scorecard files (the baseline `./.jentic-improve-work/scorecard.json` plus each in-loop `./.jentic-improve-work/score-iter-N.json`; covered by `Bash(jq *)`), summing them into one `./.jentic-improve-work/token-usage.json` — the run total plus a per-score breakdown — then `cp` it to `<OUT_DIR>` in the placement block. This is engine-side usage only; it does not include the coding agent's own tokens. `--report-token-usage` is meaningful only alongside `--with-llm`; if the run is not `--with-llm`, write `{"withLlm": false, "totalTokens": null, "scores": []}` rather than fabricating numbers. Shape:

```json
{
  "withLlm": true,
  "inputTokens": 18882, "outputTokens": 13650, "totalTokens": 32532, "llmCalls": 9,
  "model": "eu.anthropic.claude-haiku-4-5-20251001-v1:0", "provider": "BEDROCK",
  "scores": [
    { "file": "scorecard.json", "inputTokens": 6294, "outputTokens": 4550, "totalTokens": 10844, "llmCalls": 3 }
  ]
}
```

**Run summary** (`benchmark-summary.json`): the run outcome, independent of `--with-llm`. Read `.summary.{score,level,grade}` from the baseline scorecard (`./.jentic-improve-work/scorecard.json`) as the "before" values and from the scorecard of the iteration the skill actually **shipped** (the best clean pass — the highest-scoring `./.jentic-improve-work/score-iter-N.json` whose dimensions are all at or above baseline per the no-regression check; the baseline when no iteration cleared that bar) as the "after" values, with `iterationsRun` = the count of `score-iter-*.json` files. Note this is **not** necessarily the highest-numbered iteration: a later iteration that regressed a dimension was not shipped, so its scorecard is not the "after". Do this as a single `jq` call (covered by `Bash(jq *)`) redirected to `./.jentic-improve-work/benchmark-summary.json`, then `cp` it to `<OUT_DIR>` in the placement block. If a value is unavailable, write `null` — never fabricate. Shape:

```json
{
  "scoreBefore": 64.88, "scoreAfter": 67.46, "iterationsRun": 2,
  "levelBefore": "ai-aware", "levelAfter": "ai-aware",
  "gradeBefore": "B", "gradeAfter": "B+"
}
```

When `$1` is an explicit output directory that may not exist yet, create it first with `mkdir -p "<OUT_DIR>"` (a single flat directory — never a `meta/qa/...` path). When `OUT_DIR` is the input's own directory it already exists, so no `mkdir` is needed.

**Verify the overlay after placement.** Once the spec and overlay are placed, prove the overlay actually reproduces the improved spec — schema validity (the `check-jsonschema` step) is necessary but not sufficient. Run, as a separate Bash call:

```bash
jentic-apitools verify-improvement --original "$0" --improved "<OUT_DIR>/<output-spec-filename>" --overlay "<OUT_DIR>/overlay.json" -q
```

Use the original input (`$0`) as `--original` and the placed JSON spec as `--improved`. React to the exit code: `0` — verified, proceed; `2` — mismatch (the `diff` field shows what differs): the overlay is wrong or lossy, so regenerate it to match the edits that were actually applied, re-place it, and re-verify — at most **2 regenerate-and-re-verify attempts**, after which stop and report the remaining `diff` to the user (the improved spec is correct and already placed; only the overlay could not be made to reproduce it). Never ship an overlay that passed only the schema check but failed this verification without telling the user. `1` — operational error (e.g. missing `npx`, unreadable input): report the cause and stop. This runs before the end-of-run cleanup, and uses only `$0` and the placed `OUT_DIR` files (it is unaffected by the work-dir cleanup).

**Why work-dir-then-cp for these final files**: IDE integrations (notably PyCharm) intercept Write tool calls to "new" files in user-visible paths and show a confirmation dialog that prompts even under `acceptEdits` mode. Bash file operations (`cp`, `mkdir`, `npx`, `python3` script.py) do NOT trigger this dialog. Writing the overlay and changelog into `./.jentic-improve-work/` first (a hidden directory the IDE doesn't watch), then `cp`ing the final file to its destination via Bash, keeps the final-placement block silent. Never use the Write tool directly on a destination path outside `./.jentic-improve-work/`.

### Changelog format

The `<datetime>` for the `Date:` line is computed ONCE at the start of the run via a single Python invocation (no shell substitution; covered by `Bash(python3 *)`) and inlined as a literal — it is used only in the changelog body, never in a path:

```bash
python3 -c "from datetime import datetime; print(datetime.now().strftime('%Y%m%dT%H%M%S'))"
```

The `changelog.md` must follow this structure:

```markdown
# Changelog — <API name>

Date: <datetime>

## Score Comparison

| | Before | After | Delta |
|---|---|---|---|
| Score | <N> | <N> | <+/-N> |
| Level | <name> | <name> | |
| Grade | <G> | <G> | |

## Dimension Changes

| Dimension | Before | After | Delta |
|---|---|---|---|
| <kind> | <N> | <N> | <+/-N> |

## Changes Applied

<bulleted list of changes by category>

## Output Files

- `openapi.json` (or `openapi-improved.json`) — improved specification
- `overlay.json` — overlay
- `changelog.md` — this file
- `token-usage.json` — engine LLM token usage for this run (only when benchmark metrics are requested)
- `benchmark-summary.json` — run outcome: score/level/grade before+after, iterations (only when benchmark metrics are requested)
```

## Subagent Brief Template

When spawning a subagent for iterative improvement, fill in the placeholders below and pass the entire block as the subagent's task prompt.

Context efficiency rules for the spawning agent:
- Do NOT read the spec file into your own context before spawning
- Pass file paths, not file contents
- Include only the dimension strategies for dimensions scoring below 60, not all six

````
You are improving an OpenAPI specification for AI-readiness.

Do NOT install or use external validators (spectral-cli, openapi-spec-validator, etc.). Use only the CLIs provided below.

Follow the parent skill's "Forbidden Shell Idioms" section (no `$(...)`, no `<<` heredocs, no `cd`, no `git`, no compound `&&`/`;`/`|` commands, no multi-line `python3 -c` with `#` comments, no pipes through non-allowlisted commands). Every Bash invocation you issue must comply.

Working spec path: <literal-absolute-path-to-working-copy>   # writable working copy — edit, validate, and re-score this file
Original spec path: <literal-original-$0>                    # READ-ONLY: the "before" side of the overlay diff and the `--original` for verify-improvement. Absolute path for a local file $0; the http(s) URL verbatim when $0 is a URL (verify-improvement accepts a URL here)
Run timestamp: <literal-YYYYMMDDTHHMMSS>                     # computed once by the parent via python3 -c; used only in the changelog body, not in any path
Baseline: score <N>, level <L>, grade <G>
Weak dimensions: <list of dimensions below 60 with scores, e.g. "ARAX: 54, SEC: 42">
Semantic suggestions file: <path or "not available" if --with-llm was not used>
Scorecard file: ./.jentic-improve-work/scorecard.json   # carries both summary.dimensions[] and the diagnostics bundle
Working directory: ./.jentic-improve-work
Output directory: <literal-absolute-OUT_DIR>               # $1 if provided, else dirname($0); the outputs go here, flat
Report benchmark metrics: <yes | no>                      # when "yes", pass --report-token-usage to every score and emit token-usage.json + benchmark-summary.json; default "no"
Output spec filename: <openapi.json | openapi-improved.json>   # openapi-improved.json when OUT_DIR is the same dir as the original, else openapi.json
Overlay schema path: <skill-base-dir>/references/overlay-1.1.0-json-schema.yaml

All `<literal-…>` and `<skill-base-dir>` values above are filled in by the parent as plain strings — the brief contains no shell variables and no `$(...)` substitutions. `<skill-base-dir>` is the absolute path Claude Code provided at session start in the system message `Base directory for this skill: <PATH>` (typically `/home/<user>/.claude/skills/jentic-api-improve` for user-scope installs, or `<project>/.claude/skills/jentic-api-improve` for project-scope). Do NOT use `find`, `locate`, `which`, or any other discovery mechanism to locate the schema — the base directory is always provided up-front in the system context.

## CLIs

Re-score: `npx -y @jentic/api-scorecard-cli@latest score "<working-spec-path>" --with-llm --format json --detail diagnostics -o ./.jentic-improve-work/score-iter-N.json -q`
Validate: `jentic-openapi-tools validate -a -q --format json -o ./.jentic-improve-work/validate-iter-N.json "<working-spec-path>"`
Validate overlay (schema): `check-jsonschema --schemafile <overlay-schema-path> <overlay-file>`
Verify overlay (transform): `jentic-apitools verify-improvement --original "<original-spec-path>" --improved "<improved-spec-path>" --overlay "<overlay-file>" -q`
YAML to JSON: `npx -y yaml --json --single < input.yaml > output.json`

`<working-spec-path>` is the writable working copy provided in the brief — substitute the literal path. The original spec path MUST NOT appear as a target of any edit, validate, or re-score command. Each `score` call costs one scorecard quota unit (regardless of `--with-llm`); validating first avoids spending one on a broken edit. After every `score` call check the exit code before reading the JSON — on 7 (quota) or 8 (LLM failure) STOP and report; on 4 (Docker) STOP; on 2/3 (auth) STOP and ask for `JENTIC_API_KEY`.

## Improvement Loop

Run a maximum of 2 iterations, then report back and ask the user whether to continue — regardless of score delta. Stop early only if the top band is reached (`summary.score >= 90`, i.e. `summary.level` is `agent-optimized`).

Issue every step below as a SEPARATE Bash/Write tool call. NEVER chain them with `&&`, `;`, or `|` — compound commands trigger a prompt even when each piece is allowlisted.

For each iteration N:
1. If a semantic suggestions file is available and this is the first iteration, read it and apply applicable suggestions first.
2. **Write** `./.jentic-improve-work/edit-iter-N.py` with the edit script contents (Write tool, not heredocs). Do NOT read the full spec into context — work from the brief's structure descriptions. The script reads AND writes the working-spec-path; it must never open the original.
3. **Run** the script: `python3 ./.jentic-improve-work/edit-iter-N.py` (separate Bash call).
4. **Validate**: `jentic-openapi-tools validate -a -q --format json -o ./.jentic-improve-work/validate-iter-N.json "<working-spec-path>"` (separate Bash call). On validate failure: `cp -- "<original-spec-path>" "<working-spec-path>"` and try a different edit next iteration — do NOT proceed to re-score (a metered scorecard call must never be spent on a spec a failed edit broke). Never `git` or `cd`.
5. **Re-score**: `npx -y @jentic/api-scorecard-cli@latest score "<working-spec-path>" --with-llm --format json --detail diagnostics -o ./.jentic-improve-work/score-iter-N.json -q` (separate Bash call). Check the exit code before reading the file: on 7 (quota) or 8 (LLM failure) STOP and report; on 4 (Docker) or 2/3 (auth) STOP. Each call costs one quota unit regardless of `--with-llm`.
6. **Extract summary + dimensions**: `jq '{summary, dimensions: .summary.dimensions}' ./.jentic-improve-work/score-iter-N.json` (separate Bash call). Read both the overall `summary.score` and every `summary.dimensions[].score`.
7. **No-regression check (before deciding to continue).** Compare every `summary.dimensions[].score` against the baseline scorecard's same dimension. This iteration is **clean** iff every dimension is at or above baseline (an additive edit that lowered any dimension broke something it shouldn't — most often a `$ref`-sibling; see "Never ship a regression" in the parent skill). If the iteration is **not** clean, restore the last-good working copy with `cp -- ./.jentic-improve-work/spec-last-good.<EXT> "<working-spec-path>"` (separate Bash call), do not ship this iteration, and either re-attempt a narrower edit next iteration or stop. If the iteration **is** clean **and** its overall `summary.score` beats the current last-good's score, promote it to the new last-good: `cp -- "<working-spec-path>" ./.jentic-improve-work/spec-last-good.<EXT>` (separate Bash call). (Seed the first last-good snapshot from the untouched baseline working copy before iteration 1, so its "score to beat" is the baseline score.) The last-good snapshot is therefore always the best clean pass; the spec you ship at the end is exactly `spec-last-good.<EXT>` — never the raw final iteration, which may have regressed.
8. If the shipped score improved >= 2 points over baseline, continue for another iteration. Otherwise stop.

When the loop is done, place the outputs flat in `<OUT_DIR>` (the literal Output directory from the brief) in this order (each step a SEPARATE Bash/Write call — no chaining). Steps F2 and F3 run only when the brief's "Report benchmark metrics" is "yes":

A0. **Restore the shipped spec.** `cp -- ./.jentic-improve-work/spec-last-good.<EXT> ./.jentic-improve-work/spec.<EXT>` (separate Bash call), so the working copy placed below is exactly the best clean pass from the no-regression check — never a final iteration that regressed or scored below an earlier clean pass.
A. If `<OUT_DIR>` is an explicit directory that may not exist yet: `mkdir -p "<OUT_DIR>"` (a single flat directory — never a `meta/qa/...` path). Skip when `<OUT_DIR>` is the original's own directory (it already exists).
B. Place the spec as JSON: `cp -- ./.jentic-improve-work/spec.<EXT> "<OUT_DIR>/<output-spec-filename>"` when the working copy is JSON, or `npx -y yaml --json --single < ./.jentic-improve-work/spec.<EXT> > "<OUT_DIR>/<output-spec-filename>"` when it is YAML. `<output-spec-filename>` is the value from the brief (`openapi.json` or `openapi-improved.json`).
C. **Write** `./.jentic-improve-work/overlay.json` via Write tool (always JSON; do NOT use Write directly on the destination path).
D. `cp -- ./.jentic-improve-work/overlay.json "<OUT_DIR>/overlay.json"` (separate Bash call).
E. **Write** `./.jentic-improve-work/changelog.md` via Write tool.
F. `cp -- ./.jentic-improve-work/changelog.md "<OUT_DIR>/changelog.md"` (separate Bash call).
F2. **Only when benchmark metrics were requested** (brief "Report benchmark metrics: yes"; skip this step entirely otherwise): aggregate engine token usage with a single `jq` call over the run's scorecard files (the baseline `./.jentic-improve-work/scorecard.json` plus each `./.jentic-improve-work/score-iter-N.json`, each scored with `--report-token-usage` so it carries a top-level `tokenUsage`), summing into a run total plus per-score breakdown, redirected to `./.jentic-improve-work/token-usage.json`; then `cp -- ./.jentic-improve-work/token-usage.json "<OUT_DIR>/token-usage.json"` (separate Bash call). If the run was not `--with-llm`, write `{"withLlm": false, "totalTokens": null, "scores": []}` — never fabricate. See the parent skill's "Benchmark metrics" section for the exact shape.
F3. **Only when benchmark metrics were requested** (same gate as F2; skip otherwise): with a single `jq` call, read `.summary.{score,level,grade}` from the baseline `./.jentic-improve-work/scorecard.json` (before) and from the scorecard of the iteration the skill **shipped** (after — the best clean pass per step 7's no-regression check, i.e. the highest-scoring `./.jentic-improve-work/score-iter-N.json` whose dimensions are all ≥ baseline; the baseline when none cleared that bar — **not** simply the highest-numbered iteration), plus `iterationsRun` = the count of `score-iter-*.json` files, redirected to `./.jentic-improve-work/benchmark-summary.json`; then `cp -- ./.jentic-improve-work/benchmark-summary.json "<OUT_DIR>/benchmark-summary.json"` (separate Bash call). Write `null` for any unavailable value — never fabricate. See the parent skill's "Benchmark metrics" section for the exact shape.
G. **Verify the overlay** (separate Bash call): `jentic-apitools verify-improvement --original "<original-spec-path>" --improved "<OUT_DIR>/<output-spec-filename>" --overlay "<OUT_DIR>/overlay.json" -q`. Use the read-only original spec path from the brief as `--original` and the placed JSON spec as `--improved`. This is on top of the `check-jsonschema` schema check (step in "Overlay Format"). React to the exit code: `0` verified — proceed to report; `2` mismatch — read the `diff` in the JSON, regenerate `./.jentic-improve-work/overlay.json` so it matches the edits actually applied, re-place it (steps C–D), and re-run G, for **at most 2 regenerate-and-re-verify attempts**; if it still mismatches after that, stop and report the remaining `diff` to the user rather than looping (the improved spec is correct and already placed — only the overlay could not be made to reproduce it). Never report success with an overlay that fails verification. `1` operational error (e.g. missing `npx`, unreadable input) — report the cause and stop.

Steps C-F use the work-dir-then-cp pattern because the Write tool against destination paths triggers IDE confirmation dialogs (e.g. PyCharm) that prompt the user even under `acceptEdits` mode. Writing into `./.jentic-improve-work/` first and `cp`ing via Bash keeps the final block silent.

Do NOT delete `./.jentic-improve-work` when you finish — you may be re-spawned for another round, and the parent removes the work directory at the end of the run (see the parent skill's "Cleanup at end of run").

## Context Efficiency Rules

- NEVER read the full spec file into context — always use Python scripts to edit
- Write edits as self-contained Python scripts that load, modify, and save the file
- Keep score outputs out of context — save to files and read only the summary
- Read the semantic suggestions file once, extract what you need, then discard

## Edit Pattern

Each iteration's edits are applied via a two-step workflow, issued as **two separate Bash/Write calls** (no `&&` chaining):

1. Use Claude Code's **Write tool** to create `./.jentic-improve-work/edit-iter-N.py` (replace `N` with the iteration number, e.g. `edit-iter-1.py`) with the script contents. Because the WORK-dir setup cleans `./.jentic-improve-work/` at the start of the run, the file is guaranteed not to exist on first Write — no prior Read is needed. DO NOT use `cat > file.py << 'EOF' ... EOF` heredocs — they trip the expansion-obfuscation guard.
2. Run the script with one bash invocation (covered by `Bash(python3 *)`):

   ```bash
   python3 ./.jentic-improve-work/edit-iter-N.py
   ```

In the script templates below, `<working-spec-path>` is the writable working copy (the file at `./.jentic-improve-work/spec.<EXT>` materialised during the WORK-dir setup step) — never the original input path. The original input MUST NOT be opened for write at any point. Both `open(...)` calls below — read and write — refer to the same working copy.

JSON template (Write this file to `./.jentic-improve-work/edit-iter-N.py`, then run it):

```python
#!/usr/bin/env python3
import json

with open('<working-spec-path>') as f:
    spec = json.load(f)

# Apply targeted changes
spec['paths']['/users']['get']['summary'] = 'List all users in the organisation'
spec['paths']['/users']['get']['description'] = 'Returns a paginated list of all active users...'

with open('<working-spec-path>', 'w') as f:
    json.dump(spec, f, indent=2)
```

For YAML specs, use ruamel.yaml to preserve formatting (same Write-then-run workflow):

```python
#!/usr/bin/env python3
from ruamel.yaml import YAML
yaml = YAML()
yaml.preserve_quotes = True

with open('<working-spec-path>') as f:
    spec = yaml.load(f)

spec['paths']['/users']['get']['summary'] = 'List all users in the organisation'

with open('<working-spec-path>', 'w') as f:
    yaml.dump(spec, f)
```

## Dimension Strategies

<main agent inserts only the strategies for weak dimensions here>

## Constraints

All edits MUST be non-breaking.

MUST NOT:
- Change any existing path, HTTP method, or operationId
- Remove or rename any existing parameter
- Change any existing response status code or schema shape
- Remove any existing field from a schema
- Add `operationId` where missing (breaks SDK generators)
- Add new response codes (can't tell if unimplemented or just undocumented)
- Add RFC 9457 to existing error responses (modifies existing schema shape)

MAY ONLY ADD:
- summary, description fields
- example / examples fields
- tags (operations + top-level tags array)
- New non-required schema properties

## Output Files

After the improvement loop has terminated, place the working spec at its final destination by copying — never edit the destination file in place during iteration.

These outputs go flat into `<OUT_DIR>` (the literal Output directory from the brief) — no nested subdirectories. The first three are always produced; the last two only when the brief's "Report benchmark metrics" is "yes":
- `<OUT_DIR>/<output-spec-filename>` — improved spec, always JSON (`<output-spec-filename>` is the brief value: `openapi.json`, or `openapi-improved.json` when `<OUT_DIR>` is the original's own directory). Produced by `cp -- "<working-spec-path>" "<OUT_DIR>/<output-spec-filename>"` when the working spec is JSON, or `npx -y yaml --json --single < "<working-spec-path>" > "<OUT_DIR>/<output-spec-filename>"` when it is YAML. Iterative edits stay in the original format; YAML→JSON conversion happens only at this final step.
- `<OUT_DIR>/overlay.json` — overlay, always JSON. Write to `./.jentic-improve-work/overlay.json` first, then `cp` to destination.
- `<OUT_DIR>/changelog.md` — score comparison and change summary. Write to `./.jentic-improve-work/changelog.md` first, then `cp` to destination.
- `<OUT_DIR>/token-usage.json` — **only when benchmark metrics were requested** — engine LLM token usage aggregated from the run's scorecard files' `tokenUsage` (`{withLlm, inputTokens, outputTokens, totalTokens, llmCalls, model, provider, scores[]}`; `withLlm: false` with null totals when the run was not `--with-llm`). Requesting it means every `score` call adds `--report-token-usage`; produce via a single `jq` aggregation over `./.jentic-improve-work/scorecard.json` + `score-iter-N.json` into `./.jentic-improve-work/token-usage.json`, then `cp` to destination — never fabricate numbers.
- `<OUT_DIR>/benchmark-summary.json` — **only when benchmark metrics were requested** — run outcome (`{scoreBefore, scoreAfter, iterationsRun, levelBefore, levelAfter, gradeBefore, gradeAfter}`) read via a single `jq` call from the baseline `./.jentic-improve-work/scorecard.json` (before) and the scorecard of the iteration the skill shipped (after — the best clean pass whose dimensions are all ≥ baseline, not merely the highest-numbered `score-iter-N.json`; baseline when none cleared that bar), into `./.jentic-improve-work/benchmark-summary.json`, then `cp` to destination. `null` for any unavailable value — never fabricate.

If `<OUT_DIR>` is an explicit directory that may not exist yet, create it first with `mkdir -p "<OUT_DIR>"` (one flat directory — never a `meta/qa/...` path); skip the `mkdir` when `<OUT_DIR>` is the original's own directory.

**Overlay & changelog authoring rule**: ALWAYS use the Write tool against `./.jentic-improve-work/<filename>` first (the hidden work directory), then issue a separate Bash `cp` to move the file to its destination. Do NOT use the Write tool directly on a destination path outside `./.jentic-improve-work/` — IDE integrations (notably PyCharm) intercept Write calls to user-visible paths and show a confirmation dialog that prompts the user even under `acceptEdits` mode. Bash `cp` does not trigger that dialog.

The overlay is always authored as JSON (`overlay.json`). Do NOT use `npx yaml --json` on the overlay; that conversion step applies ONLY to the spec file (working copy → JSON output spec) above.

The original spec path MUST remain unchanged (same content, same mtime) for the entire run.

## Overlay Format

The overlay MUST conform to Overlay 1.1.0, and it MUST actually reproduce the improved spec. Validate it in two steps:

1. Schema check (fast, offline): `check-jsonschema --schemafile <overlay-schema-path> <overlay-file>`
2. Transform check (proves correctness — schema-valid is necessary but not sufficient): `jentic-apitools verify-improvement --original "<original-spec-path>" --improved "<improved-spec-path>" --overlay "<overlay-file>" -q` — exit `0` verified, `2` mismatch (regenerate the overlay from the actual edits and re-verify, at most 2 attempts, then stop and report the `diff`), `1` operational error (report and stop). This is the final-placement step G above.

Structure (authored as JSON in `overlay.json`; shown below in both YAML and JSON for readability — write the JSON form):

```yaml
overlay: "1.1.0"
info:
  title: AI-readiness improvements for <API name>
  version: "1.0.0"
actions:
  - target: "$.paths['/example'].get"
    update:
      summary: "Retrieve a single example resource by ID"
      description: "Returns the full representation of..."
  - target: "$.paths['/example'].get.parameters[?@.name=='id']"
    update:
      description: "The unique identifier of the example resource"
```

```json
{
  "overlay": "1.1.0",
  "info": {
    "title": "AI-readiness improvements for <API name>",
    "version": "1.0.0"
  },
  "actions": [
    {
      "target": "$.paths['/example'].get",
      "update": {
        "summary": "Retrieve a single example resource by ID",
        "description": "Returns the full representation of..."
      }
    },
    {
      "target": "$.paths['/example'].get.parameters[?@.name=='id']",
      "update": {
        "description": "The unique identifier of the example resource"
      }
    }
  ]
}
```

Key rules:
- `target` is a JSONPath expression (RFC 9535) identifying what to update
- `update` merges new values into the target object; appends to arrays
- `remove: true` removes the target — never use it; removing elements is breaking
- Actions applied in order — later actions override earlier ones

## Report When Done

- Baseline score -> final score (level, grade)
- Iterations completed
- Changes made by dimension
- Output file paths
- Always ask the user whether to continue with another round (unless the top band is reached: `summary.score >= 90` / `summary.level` `agent-optimized`)

## Cleanup at end of run

The work directory `./.jentic-improve-work` is the only temporary artifact the run creates. Once the run is over, the parent agent MUST remove it as the final action, issued as its own separate Bash call (covered by `Bash(python3 *)`; `rm` is not in `allowed-tools`):

```bash
python3 -c "import shutil; work_dir='./.jentic-improve-work'; shutil.rmtree(work_dir, ignore_errors=True)"
```

"Over" means any terminal exit: the user has declined another round (or the top band was reached), OR the run stopped on a terminal error (exit codes 2/3/4/7/8 — see "Scoring exit codes and quota"). Run this cleanup on every such exit so no temporary files are left behind. `ignore_errors=True` makes it safe even when an error stop left the directory partially populated or already gone.

The work-dir path is bound to a `work_dir` variable before the `shutil.rmtree(work_dir, …)` call (rather than inlining the path literal as the first argument) purely so static security scanners don't flag the call as destructive parameter abuse — the behaviour is identical (it only ever removes this skill's own bounded work directory). Keep the variable form when editing.

Do NOT run cleanup between iteration rounds or before the "continue with another round?" decision — the working copy and scorecards in `./.jentic-improve-work` are reused if the user asks for another round. The parent owns this cleanup; a spawned subagent never deletes the work directory (it may be re-spawned for the next round).
````

## Spawning the Subagent

Once you have the baseline data:

1. Fill in all placeholders in the Subagent Brief Template above:
   - Replace `<absolute-path-to-./.jentic-improve-work/spec.<EXT>>` (the **Working spec path**) with the absolute path to the working copy created during WORK-dir setup — this is the file the subagent edits, validates, and re-scores.
   - Replace `<absolute-path-to-$0>` (the **Original spec path**) with the absolute path to `$0` when `$0` is a local file, or the `http(s)` URL verbatim when `$0` is a URL (`verify-improvement` accepts a URL as `--original`). This is read-only — the "before" side of the overlay diff and the `--original` for the step-G verification.
   - Replace `<working-spec-path>` placeholders in the CLI examples with the same working spec path.
   - Replace baseline score, level, grade from the extracted scorecard summary
   - Replace weak dimensions with the actual dimension scores below 60
   - Replace semantic suggestions file path (or "not available")
   - Replace `<skill-base-dir>` (the **Overlay schema path** prefix) with the absolute path Claude Code provided at session start in the `Base directory for this skill: <PATH>` system message (e.g. `/home/<user>/.claude/skills/jentic-api-improve` for user-scope installs). The brief field becomes the joined absolute path, e.g. `/home/<user>/.claude/skills/jentic-api-improve/references/overlay-1.1.0-json-schema.yaml`. Do NOT use `find`, `locate`, or any discovery mechanism to derive this path.
   - Resolve and fill in the **Output directory** (`$1` if provided, else the absolute `dirname($0)`) and the **Output spec filename** (`openapi-improved.json` when that directory is the original's own directory, else `openapi.json`)
   - Set **Report benchmark metrics** to "yes" only if the invoker explicitly asked for benchmark metrics (e.g. a benchmarking task prompt); otherwise "no". When "yes", the subagent adds `--report-token-usage` to every score and emits `token-usage.json` + `benchmark-summary.json`.
   - Insert only the dimension strategies for weak dimensions (from the Dimension Improvement Strategies section)
   - Include the Constraints and Overlay Format sections (they apply to every run)

2. Spawn the subagent with the constructed brief.

3. When the subagent reports back, surface the results to the user: baseline vs final score, what changed, output file paths.

## OpenAPI Overlay Format

For the full Overlay 1.1.0 specification, examples, JSONPath reference, and common AI-readiness improvement patterns, see [openapi-overlay-spec.md](references/openapi-overlay-spec.md). Load only when you need to understand overlay structure or troubleshoot overlay generation.

The overlay JSON Schema for validation is at [overlay-1.1.0-json-schema.yaml](references/overlay-1.1.0-json-schema.yaml).

## JAIRF Reference

For the full JAIRF scoring specification — exact signal formulas, normalization rules, gating caps, and conformance requirements — see [jairf-scoring-guide.md](references/jairf-scoring-guide.md). Load this when you need to understand exactly how a score is calculated. Do NOT load unless specifically needed.

## Decision Guide

| Situation | Action |
|-----------|--------|
| Need baseline for a spec | Run one `score --with-llm --detail diagnostics`, extract summary |
| Score low but unclear why | Check per-dimension breakdown; lowest = highest priority |
| FC < 40 | Fix structural/lint issues first — gating rule |
| User says "improve this API" | Run baseline, then apply non-breaking improvements (output: improved spec + overlay) |
| Few clear fixes (POOR_OPERATION_SEMANTICS) | Apply inline, no subagent needed |
| Multiple dimensions need work | Spawn subagent for iterative loop |
| Hardcoded credentials | Must remove — SEC capped at 20 |
| Want to track improvement over time | Save JSON output with `--output` and compare across runs |
