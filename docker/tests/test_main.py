"""Unit tests for __main__.py arg parsing and dispatch."""

import json
import os
import subprocess
import sys
from pathlib import Path


_PROJECT_ROOT = str(Path(__file__).resolve().parent.parent)
_USAGE_PATH = "/api/v1/usage/api-scoring"


def run_runner(*args, env_override=None, stdin_data=None, timeout=10):
    """Run the runner as a subprocess to test arg parsing and exit codes."""
    env = os.environ.copy()
    env.pop("JENTIC_API_KEY", None)
    env.pop("JENTIC_API_BASE_URL", None)
    if env_override:
        env.update(env_override)

    cmd = [sys.executable, "-m", "jentic_scorecard_runner", *args]
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        env=env,
        input=stdin_data if stdin_data is not None else "",
        cwd=_PROJECT_ROOT,
        timeout=timeout,
    )
    return result


class TestArgParsing:
    def test_no_args_shows_usage(self):
        result = run_runner()
        assert result.returncode == 1
        assert "usage:" in result.stderr

    def test_unknown_subcommand(self):
        result = run_runner("login")
        assert result.returncode == 1

    def test_unknown_flag(self):
        result = run_runner("score", "--bogus")
        assert result.returncode == 1
        assert "unrecognized arguments" in result.stderr

    def test_score_no_url_no_stdin(self):
        # stdin is not a TTY and has no data → gate rejects (anonymous + stdin = key required)
        result = run_runner("score")
        assert result.returncode == 2


class TestGateIntegration:
    def test_unknown_key_exits_2(self, httpserver):
        httpserver.expect_request(_USAGE_PATH, method="POST").respond_with_data(
            json.dumps({"detail": "unknown api key"}),
            status=401,
            content_type="application/problem+json",
        )
        result = run_runner(
            "score",
            "--url",
            "https://example.com/spec.yaml",
            env_override={
                "JENTIC_API_KEY": "wrong-key",
                "JENTIC_API_BASE_URL": httpserver.url_for("").rstrip("/"),
            },
        )
        assert result.returncode == 2
        assert "not recognized" in result.stderr

    def test_rate_limited_exits_7(self, httpserver):
        httpserver.expect_request(_USAGE_PATH, method="POST").respond_with_data(
            json.dumps({"detail": "monthly quota exhausted"}),
            status=429,
            content_type="application/problem+json",
            headers={"Retry-After": "120"},
        )
        result = run_runner(
            "score",
            "--url",
            "https://example.com/spec.yaml",
            env_override={
                "JENTIC_API_KEY": "real-key",
                "JENTIC_API_BASE_URL": httpserver.url_for("").rstrip("/"),
            },
        )
        assert result.returncode == 7
        assert "rate limit reached" in result.stderr
        assert "monthly quota exhausted" in result.stderr
        assert "Retry-After: 120" in result.stderr

    def test_anonymous_non_allowlisted_exits_3(self):
        result = run_runner(
            "score",
            "--url",
            "https://example.com/spec.yaml",
        )
        assert result.returncode == 3
        assert "anonymous scoring is restricted" in result.stderr

    def test_anonymous_stdin_exits_2(self):
        result = run_runner("score", stdin_data='{"openapi":"3.0.0"}')
        assert result.returncode == 2
        assert "requires a Jentic API key" in result.stderr


class TestLlmFailure:
    _OAK_PETSTORE_URL = (
        "https://raw.githubusercontent.com/jentic/jentic-public-apis/"
        "refs/heads/main/apis/openapi/swagger-api/petstore/1.0.27/openapi.json"
    )

    def test_with_llm_unreachable_endpoint_exits_8(self):
        # Point --with-llm at an unreachable OpenAI-compatible endpoint. The LLM
        # calls fail, the affected signals are scored as perfect, and the engine
        # still reports success — so the runner must surface exit code 8. The
        # allowlisted OAK URL keeps the gate happy without a key.
        result = run_runner(
            "score",
            "--with-llm",
            "--url",
            self._OAK_PETSTORE_URL,
            env_override={
                "LLM_PROVIDER": "OPENAI",
                "LIGHT_LLM_PROVIDER": "OPENAI",
                "OPENAI_API_URL": "http://127.0.0.1:1/v1/chat/completions",
                "OPENAI_API_KEY": "dummy",
                "LLM_MODEL": "gpt-4o-mini",
                "LLM_LIGHT_MODEL": "gpt-4o-mini",
            },
            timeout=120,
        )
        assert result.returncode == 8, result.stderr
        assert "LLM analysis failed" in result.stderr
        # The runner still streams the scorecard so the host CLI can read it to
        # name the affected signals; the CLI is what suppresses display.
        assert '"summary"' in result.stdout

    def test_without_with_llm_exits_0(self):
        result = run_runner("score", "--url", self._OAK_PETSTORE_URL, timeout=120)
        assert result.returncode == 0, result.stderr
