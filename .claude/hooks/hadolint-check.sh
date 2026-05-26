#!/usr/bin/env bash
# PostToolUse hook: lint the edited Dockerfile with hadolint via Docker.
# Mirrors the npm `lint:docker` script so local-and-CI invocations stay aligned.
# Reads Claude Code's hook JSON from stdin and no-ops for other paths.
# Scoped to the single canonical Dockerfile; broaden the case below if more
# Dockerfiles land. On findings, prints hadolint output to stderr and exits 2
# so Claude Code feeds the errors back into the conversation.
set -euo pipefail
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -n "$f" ] || exit 0
repo_root=$(git -C "$(dirname "$f")" rev-parse --show-toplevel 2>/dev/null) || exit 0
case "$f" in
  "$repo_root"/docker/Dockerfile) ;;
  *) exit 0 ;;
esac
command -v docker >/dev/null 2>&1 || exit 0
output=$(docker run --rm -i hadolint/hadolint:v2.14.0 < "$f" 2>&1) && exit 0
echo "hadolint findings for $f:" >&2
echo "$output" >&2
exit 2
