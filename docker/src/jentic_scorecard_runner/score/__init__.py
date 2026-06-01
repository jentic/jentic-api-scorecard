"""In-process scoring: invoke the engine pipeline and stream the scorecard."""

from jentic_scorecard_runner.score.runner import run_score


__all__ = ["run_score"]
