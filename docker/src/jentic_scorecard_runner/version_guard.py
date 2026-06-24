"""Reject OpenAPI versions the scoring engine cannot score correctly.

OpenAPI 3.2 is not parseable by the dominant count-based analyzer (SpecLynx):
every count-signal collapses to zero and, with nothing left to penalize, a 3.2
document scores *higher* than the same document at 3.0.x. The score is silently
inflated and meaningless, so we refuse it rather than emit a wrong number. See
``docs/architecture.md`` §6 and issue #113.

Version *detection* delegates to the engine's canonical
``jentic.apitools.openapi.common.version_detection`` (the single source of truth
for parsing OpenAPI/Swagger version strings); the *policy* — which versions we
refuse — stays here. The runner feeds it the spec bytes it already buffers
(stdin mode) and the ``specificationVersion`` the scorecard contract emits (URL
mode).
"""

import json

from jentic.apitools.openapi.common.version_detection import is_openapi_32


def is_unsupported(version: str | None) -> bool:
    """True if the version string is an OpenAPI 3.2.x we refuse to score."""
    return version is not None and is_openapi_32({"openapi": version})


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


# Informational diagnostics the engine emits when it converts the input to OAS3.
SWAGGER_2_DIAGNOSTIC_CODE = "imported-spec-is-swagger-2"
GOOGLE_DISCOVERY_DIAGNOSTIC_CODE = "imported-spec-is-google-discovery"


def conversion_notice_message(source_format: str) -> str:
    """The stderr notice shown when the input was auto-converted to OpenAPI 3.0."""
    return (
        f"notice: input is {source_format}; scored against an auto-converted OpenAPI 3.0 "
        "copy. Diagnostic locations (line/column, JSON Pointer) may not match your "
        "original file.\n"
    )
