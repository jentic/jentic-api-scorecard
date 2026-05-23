"""Anonymous gate and auth check.

MVP key scheme:
- Unset JENTIC_API_KEY → anonymous mode (only jentic-public-apis URLs allowed).
- "mvp-preview" → authenticated, all inputs allowed.
- Any other value → rejected with guidance message.
"""

import os
import re
import sys

from jentic_scorecard_runner.exit_codes import ExitCode


_MVP_KEY = "mvp-preview"

_ALLOWLIST_PATTERN = re.compile(
    r"^https://raw\.githubusercontent\.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/"
)


def _fail(code: ExitCode, message: str) -> ExitCode:
    print(message, file=sys.stderr)
    return code


def check_gate(url: str | None) -> ExitCode:
    """Returns SUCCESS if the request is allowed, or a non-zero exit code."""
    key = os.environ.get("JENTIC_API_KEY", "")

    if key and key != _MVP_KEY:
        return _fail(
            ExitCode.AUTH_INVALID_KEY,
            "error: this key is not recognized.\n"
            "  During the MVP preview, use: export JENTIC_API_KEY=mvp-preview\n"
            "  Real keys land in a follow-up release.",
        )

    if key == _MVP_KEY:
        return ExitCode.SUCCESS

    # Anonymous mode below
    if url is None:
        return _fail(
            ExitCode.AUTH_INVALID_KEY,
            "error: scoring from stdin requires a Jentic API key.\n"
            "  Set the MVP preview key, then retry:\n"
            "    export JENTIC_API_KEY=mvp-preview",
        )

    if not _ALLOWLIST_PATTERN.match(url):
        return _fail(
            ExitCode.GATE_REJECTED,
            "error: anonymous scoring is restricted to OpenAPI documents hosted at:\n"
            "  https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/\n"
            "  Browse available documents:\n"
            "    https://github.com/jentic/jentic-public-apis/tree/main/apis/openapi\n"
            "  Or set the MVP preview key:\n"
            "    export JENTIC_API_KEY=mvp-preview",
        )

    return ExitCode.SUCCESS
