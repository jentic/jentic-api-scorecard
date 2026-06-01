"""Unit tests for __main__.py arg parsing and dispatch."""

import json
import os
import subprocess
import sys
from pathlib import Path


_PROJECT_ROOT = str(Path(__file__).resolve().parent.parent)
_USAGE_PATH = "/api/v1/usage/api-scoring"


def run_runner(*args, env_override=None, stdin_data=None):
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
        timeout=10,
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
