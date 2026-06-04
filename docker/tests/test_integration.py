"""Integration tests — require a built Docker image.

Run with: pytest tests/test_integration.py -v
Prerequisite: docker build -t jentic-api-scorecard:dev .

Set IMAGE env var to override: IMAGE=ghcr.io/jentic/jentic-api-scorecard:0.1.0 pytest ...

Stdin-mode coverage uses `pytest-httpserver` to stub the validator and
`docker run --network host` so the container can reach the host-bound stub
via `JENTIC_API_BASE_URL=<httpserver.url_for("")>` (a loopback URL — the
exact host depends on pytest-httpserver's bind, typically `localhost`).
`--network host` is Linux-only — these tests are skipped on macOS/Windows
where Docker Desktop runs the daemon in a VM.
"""

import json
import os
import platform
import subprocess
import textwrap

import pytest

from jentic_scorecard_runner.exit_codes import ExitCode


IMAGE = os.environ.get("IMAGE", "jentic-api-scorecard:dev")

OAK_PETSTORE_URL = "https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/swagger-api/petstore/1.0.27/openapi.json"

USAGE_PATH = "/api/v1/usage/api-scoring"


def docker_run(*args, env=None, stdin_data=None, timeout=120, host_network=False):
    cmd = ["docker", "run", "--rm"]
    if stdin_data is not None:
        cmd.append("-i")
    if host_network:
        cmd.extend(["--network", "host"])
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


_MINIMAL_SPEC = textwrap.dedent("""
    {
      "openapi": "3.0.3",
      "info": {"title": "T", "version": "1"},
      "paths": {"/x": {"get": {"responses": {"200": {"description": "ok"}}}}}
    }
""").strip()


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
        r = docker_run("score", "--url", "https://petstore3.swagger.io/api/v3/openapi.json")
        assert r.returncode == ExitCode.GATE_REJECTED
        assert "anonymous scoring is restricted" in r.stderr

    def test_stdin_no_key_exits_auth_invalid(self):
        r = docker_run("score", stdin_data='{"openapi":"3.0.0"}')
        assert r.returncode == ExitCode.AUTH_INVALID_KEY
        assert "requires a Jentic API key" in r.stderr


class TestAllowlistedUrl:
    def test_allowlisted_url_scores_without_key(self):
        r = docker_run("score", "--url", OAK_PETSTORE_URL)
        assert r.returncode == ExitCode.SUCCESS
        data = json.loads(r.stdout)
        assert "summary" in data
        assert data["summary"]["score"] > 0


class TestOutputFormat:
    def test_json_output_parseable(self):
        r = docker_run("score", "--url", OAK_PETSTORE_URL)
        assert r.returncode == ExitCode.SUCCESS
        data = json.loads(r.stdout)
        assert "metadata" in data
        assert "apiMetadata" in data
        assert "summary" in data
        assert "details" in data

    def test_diagnostics_included(self):
        r = docker_run("score", "--url", OAK_PETSTORE_URL)
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


@pytest.mark.skipif(
    platform.system() != "Linux",
    reason="--network host is Linux-only; Docker Desktop on macOS/Windows runs the daemon in a VM",
)
class TestStdinWithStubbedValidator:
    """Image-level coverage of the stdin path against a stubbed validator.

    Pairs `pytest-httpserver` (host) with `docker run --network host` so the
    container reaches the host-bound stub via `JENTIC_API_BASE_URL`.
    """

    def test_stdin_with_real_key_scores(self, httpserver):
        httpserver.expect_request(USAGE_PATH, method="POST").respond_with_data("", status=204)
        base_url = httpserver.url_for("").rstrip("/")
        r = docker_run(
            "score",
            env={"JENTIC_API_KEY": "real-key", "JENTIC_API_BASE_URL": base_url},
            stdin_data=_MINIMAL_SPEC,
            host_network=True,
        )
        assert r.returncode == ExitCode.SUCCESS, r.stderr
        data = json.loads(r.stdout)
        assert "summary" in data

    def test_stdin_with_invalid_key_exits_2(self, httpserver):
        httpserver.expect_request(USAGE_PATH, method="POST").respond_with_data(
            json.dumps({"detail": "unknown api key"}),
            status=401,
            content_type="application/problem+json",
        )
        base_url = httpserver.url_for("").rstrip("/")
        r = docker_run(
            "score",
            env={"JENTIC_API_KEY": "garbage", "JENTIC_API_BASE_URL": base_url},
            stdin_data=_MINIMAL_SPEC,
            host_network=True,
        )
        assert r.returncode == ExitCode.AUTH_INVALID_KEY
        assert "not recognized" in r.stderr

    def test_stdin_with_substantial_spec_scores(self, httpserver):
        """Mirror of the pre-1.0 mvp-preview stdin-mode test against a real spec.

        Also stands in for the CLI-side `--bundle` end-to-end success coverage
        that lived in `packages/cli/test/e2e/score.e2e.test.ts` until the
        `JENTIC_API_BASE_URL` CLI passthrough was removed: fetch + pipe through
        stdin is structurally what `--bundle` does host-side, so this case
        exercises the same container-side scoring path against a substantial
        spec.
        """
        fetch = subprocess.run(
            ["curl", "-fsSL", OAK_PETSTORE_URL],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert fetch.returncode == 0, fetch.stderr

        httpserver.expect_request(USAGE_PATH, method="POST").respond_with_data("", status=204)
        base_url = httpserver.url_for("").rstrip("/")
        r = docker_run(
            "score",
            env={"JENTIC_API_KEY": "real-key", "JENTIC_API_BASE_URL": base_url},
            stdin_data=fetch.stdout,
            host_network=True,
        )
        assert r.returncode == ExitCode.SUCCESS, r.stderr
        data = json.loads(r.stdout)
        assert data["summary"]["score"] > 0

    def test_stdin_with_rate_limited_key_exits_7(self, httpserver):
        httpserver.expect_request(USAGE_PATH, method="POST").respond_with_data(
            json.dumps({"detail": "monthly scoring quota exhausted"}),
            status=429,
            content_type="application/problem+json",
            headers={"Retry-After": "3600"},
        )
        base_url = httpserver.url_for("").rstrip("/")
        r = docker_run(
            "score",
            env={"JENTIC_API_KEY": "real-key", "JENTIC_API_BASE_URL": base_url},
            stdin_data=_MINIMAL_SPEC,
            host_network=True,
        )
        assert r.returncode == ExitCode.RATE_LIMITED
        assert "rate limit reached" in r.stderr
        assert "Retry-After: 3600" in r.stderr
