"""Score an OpenAPI spec in-process and stream the scorecard JSON to stdout."""

import json
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from jentic.apitools.common.models import (
    OASJsonRequest,
    OASProcessConfiguration,
    OASRequestMeta,
    SpecSourceUrl,
)
from jentic.apitools.pipelines import score_openapi

from jentic_scorecard_runner.exit_codes import ExitCode


def run_score(url: str | None, with_llm: bool) -> ExitCode:
    """Score the input (URL or stdin) and write the scorecard JSON to stdout.

    The gate runs in __main__ before this is called; by here the input is
    already authorized.
    """
    stdin_tempfile: Path | None = None
    if url is not None:
        spec_url = url
        label_source = url
    else:
        stdin_tempfile = _stdin_to_tempfile()
        if stdin_tempfile is None:
            return ExitCode.GENERIC_ERROR
        spec_url = stdin_tempfile.as_uri()
        label_source = "stdin"

    try:
        return _score(spec_url, label_source, with_llm)
    finally:
        if stdin_tempfile is not None and stdin_tempfile.exists():
            stdin_tempfile.unlink()


def _score(spec_url: str, label_source: str, with_llm: bool) -> ExitCode:
    process_config = OASProcessConfiguration(
        enable_llm_analysis=with_llm,
        include_diagnostics_in_score=True,
    )
    with tempfile.TemporaryDirectory(prefix="jentic-score-") as output_dir:
        oas_request = OASJsonRequest(
            spec=SpecSourceUrl(kind="url", url=spec_url),
            meta=OASRequestMeta(
                label=_infer_label(label_source),
                output_dir=output_dir,
                oas_process_configuration=process_config,
            ),
        )
        try:
            result = score_openapi(oas_request, spec_url=spec_url)
        except Exception as exc:
            print(f"error: scoring failed: {exc}", file=sys.stderr)
            return ExitCode.ENGINE_FAILURE

        if not result.success:
            print(
                f"error: scoring failed: {result.error_message or 'unknown error'}",
                file=sys.stderr,
            )
            return ExitCode.ENGINE_FAILURE

        scorecard = _find_scorecard(result, output_dir)
        if scorecard is None:
            print("error: scorecard not found in pipeline output", file=sys.stderr)
            return ExitCode.ENGINE_FAILURE

        sys.stdout.write(json.dumps(scorecard, indent=2))
        sys.stdout.write("\n")
        sys.stdout.flush()
    return ExitCode.SUCCESS


def _stdin_to_tempfile() -> Path | None:
    try:
        tmp = tempfile.NamedTemporaryFile(suffix=".json", prefix="jentic-stdin-", delete=False)
        while chunk := sys.stdin.buffer.read(65536):
            tmp.write(chunk)
        tmp.close()
        return Path(tmp.name)
    except OSError as exc:
        print(f"error: failed to read stdin: {exc}", file=sys.stderr)
        return None


def _find_scorecard(result, output_dir: str) -> dict | None:
    if result.version_dir:
        path = Path(result.version_dir) / "scorecard.json"
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    for candidate in Path(output_dir).rglob("scorecard.json"):
        return json.loads(candidate.read_text(encoding="utf-8"))
    return None


def _infer_label(source: str) -> str:
    parsed = urlparse(source)
    if parsed.scheme in ("http", "https"):
        host = parsed.hostname or "unknown"
        path_parts = [p for p in parsed.path.strip("/").split("/") if p]
        api_name = path_parts[0] if path_parts else "api"
        return f"{host}/{api_name}"
    return f"{source}/api"
