"""Unit tests for the anonymous gate and auth check logic."""

import pytest

from jentic_scorecard_runner.exit_codes import ExitCode
from jentic_scorecard_runner.gate import check_gate


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    monkeypatch.delenv("JENTIC_API_KEY", raising=False)


class TestAuthenticated:
    def test_mvp_key_allows_url(self, monkeypatch):
        monkeypatch.setenv("JENTIC_API_KEY", "mvp-preview")
        assert check_gate(url="https://example.com/openapi.yaml") == ExitCode.SUCCESS

    def test_mvp_key_allows_stdin(self, monkeypatch):
        monkeypatch.setenv("JENTIC_API_KEY", "mvp-preview")
        assert check_gate(url=None) == ExitCode.SUCCESS


class TestBadKey:
    def test_unrecognized_key_rejects(self, monkeypatch, capsys):
        monkeypatch.setenv("JENTIC_API_KEY", "garbage")
        assert check_gate(url="https://example.com/openapi.yaml") == ExitCode.AUTH_INVALID_KEY
        assert "not recognized" in capsys.readouterr().err

    def test_empty_string_treated_as_unset(self, monkeypatch):
        monkeypatch.setenv("JENTIC_API_KEY", "")
        # Empty string = anonymous mode, not bad key
        assert (
            check_gate(
                url="https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/foo.yaml"
            )
            == ExitCode.SUCCESS
        )


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
