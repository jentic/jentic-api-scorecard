"""Invoke jentic-apitools score and stream results."""

import os
import subprocess
import sys
import tempfile

from jentic_scorecard_runner.exit_codes import ExitCode


_ENGINE_SPEC_FAILURE_CODE = 2
_ENGINE_TIMEOUT_SECONDS = 300


def run_score(url: str | None, with_llm: bool) -> ExitCode:
    if url is not None:
        spec_target = url
        stdin_tempfile = None
    else:
        stdin_tempfile = _stdin_to_tempfile()
        if stdin_tempfile is None:
            return ExitCode.GENERIC_ERROR
        spec_target = stdin_tempfile

    try:
        return _invoke_engine(spec_target, with_llm)
    finally:
        if stdin_tempfile is not None:
            os.unlink(stdin_tempfile)


def _invoke_engine(spec_target: str, with_llm: bool) -> ExitCode:
    cmd = [
        "jentic-apitools",
        "score",
        spec_target,
        "--format",
        "json",
        "--include-diagnostics",
        "--quiet",
    ]
    if with_llm:
        cmd.append("--enable-llm-analysis")

    with tempfile.NamedTemporaryFile(suffix=".json") as out_file:
        try:
            result = subprocess.run(
                cmd,
                stdout=out_file,
                stderr=sys.stderr,
                timeout=_ENGINE_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired:
            print(
                f"error: engine timed out after {_ENGINE_TIMEOUT_SECONDS}s",
                file=sys.stderr,
            )
            return ExitCode.ENGINE_FAILURE

        if result.returncode != 0:
            print(
                f"error: engine exited with code {result.returncode}",
                file=sys.stderr,
            )
            if result.returncode == _ENGINE_SPEC_FAILURE_CODE:
                return ExitCode.SPEC_FAILURE
            return ExitCode.ENGINE_FAILURE

        out_file.seek(0)
        while chunk := out_file.read(65536):
            sys.stdout.buffer.write(chunk)
        sys.stdout.buffer.flush()

    return ExitCode.SUCCESS


def _stdin_to_tempfile() -> str | None:
    """Read stdin in chunks to a tempfile; return the path."""
    try:
        tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
        while chunk := sys.stdin.buffer.read(65536):
            tmp.write(chunk)
        tmp.close()
        return tmp.name
    except OSError as e:
        print(f"error: failed to read stdin: {e}", file=sys.stderr)
        return None
