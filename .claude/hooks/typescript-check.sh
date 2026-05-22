#!/usr/bin/env bash
# PostToolUse hook: type-check the package owning the edited .ts file.
# Walks up from the file's directory to the first tsconfig.json, then runs
# tsc --noEmit against that project. tsc cannot type-check a single file
# in isolation when that file imports from siblings, so the unit is the
# package, not the file.
# Reads Claude Code's hook JSON from stdin and no-ops for other paths.
# On type errors, prints tsc output to stderr and exits 2 so Claude Code
# feeds the errors back into the conversation.
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
dir=$(dirname "$f")
pkg_tsconfig=""
while [ "$dir" != "$repo_root" ] && [ "$dir" != "/" ]; do
  if [ -f "$dir/tsconfig.json" ]; then
    pkg_tsconfig="$dir/tsconfig.json"
    break
  fi
  dir=$(dirname "$dir")
done
[ -n "$pkg_tsconfig" ] || exit 0
tsc_bin="$repo_root/node_modules/.bin/tsc"
[ -x "$tsc_bin" ] || exit 0
output=$("$tsc_bin" --noEmit -p "$pkg_tsconfig" 2>&1) && exit 0
echo "TypeScript check failed for $pkg_tsconfig:" >&2
echo "$output" >&2
exit 2
