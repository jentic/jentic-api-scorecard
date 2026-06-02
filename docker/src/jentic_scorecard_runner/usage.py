"""Live key validation against the Jentic usage endpoint.

`check_usage` POSTs to `/api/v1/usage/api-scoring` with the user's API key
and maps the response to a `UsageResult` variant:

- 2xx → UsageAllowed (valid, within quota)
- 429 → UsageRateLimited (valid, over quota)
- 401 / 403 → UsageInvalidKey (unknown key)
- anything else (3xx, unexpected 4xx, 5xx, network error, timeout,
  malformed body) → UsageUnverifiable (caller fails open)

The function never raises.
"""

import os
from dataclasses import dataclass

import requests


_DEFAULT_BASE_URL = "https://api.jentic.com"
_USAGE_PATH = "/api/v1/usage/api-scoring"
_CONNECT_TIMEOUT_SECONDS = 5
_READ_TIMEOUT_SECONDS = 10
_USER_AGENT = "jentic-api-scorecard-runner"


@dataclass(frozen=True)
class UsageAllowed:
    pass


@dataclass(frozen=True)
class UsageRateLimited:
    detail: str
    retry_after: str | None


@dataclass(frozen=True)
class UsageInvalidKey:
    detail: str


@dataclass(frozen=True)
class UsageUnverifiable:
    reason: str


UsageResult = UsageAllowed | UsageRateLimited | UsageInvalidKey | UsageUnverifiable


def check_usage(key: str) -> UsageResult:
    base_url = os.environ.get("JENTIC_API_BASE_URL", _DEFAULT_BASE_URL).rstrip("/")
    url = f"{base_url}{_USAGE_PATH}"
    headers = {
        "Accept": "application/json",
        "User-Agent": _USER_AGENT,
        "X-Jentic-API-Key": key,
    }

    try:
        response = requests.post(
            url,
            headers=headers,
            timeout=(_CONNECT_TIMEOUT_SECONDS, _READ_TIMEOUT_SECONDS),
            allow_redirects=False,
        )
    except requests.RequestException as exc:
        return UsageUnverifiable(reason=str(exc) or exc.__class__.__name__)

    status = response.status_code
    if 200 <= status < 300:
        return UsageAllowed()

    if status == 429:
        detail = _problem_detail(response) or "Server provided no detail."
        retry_after = response.headers.get("Retry-After")
        return UsageRateLimited(detail=detail, retry_after=retry_after)

    if status in (401, 403):
        detail = _problem_detail(response) or "Server provided no detail."
        return UsageInvalidKey(detail=detail)

    return UsageUnverifiable(reason=f"HTTP {status}")


def _problem_detail(response: requests.Response) -> str | None:
    try:
        body = response.json()
    except ValueError:
        return None
    if not isinstance(body, dict):
        return None
    detail = body.get("detail")
    if isinstance(detail, str) and detail:
        return detail
    return None
