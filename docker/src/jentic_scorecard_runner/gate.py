"""Anonymous gate and live key validation.

Order of decisions in `check_gate`:

1. URLs under `jentic-public-apis` are always free — score without contacting
   the Jentic backend, regardless of whether a key is set.
2. Without a key, only allowlisted URLs are accepted; stdin is rejected.
3. `JENTIC_API_KEY=mvp-preview` is honored as a deprecated free-pass during
   the alpha (one-minor-version migration window per `specs/roadmap.md`
   Phase 13). A deprecation warning is printed to stderr.
4. Any other key is validated live against `api.jentic.com`. The container
   fails open if the validator is unreachable so an outage on Jentic's side
   does not block scoring.
"""

import os
import re
import sys
from typing import assert_never

from jentic_scorecard_runner.exit_codes import ExitCode
from jentic_scorecard_runner.usage import (
    UsageAllowed,
    UsageInvalidKey,
    UsageRateLimited,
    UsageUnverifiable,
    check_usage,
)


_MVP_KEY = "mvp-preview"

_ALLOWLIST_PATTERN = re.compile(
    r"^https://raw\.githubusercontent\.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/"
)


def check_gate(url: str | None) -> ExitCode:
    """Returns SUCCESS if the request is allowed, or a non-zero exit code."""
    if url is not None and _ALLOWLIST_PATTERN.match(url):
        return ExitCode.SUCCESS

    key = os.environ.get("JENTIC_API_KEY", "").strip()

    if not key:
        if url is None:
            print(
                "error: scoring from stdin requires a Jentic API key.\n"
                "  Sign up for a key at https://jentic.com/signup and retry:\n"
                "    export JENTIC_API_KEY=<your-key>",
                file=sys.stderr,
            )
            return ExitCode.AUTH_INVALID_KEY
        print(
            "error: anonymous scoring is restricted to OpenAPI documents hosted at:\n"
            "  https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/\n"
            "  Browse available documents:\n"
            "    https://github.com/jentic/jentic-public-apis/tree/main/apis/openapi\n"
            "  Or sign up for a key:\n"
            "    https://jentic.com/signup",
            file=sys.stderr,
        )
        return ExitCode.GATE_REJECTED

    if key == _MVP_KEY:
        print(
            "DEPRECATED: JENTIC_API_KEY=mvp-preview will stop working in a future release; "
            "sign up at https://jentic.com/signup for a real key.",
            file=sys.stderr,
        )
        return ExitCode.SUCCESS

    result = check_usage(key)

    match result:
        case UsageAllowed():
            return ExitCode.SUCCESS
        case UsageRateLimited(detail=detail, retry_after=retry_after):
            message = f"error: rate limit reached for your Jentic API key.\n  {detail}"
            if retry_after is not None:
                message += f"\n  Retry-After: {retry_after}"
            message += "\n  Manage your usage at https://jentic.com/account"
            print(message, file=sys.stderr)
            return ExitCode.RATE_LIMITED
        case UsageInvalidKey(detail=detail):
            print(
                "error: this key is not recognized.\n"
                f"  {detail}\n"
                "  Check or regenerate your key at https://jentic.com/account",
                file=sys.stderr,
            )
            return ExitCode.AUTH_INVALID_KEY
        case UsageUnverifiable(reason=reason):
            print(
                f"warning: could not reach api.jentic.com to validate key ({reason}); "
                "proceeding with scoring.",
                file=sys.stderr,
            )
            return ExitCode.SUCCESS
        case _:
            assert_never(result)
