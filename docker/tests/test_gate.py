"""Unit tests for the anonymous gate, mvp-preview deprecation, and live key validation.

Live-validation tests use `pytest-httpserver` to spin up a real HTTP server in the
test process, then point the runner at it via `JENTIC_API_BASE_URL`. No mocking.
"""

import json

import pytest

from jentic_scorecard_runner.exit_codes import ExitCode
from jentic_scorecard_runner.gate import check_gate


_USAGE_PATH = "/api/v1/usage/api-scoring"


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    monkeypatch.delenv("JENTIC_API_KEY", raising=False)
    monkeypatch.delenv("JENTIC_API_BASE_URL", raising=False)


@pytest.fixture
def base_url(httpserver, monkeypatch):
    monkeypatch.setenv("JENTIC_API_BASE_URL", httpserver.url_for("").rstrip("/"))
    return httpserver


class TestAnonymousGate:
    def test_allowlisted_url_passes(self):
        url = "https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/petstore/openapi.yaml"
        assert check_gate(url=url) == ExitCode.SUCCESS

    def test_non_allowlisted_url_rejected(self, capsys):
        assert check_gate(url="https://example.com/openapi.yaml") == ExitCode.GATE_REJECTED
        err = capsys.readouterr().err
        assert "anonymous scoring is restricted" in err

    def test_stdin_without_key_rejected(self, capsys):
        assert check_gate(url=None) == ExitCode.AUTH_INVALID_KEY
        err = capsys.readouterr().err
        assert "requires a Jentic API key" in err

    def test_partial_match_rejected(self):
        url = "https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/NOT-openapi/foo.yaml"
        assert check_gate(url=url) == ExitCode.GATE_REJECTED

    def test_allowlist_prefix_only(self):
        url = "https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/"
        assert check_gate(url=url) == ExitCode.SUCCESS

    def test_empty_string_treated_as_unset(self, monkeypatch):
        monkeypatch.setenv("JENTIC_API_KEY", "")
        url = "https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/foo.yaml"
        assert check_gate(url=url) == ExitCode.SUCCESS


class TestAllowlistFreeTier:
    """jentic-public-apis URLs short-circuit the validator entirely."""

    def test_allowlisted_url_with_real_key_skips_validator(self, base_url, monkeypatch):
        monkeypatch.setenv("JENTIC_API_KEY", "real-key-xyz")
        url = "https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/petstore/openapi.yaml"
        assert check_gate(url=url) == ExitCode.SUCCESS
        # Validator must not have been called.
        assert base_url.log == []

    def test_allowlisted_url_with_mvp_key_skips_warning(self, monkeypatch, capsys):
        monkeypatch.setenv("JENTIC_API_KEY", "mvp-preview")
        url = "https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/petstore/openapi.yaml"
        assert check_gate(url=url) == ExitCode.SUCCESS
        # Allowlist short-circuit also skips the deprecation warning.
        assert capsys.readouterr().err == ""


class TestMvpDeprecation:
    def test_mvp_key_allows_url_with_warning(self, monkeypatch, capsys):
        monkeypatch.setenv("JENTIC_API_KEY", "mvp-preview")
        assert check_gate(url="https://example.com/openapi.yaml") == ExitCode.SUCCESS
        err = capsys.readouterr().err
        assert "DEPRECATED:" in err
        assert "jentic.com/signup" in err

    def test_mvp_key_allows_stdin_with_warning(self, monkeypatch, capsys):
        monkeypatch.setenv("JENTIC_API_KEY", "mvp-preview")
        assert check_gate(url=None) == ExitCode.SUCCESS
        assert "DEPRECATED:" in capsys.readouterr().err

    def test_mvp_key_does_not_call_validator(self, monkeypatch, base_url):
        monkeypatch.setenv("JENTIC_API_KEY", "mvp-preview")
        assert check_gate(url=None) == ExitCode.SUCCESS
        assert base_url.log == []


class TestRealKeyValidation:
    def test_allowed_when_endpoint_returns_204(self, base_url, monkeypatch):
        base_url.expect_request(_USAGE_PATH, method="POST").respond_with_data("", status=204)
        monkeypatch.setenv("JENTIC_API_KEY", "real-key")
        assert check_gate(url=None) == ExitCode.SUCCESS

    def test_allowed_when_endpoint_returns_200_json(self, base_url, monkeypatch):
        base_url.expect_request(_USAGE_PATH, method="POST").respond_with_json({"remaining": 999})
        monkeypatch.setenv("JENTIC_API_KEY", "real-key")
        assert check_gate(url=None) == ExitCode.SUCCESS

    def test_allowed_when_200_body_is_empty(self, base_url, monkeypatch):
        base_url.expect_request(_USAGE_PATH, method="POST").respond_with_data("", status=200)
        monkeypatch.setenv("JENTIC_API_KEY", "real-key")
        assert check_gate(url=None) == ExitCode.SUCCESS

    def test_allowed_when_200_body_is_non_dict(self, base_url, monkeypatch):
        base_url.expect_request(_USAGE_PATH, method="POST").respond_with_data(
            "[1, 2, 3]", status=200, content_type="application/json"
        )
        monkeypatch.setenv("JENTIC_API_KEY", "real-key")
        assert check_gate(url=None) == ExitCode.SUCCESS

    def test_post_has_no_request_body(self, base_url, monkeypatch):
        base_url.expect_request(_USAGE_PATH, method="POST").respond_with_data("", status=204)
        monkeypatch.setenv("JENTIC_API_KEY", "real-key")
        assert check_gate(url=None) == ExitCode.SUCCESS
        assert len(base_url.log) == 1
        request, _ = base_url.log[0]
        assert request.data == b""

    def test_forwards_api_key_header(self, base_url, monkeypatch):
        base_url.expect_request(
            _USAGE_PATH,
            method="POST",
            headers={"X-Jentic-API-Key": "real-key"},
        ).respond_with_data("", status=204)
        monkeypatch.setenv("JENTIC_API_KEY", "real-key")
        assert check_gate(url=None) == ExitCode.SUCCESS

    def test_forwards_user_agent_header(self, base_url, monkeypatch):
        base_url.expect_request(
            _USAGE_PATH,
            method="POST",
            headers={"User-Agent": "jentic-api-scorecard-runner"},
        ).respond_with_data("", status=204)
        monkeypatch.setenv("JENTIC_API_KEY", "real-key")
        assert check_gate(url=None) == ExitCode.SUCCESS

    def test_strips_whitespace_from_key(self, base_url, monkeypatch):
        base_url.expect_request(
            _USAGE_PATH,
            method="POST",
            headers={"X-Jentic-API-Key": "real-key"},
        ).respond_with_data("", status=204)
        monkeypatch.setenv("JENTIC_API_KEY", "  real-key\n")
        assert check_gate(url=None) == ExitCode.SUCCESS

    def test_rate_limited_returns_exit_7(self, base_url, monkeypatch, capsys):
        body = json.dumps(
            {
                "type": "https://problems.jentic.com/rate-limit",
                "title": "Too Many Requests",
                "status": 429,
                "detail": "monthly scoring quota exhausted",
            }
        )
        base_url.expect_request(_USAGE_PATH, method="POST").respond_with_data(
            body,
            status=429,
            content_type="application/problem+json",
            headers={"Retry-After": "3600"},
        )
        monkeypatch.setenv("JENTIC_API_KEY", "real-key")
        assert check_gate(url=None) == ExitCode.RATE_LIMITED
        err = capsys.readouterr().err
        assert "rate limit reached" in err
        assert "monthly scoring quota exhausted" in err
        assert "Retry-After: 3600" in err

    def test_rate_limited_without_retry_after(self, base_url, monkeypatch, capsys):
        body = json.dumps({"detail": "over quota"})
        base_url.expect_request(_USAGE_PATH, method="POST").respond_with_data(
            body, status=429, content_type="application/problem+json"
        )
        monkeypatch.setenv("JENTIC_API_KEY", "real-key")
        assert check_gate(url=None) == ExitCode.RATE_LIMITED
        err = capsys.readouterr().err
        assert "over quota" in err
        assert "Retry-After" not in err

    def test_rate_limited_with_malformed_body(self, base_url, monkeypatch, capsys):
        base_url.expect_request(_USAGE_PATH, method="POST").respond_with_data(
            "<html>oops</html>", status=429
        )
        monkeypatch.setenv("JENTIC_API_KEY", "real-key")
        assert check_gate(url=None) == ExitCode.RATE_LIMITED
        assert "rate limit reached" in capsys.readouterr().err

    def test_unknown_key_returns_exit_2(self, base_url, monkeypatch, capsys):
        body = json.dumps({"detail": "unknown api key"})
        base_url.expect_request(_USAGE_PATH, method="POST").respond_with_data(
            body, status=401, content_type="application/problem+json"
        )
        monkeypatch.setenv("JENTIC_API_KEY", "garbage")
        assert check_gate(url=None) == ExitCode.AUTH_INVALID_KEY
        err = capsys.readouterr().err
        assert "not recognized" in err
        assert "unknown api key" in err

    def test_forbidden_key_returns_exit_2(self, base_url, monkeypatch):
        body = json.dumps({"detail": "key revoked"})
        base_url.expect_request(_USAGE_PATH, method="POST").respond_with_data(
            body, status=403, content_type="application/problem+json"
        )
        monkeypatch.setenv("JENTIC_API_KEY", "revoked")
        assert check_gate(url=None) == ExitCode.AUTH_INVALID_KEY


class TestFailOpen:
    def test_5xx_fails_open_with_warning(self, base_url, monkeypatch, capsys):
        base_url.expect_request(_USAGE_PATH, method="POST").respond_with_data("boom", status=503)
        monkeypatch.setenv("JENTIC_API_KEY", "real-key")
        assert check_gate(url=None) == ExitCode.SUCCESS
        err = capsys.readouterr().err
        assert "could not reach api.jentic.com" in err
        assert "HTTP 503" in err

    def test_unexpected_4xx_fails_open(self, base_url, monkeypatch, capsys):
        base_url.expect_request(_USAGE_PATH, method="POST").respond_with_data(
            "bad request", status=400
        )
        monkeypatch.setenv("JENTIC_API_KEY", "real-key")
        assert check_gate(url=None) == ExitCode.SUCCESS
        err = capsys.readouterr().err
        assert "could not reach api.jentic.com" in err
        assert "HTTP 400" in err

    def test_3xx_redirect_not_followed_fails_open(self, base_url, monkeypatch, capsys):
        base_url.expect_request(_USAGE_PATH, method="POST").respond_with_data(
            "", status=302, headers={"Location": "https://evil.example.com/"}
        )
        monkeypatch.setenv("JENTIC_API_KEY", "real-key")
        assert check_gate(url=None) == ExitCode.SUCCESS
        err = capsys.readouterr().err
        assert "could not reach api.jentic.com" in err
        assert "HTTP 302" in err

    def test_unreachable_host_fails_open(self, monkeypatch, capsys):
        # Port 1 on localhost reliably refuses connections in CI.
        monkeypatch.setenv("JENTIC_API_BASE_URL", "http://127.0.0.1:1")
        monkeypatch.setenv("JENTIC_API_KEY", "real-key")
        assert check_gate(url=None) == ExitCode.SUCCESS
        assert "could not reach api.jentic.com" in capsys.readouterr().err
