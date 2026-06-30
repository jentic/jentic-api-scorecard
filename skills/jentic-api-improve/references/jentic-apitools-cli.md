# Jentic API Tools CLI — `verify-improvement`

`jentic-apitools` is the public Jentic API Tools CLI (PyPI package `jentic-apitools-cli`). The improve skill uses one command from it — `verify-improvement` — to confirm that the generated OpenAPI Overlay actually turns the original spec into the improved spec.

This is a second, stronger check layered **on top of** the Overlay 1.1.x JSON Schema validation (`check-jsonschema`). A schema-valid overlay can still target the wrong node or encode a lossy transform: it can pass the schema yet fail to reproduce the improved spec. `verify-improvement` applies the overlay(s) to the original and structurally compares the result against the improved spec, so it proves the transform is correct.

## Install

Install from PyPI with [pipx](https://pipx.pypa.io/) or [uv tool](https://docs.astral.sh/uv/guides/tools/) (note: the package name is `jentic-apitools-cli`, the command is `jentic-apitools`):

```bash
pipx install jentic-apitools-cli
# or
uv tool install jentic-apitools-cli
```

Upgrade with `pipx upgrade jentic-apitools-cli`. The default overlay engine uses `npx` (Node.js, already required by this skill).

## `verify-improvement`

Applies one or more Overlay 1.1.x documents to an original OpenAPI spec and confirms the result reproduces a given improved spec. Runs entirely locally; never touches GitHub. Every overlay is validated against the Overlay 1.1.x schema before being applied, and the match is structural and order-insensitive.

```bash
jentic-apitools verify-improvement --original SPEC --improved SPEC --overlay OVERLAY [--overlay OVERLAY ...] [-q]
```

Options:

```
--original SPEC    Original (input) bundled spec — path, http(s) URL, or - for stdin. Required.
--improved SPEC    Improved (expected output) bundled spec — path, http(s) URL, or - for stdin. Required.
--overlay OVERLAY  Overlay 1.1.x document — path, http(s) URL, or - for stdin. Repeatable; applied in order. Required.
-q, --quiet        Suppress log output; only emit the result JSON.
```

Only one slot per invocation may consume stdin (`-`).

## Output

A single JSON document on stdout:

```json
{ "success": true, "match": true, "overlay_count": 1, "diff": "" }
```

`diff` is a structural DeepDiff of the improved spec versus the spec produced by applying the overlays; it is empty when they match and populated on a mismatch, e.g.:

```json
{ "success": false, "match": false, "overlay_count": 1,
  "diff": "{\"values_changed\": {\"root['paths']['/users']['get']['description']\": {\"new_value\": \"...\", \"old_value\": \"...\"}}}" }
```

## Exit codes

| Code | Meaning | Reaction in the improve workflow |
|---|---|---|
| 0 | The overlay(s) reproduce the improved spec (`match: true`). | Verified — proceed. |
| 2 | Clean verification mismatch: overlays applied, but the result differs (`match: false`, `diff` populated). | The overlay is wrong or lossy. Read the `diff`, regenerate the overlay so it matches the edits actually applied, re-place it, and re-verify. Never ship an overlay that fails verification. |
| 1 | Operational error: unreadable/missing input, an overlay that fails Overlay 1.1.x schema validation, or an apply failure (e.g. missing `npx`). | Report the cause and stop. |

## Overlay backend

The engine is selected by the `OVERLAY_BACKEND` environment variable. The default `speclynx` backend requires `npx` (Node.js) and handles all Overlay 1.1.x targets, including numeric list indices such as `$.servers[0]`. Setting `OVERLAY_BACKEND=oas_patch` runs an in-process engine that needs no `npx` but crashes on numeric list-index targets — prefer the default.
