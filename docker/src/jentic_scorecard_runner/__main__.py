"""Container entry point for jentic-api-scorecard.

Usage (via docker run):
    score --url <url>           Score a URL (engine fetches directly)
    score                       Score bundled spec JSON from stdin
    score --with-llm            Enable LLM analysis (requires provider env vars)
"""

import argparse
import sys

from jentic_scorecard_runner.exit_codes import ExitCode
from jentic_scorecard_runner.gate import check_gate
from jentic_scorecard_runner.score import run_score


class _Parser(argparse.ArgumentParser):
    def error(self, message):
        self.print_usage(sys.stderr)
        print(f"error: {message}", file=sys.stderr)
        sys.exit(ExitCode.GENERIC_ERROR)


def main() -> int:
    parser = _Parser(prog="jentic_scorecard_runner")
    subparsers = parser.add_subparsers(dest="command")

    score_parser = subparsers.add_parser("score", help="Score an OpenAPI spec")
    score_parser.add_argument("--url", help="URL of the spec (engine fetches directly)")
    score_parser.add_argument("--with-llm", action="store_true", help="Enable LLM analysis")
    score_parser.add_argument(
        "--report-token-usage",
        action="store_true",
        help="Add engine LLM token usage to the scorecard (benchmark-only; needs --with-llm)",
    )

    args = parser.parse_args()

    if args.command != "score":
        parser.print_usage(sys.stderr)
        return ExitCode.GENERIC_ERROR

    if args.url is None and sys.stdin.isatty():
        print(
            "error: no input. Provide --url <url> or pipe a bundled spec to stdin.",
            file=sys.stderr,
        )
        return ExitCode.GENERIC_ERROR

    gate_result = check_gate(url=args.url)
    if gate_result != ExitCode.SUCCESS:
        return gate_result

    return run_score(
        url=args.url,
        with_llm=args.with_llm,
        report_token_usage=args.report_token_usage,
    )


if __name__ == "__main__":
    sys.exit(main())
