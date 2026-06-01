"""Live key validation against the Jentic usage endpoint.

`check_usage` POSTs to `/api/v1/usage/api-scoring` with the user's API key. A
2xx response means the key is valid and within quota; 429 means the key is
valid but the user is over quota; 401/403 means the key is unknown.
Anything else (network error, 5xx, malformed body) is reported as
unverifiable so the caller can fail open.

The function never raises — it always returns one of the four
`UsageResult` variants below.
"""

import json
import os
from dataclasses import dataclass

import requests


_DEFAULT_BASE_URL = "https://api.jentic.com"
_USAGE_PATH = "/api/v1/usage/api-scoring"
_CONNECT_TIMEOUT_SECONDS = 5
_READ_TIMEOUT_SECONDS = 10


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
    headers = {"Accept": "application/json", "X-Jentic-API-Key": key}

    try:
        response = requests.post(
            url,
            headers=headers,
            timeout=(_CONNECT_TIMEOUT_SECONDS, _READ_TIMEOUT_SECONDS),
        )
    except requests.RequestException as exc:
        return UsageUnverifiable(reason=str(exc) or exc.__class__.__name__)

    status = response.status_code
    if 200 <= status < 300:
        return UsageAllowed()

    if status == 429:
        detail = _problem_detail(response) or "rate limit reached"
        retry_after = response.headers.get("Retry-After")
        return UsageRateLimited(detail=detail, retry_after=retry_after)

    if status in (401, 403):
        detail = _problem_detail(response) or "key not recognized"
        return UsageInvalidKey(detail=detail)

    return UsageUnverifiable(reason=f"validation endpoint returned HTTP {status}")


def _problem_detail(response: requests.Response) -> str | None:
    try:
        body = json.loads(response.content)
    except (ValueError, TypeError):
        return None
    if not isinstance(body, dict):
        return None
    detail = body.get("detail")
    return detail if isinstance(detail, str) and detail else None
