# oasdiff — breaking-change detection

[`oasdiff`](https://github.com/oasdiff/oasdiff) is an open-source OpenAPI diff tool. The improve skill uses one command from it — `oasdiff breaking` — to detect whether the improved spec breaks the contract of the original spec. It runs in **every** change-scope mode; the mode decides how the skill reacts to a detected break.

This is complementary to `jentic-apitools verify-improvement`: that command proves the *overlay* reproduces the improved spec, whereas `oasdiff breaking` proves the *improved spec* did not break the *original's* contract. Both run after final placement.

## Install

`oasdiff` is a Go binary, not a pip/npm package. Install it once via any of:

```bash
go install github.com/oasdiff/oasdiff@latest
# or
brew install oasdiff
# or run through the Docker image (no local toolchain needed):
docker run --rm -t -v "$PWD:/specs:ro" tufin/oasdiff breaking /specs/<base> /specs/<revision>
```

The skill's `allowed-tools` covers `Bash(oasdiff *)`; when using the Docker image instead, the command runs under `Bash(docker *)` and needs a matching allowlist entry.

## `oasdiff breaking`

Reports the breaking changes introduced when going from a base spec to a revision spec. The improve skill uses the read-only original (`$0`) as the base and the placed improved spec as the revision, so a "breaking change" is any way the improvements broke a caller's existing contract.

```bash
oasdiff breaking BASE REVISION --format json -o OUTFILE
```

Options the skill uses:

```
BASE            Original (read-only) spec — path or http(s) URL.
REVISION        Improved (placed) spec — path or http(s) URL.
--format json   Machine-readable output (default is a human text table).
-o OUTFILE      Write the report to a file (avoids a pipe/redirect, per the skill's Forbidden Shell Idioms).
```

Issue it as a single Bash call writing to a file — never piped or chained (see the parent skill's "Forbidden Shell Idioms").

## Output

With `--format json`, `-o` writes a JSON array of breaking-change objects; the array is empty when nothing broke. Each entry identifies the change (an `id` such as `api-path-removed` or `request-parameter-removed`), its `level`, and the `operation`/`path` it affects.

## Exit codes

| Code | Meaning | Reaction in the improve workflow |
|---|---|---|
| 0 | No breaking change detected. | Proceed. Record "None detected" in the changelog's "Breaking Changes" section. |
| non-zero | At least one breaking change detected (listed in the output file). | **`non-breaking` / `summary-description` modes:** the additive discipline was violated — read the output, report the breaking changes, and STOP (fail the run). **`full` mode:** expected — record every breaking change in the changelog's "Breaking Changes" section and proceed (report-only, not fatal). |

The per-mode reaction is the load-bearing difference: the same non-zero exit fails the run in the two conservative modes and is merely reported in `full`. In every mode the verdict (and any breaking-change list) is written to the changelog so the API owner sees exactly what changed.
