"""Score an OpenAPI spec in-process and stream the scorecard JSON to stdout."""

import shutil
import sys
import tempfile
from pathlib import Path

from jentic.apitools.common.models import (
    OASJsonRequest,
    OASProcessConfiguration,
    OASRequestMeta,
    SpecSourceUrl,
)
from jentic.apitools.pipelines import score_openapi

from jentic_scorecard_runner.exit_codes import ExitCode


_LLM_ANALYSIS_ERROR_CODE = "llm-analysis-error"
_SEMANTIC_ANALYSIS_SUMMARY_CODE = "semantic-analysis-summary"


def run_score(url: str | None, with_llm: bool, report_token_usage: bool = False) -> ExitCode:
    """Score the input (URL or stdin) and write the scorecard JSON to stdout.

    The gate runs in __main__ before this is called; by here the input is
    already authorized. ``report_token_usage`` is an opt-in (benchmark-only): when
    set, the engine adds a ``tokenUsage`` object to the scorecard; it is off by
    default so ordinary ``--with-llm`` output is unchanged.
    """
    stdin_tempfile: Path | None = None
    if url is not None:
        spec_url = url
    else:
        stdin_tempfile = _stdin_to_tempfile()
        if stdin_tempfile is None:
            return ExitCode.GENERIC_ERROR
        spec_url = stdin_tempfile.as_uri()

    try:
        return _score(spec_url, with_llm, report_token_usage)
    finally:
        if stdin_tempfile is not None:
            stdin_tempfile.unlink(missing_ok=True)


def _score(spec_url: str, with_llm: bool, report_token_usage: bool) -> ExitCode:
    process_config = OASProcessConfiguration(
        enable_llm_analysis=with_llm,
        include_diagnostics_in_score=True,
        report_token_usage=report_token_usage,
    )
    with tempfile.TemporaryDirectory(prefix="jentic-score-") as output_dir:
        oas_request = OASJsonRequest(
            spec=SpecSourceUrl(kind="url", url=spec_url),
            meta=OASRequestMeta(
                label="jentic-scorecard/api",
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

        if result.version_dir is None:
            print("error: engine returned no output directory", file=sys.stderr)
            return ExitCode.ENGINE_FAILURE

        with (Path(result.version_dir) / "scorecard.json").open("rb") as src:
            shutil.copyfileobj(src, sys.stdout.buffer)

        # The engine reports success even when LLM batches fail: the affected
        # LLM-derived signals are scored as perfect, inflating their dimension(s)
        # and the overall score. When the caller opted into --with-llm, treat
        # that as a failure so CI gates on it. The scorecard is still streamed
        # above (the host CLI reads it to name the affected signals), but the
        # exit code reflects that this is not a true LLM run.
        if with_llm and _llm_analysis_failed(result.diagnostics):
            print(
                "error: LLM analysis failed; the scorecard above is inflated and is "
                "not a true --with-llm result.",
                file=sys.stderr,
            )
            return ExitCode.LLM_FAILURE
    return ExitCode.SUCCESS


def _llm_analysis_failed(diagnostics: list[object]) -> bool:
    """Detect LLM analysis failure regardless of cause.

    The engine signals failure two different ways depending on what broke:
    an explicit ``llm-analysis-error`` diagnostic (e.g. provider auth/model
    errors), or — for connectivity failures — a silent
    ``semantic-analysis-summary`` reporting batches attempted but zero
    operations analyzed. Either means the LLM-derived signals defaulted.
    """
    for diag in diagnostics or []:
        code = getattr(diag, "code", None)
        if code == _LLM_ANALYSIS_ERROR_CODE:
            return True
        if code == _SEMANTIC_ANALYSIS_SUMMARY_CODE:
            data = getattr(diag, "data", None) or {}
            if (
                data.get("batches_processed", 0) > 0
                and data.get("total_operations_analyzed", 0) == 0
            ):
                return True
    return False


def _stdin_to_tempfile() -> Path | None:
    """Stream stdin in chunks to a tempfile; return the path or None on I/O error."""
    tmp = tempfile.NamedTemporaryFile(suffix=".json", prefix="jentic-stdin-", delete=False)
    path = Path(tmp.name)
    try:
        with tmp:
            while chunk := sys.stdin.buffer.read(65536):
                tmp.write(chunk)
        return path
    except OSError as exc:
        path.unlink(missing_ok=True)
        print(f"error: failed to buffer stdin to tempfile: {exc}", file=sys.stderr)
        return None
