#!/usr/bin/env bash
# PostToolUse hook: run ruff check --fix and ruff format on an edited .py file.
# Reads Claude Code's hook JSON from stdin and no-ops for non-Python paths.
# ruff lives inside docker/.venv (the only Python project tree), so we cd
# there and invoke it via uv.
set -u
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -n "$f" ] && [ "${f##*.}" = "py" ] || exit 0
cd "$CLAUDE_PROJECT_DIR/docker" && uv run ruff check --fix "$f" && uv run ruff format "$f"
