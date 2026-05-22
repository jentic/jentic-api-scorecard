#!/usr/bin/env bash
# PostToolUse hook: run eslint --fix on an edited .ts file inside packages/.
# Prettier runs via eslint-plugin-prettier, so this also reformats.
# Reads Claude Code's hook JSON from stdin and no-ops for other paths.
set -u
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -n "$f" ] || exit 0
case "$f" in
  *.ts) ;;
  *) exit 0 ;;
esac
repo_root=$(git -C "$(dirname "$f")" rev-parse --show-toplevel 2>/dev/null) || exit 0
case "$f" in
  "$repo_root"/packages/*) ;;
  *) exit 0 ;;
esac
eslint_bin="$repo_root/node_modules/.bin/eslint"
[ -x "$eslint_bin" ] || exit 0
cd "$repo_root" && "$eslint_bin" --fix "$f"
