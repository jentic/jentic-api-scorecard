"""Reject OpenAPI versions the scoring engine cannot score correctly.

OpenAPI 3.2 is not parseable by the dominant count-based analyzer (SpecLynx):
every count-signal collapses to zero and, with nothing left to penalize, a 3.2
document scores *higher* than the same document at 3.0.x. The score is silently
inflated and meaningless, so we refuse it rather than emit a wrong number. See
``docs/architecture.md`` §6 and issue #113.

This guard depends on nothing from the scoring engine. It reads the spec bytes
the runner already buffers (stdin mode) and the ``specificationVersion`` the
scorecard contract already emits (URL mode) — both seams survive a future move
to a remote scoring API.
"""

import json
import re


# Matches the top-level version key in JSON or YAML, e.g.
#   "openapi": "3.2.0"   |   openapi: 3.2.0   |   swagger: "2.0"
_VERSION_PATTERN = re.compile(
    r'^\s*["\']?(?:openapi|swagger)["\']?\s*:\s*["\']?(?P<version>\d+\.\d+(?:\.\d+)?)',
    re.MULTILINE,
)


def is_unsupported(version: str | None) -> bool:
    """True if the version string is an OpenAPI 3.2.x we refuse to score."""
    return version is not None and (version == "3.2" or version.startswith("3.2."))


def detect_version(spec_text: str) -> str | None:
    """Extract the OpenAPI/Swagger version from raw spec text (JSON or YAML)."""
    try:
        document = json.loads(spec_text)
    except (json.JSONDecodeError, ValueError):
        document = None
    if isinstance(document, dict):
        version = document.get("openapi") or document.get("swagger")
        if isinstance(version, str):
            return version
    match = _VERSION_PATTERN.search(spec_text)
    return match.group("version") if match else None


def scorecard_version(scorecard_bytes: bytes) -> str | None:
    """Read ``apiMetadata.specificationVersion`` from a scorecard JSON payload."""
    try:
        document = json.loads(scorecard_bytes)
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(document, dict):
        return None
    metadata = document.get("apiMetadata")
    if isinstance(metadata, dict):
        version = metadata.get("specificationVersion")
        if isinstance(version, str):
            return version
    return None


def unsupported_version_message(version: str) -> str:
    """The stderr message shown when an unsupported version is rejected."""
    return (
        f"error: OpenAPI {version} is not supported. The scoring engine cannot parse it "
        "and would emit an inflated, meaningless score.\n"
        "Supported: OpenAPI 3.0.x and 3.1.x (Swagger 2.0 and Google Discovery are "
        "auto-converted to 3.0 and scored).\n"
        "See https://github.com/jentic/jentic-api-scorecard/issues/113.\n"
    )
