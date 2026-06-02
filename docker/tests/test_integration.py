"""Integration tests — require a built Docker image.

Run with: pytest tests/test_integration.py -v
Prerequisite: docker build -t jentic-api-scorecard:dev .

Set IMAGE env var to override: IMAGE=ghcr.io/jentic/jentic-api-scorecard:0.1.0 pytest ...

Note: real-key paths (live `api.jentic.com` validation, 429 → exit 7, 401 → exit 2)
are not covered here — they would couple CI to the live backend's quota state. Those
paths are exercised at the runner level by `test_gate.py` / `test_main.py`, which
spin up a local `pytest-httpserver` and hit it via the `JENTIC_API_BASE_URL`
override. The container build does not expose that override on the public CLI
surface.
"""

import json
import os
import subprocess

import pytest

from jentic_scorecard_runner.exit_codes import ExitCode


IMAGE = os.environ.get("IMAGE", "jentic-api-scorecard:dev")

PETSTORE_URL = "https://petstore3.swagger.io/api/v3/openapi.json"


def docker_run(*args, env=None, stdin_data=None, timeout=120):
    cmd = ["docker", "run", "--rm"]
    if stdin_data is not None:
        cmd.append("-i")
    if env:
        for k, v in env.items():
            cmd.extend(["-e", f"{k}={v}"])
    cmd.append(IMAGE)
    cmd.extend(args)

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        input=stdin_data,
        timeout=timeout,
    )
    return result


@pytest.fixture(scope="session", autouse=True)
def check_image():
    result = subprocess.run(
        ["docker", "image", "inspect", IMAGE],
        capture_output=True,
    )
    if result.returncode != 0:
        pytest.skip(f"Docker image '{IMAGE}' not found. Run: docker build -t {IMAGE} .")


class TestAnonymousGatePath:
    def test_non_allowlisted_url_no_key_exits_gate_rejected(self):
        r = docker_run("score", "--url", PETSTORE_URL)
        assert r.returncode == ExitCode.GATE_REJECTED
        assert "anonymous scoring is restricted" in r.stderr

    def test_stdin_no_key_exits_auth_invalid(self):
        r = docker_run("score", stdin_data='{"openapi":"3.0.0"}')
        assert r.returncode == ExitCode.AUTH_INVALID_KEY
        assert "requires a Jentic API key" in r.stderr


class TestMVPKeyScheme:
    def test_mvp_key_url_mode(self):
        r = docker_run("score", "--url", PETSTORE_URL, env={"JENTIC_API_KEY": "mvp-preview"})
        assert r.returncode == ExitCode.SUCCESS
        assert "DEPRECATED:" in r.stderr
        data = json.loads(r.stdout)
        assert "summary" in data
        assert data["summary"]["score"] > 0

    def test_mvp_key_stdin_mode(self):
        fetch = subprocess.run(
            ["curl", "-s", PETSTORE_URL],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert fetch.returncode == 0

        r = docker_run("score", env={"JENTIC_API_KEY": "mvp-preview"}, stdin_data=fetch.stdout)
        assert r.returncode == ExitCode.SUCCESS
        data = json.loads(r.stdout)
        assert data["summary"]["score"] > 0


class TestOutputFormat:
    def test_json_output_parseable(self):
        r = docker_run("score", "--url", PETSTORE_URL, env={"JENTIC_API_KEY": "mvp-preview"})
        assert r.returncode == ExitCode.SUCCESS
        data = json.loads(r.stdout)
        assert "metadata" in data
        assert "apiMetadata" in data
        assert "summary" in data
        assert "details" in data

    def test_diagnostics_included(self):
        r = docker_run("score", "--url", PETSTORE_URL, env={"JENTIC_API_KEY": "mvp-preview"})
        data = json.loads(r.stdout)
        assert "diagnostics" in data
        assert len(data["diagnostics"]) > 0


class TestContainerLifecycle:
    def test_no_input_tty_exits_nonzero(self):
        cmd = ["docker", "run", "--rm", "-t", IMAGE, "score"]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        assert r.returncode != 0
        # With -t, Docker merges stderr into stdout
        assert "no input" in (r.stdout + r.stderr)

    def test_no_subcommand_exits_generic_error(self):
        r = docker_run()
        assert r.returncode == ExitCode.GENERIC_ERROR
