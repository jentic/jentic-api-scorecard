"""Invoke jentic-apitools score and stream results."""

import subprocess
import sys
import tempfile

from jentic_scorecard_runner.exit_codes import ExitCode


def run_score(url: str | None, with_llm: bool) -> ExitCode:
    if url is not None:
        spec_target = url
    else:
        spec_target = _stdin_to_tempfile()
        if spec_target is None:
            return ExitCode.GENERIC_ERROR

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
        result = subprocess.run(
            cmd,
            stdout=out_file,
            stderr=sys.stderr,
        )

        if result.returncode != 0:
            print(
                f"error: engine exited with code {result.returncode}",
                file=sys.stderr,
            )
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
