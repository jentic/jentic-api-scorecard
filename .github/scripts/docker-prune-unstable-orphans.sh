#!/usr/bin/env bash
# Prune GHCR package versions that are no longer reachable from any current
# image tag. Intended to run at the end of every `:unstable` publish, since
# rolling `:unstable` to a new digest is what produces orphans (the old
# `:unstable` index loses its tag; if its bytes differ from the new build,
# its per-platform children become unreachable too).
#
# Algorithm:
#   1. List all package versions via GitHub Packages REST.
#   2. For every version with a human-meaningful tag (i.e. NOT a `sha256-<hex>`
#      OCI referrer wrapper), fetch its manifest from the registry and collect
#      every `.manifests[].digest` it points at. Union those into a keep-set
#      of digests + the parent digests themselves.
#   3. Delete every untagged version whose digest is not in the keep-set.
#   4. Delete every `sha256-<hex>` referrer wrapper whose `<hex>` is not the
#      digest of a current human-tagged manifest.
#
# Failures are logged and counted; the script exits 0 even on partial failure
# so the publish job is never broken by a transient API hiccup. Surviving
# orphans get cleaned up on the next push.
#
# Required env:
#   GH_TOKEN   - PAT or GITHUB_TOKEN with `packages: write` on the package
#   ORG        - GitHub org/owner that owns the package (e.g. `jentic`)
#   PACKAGE    - container package name (e.g. `jentic-api-scorecard`)
#   IMAGE_REPO - registry path for manifest reads (e.g. `jentic/jentic-api-scorecard`)

set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${ORG:?ORG is required}"
: "${PACKAGE:?PACKAGE is required}"
: "${IMAGE_REPO:?IMAGE_REPO is required}"

API="https://api.github.com/orgs/${ORG}/packages/container/${PACKAGE}/versions"
REG_TOKEN_URL="https://ghcr.io/token?scope=repository:${IMAGE_REPO}:pull"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "::group::Listing package versions"
gh_api() {
  curl --fail --silent --show-error \
       -H "Accept: application/vnd.github+json" \
       -H "Authorization: Bearer ${GH_TOKEN}" \
       -H "X-GitHub-Api-Version: 2022-11-28" \
       "$@"
}

# Paginate; GitHub caps per_page at 100. 1000 versions covers any realistic case.
: > "$WORK/versions.json"
echo "[]" > "$WORK/versions.json"
for page in 1 2 3 4 5 6 7 8 9 10; do
  resp="$(gh_api "${API}?per_page=100&page=${page}")"
  count=$(echo "$resp" | jq 'length')
  if [ "$count" -eq 0 ]; then
    break
  fi
  jq -s '.[0] + .[1]' "$WORK/versions.json" <(echo "$resp") > "$WORK/versions.json.tmp"
  mv "$WORK/versions.json.tmp" "$WORK/versions.json"
done
total=$(jq 'length' "$WORK/versions.json")
echo "Total versions: $total"
echo "::endgroup::"

echo "::group::Fetching anonymous registry token"
REG_TOKEN=$(curl --fail --silent --show-error "$REG_TOKEN_URL" | jq -r .token)
[ -n "$REG_TOKEN" ] && [ "$REG_TOKEN" != "null" ] || { echo "Failed to obtain registry token"; exit 0; }
echo "::endgroup::"

echo "::group::Walking real-tagged manifests to build keep-set"
# Real tags = anything whose tag is NOT of the form sha256-<hex>
jq -r '[.[] | select(.metadata.container.tags | any(test("^sha256-") | not))]
       | .[] | "\(.metadata.container.tags | map(select(test("^sha256-") | not)) | .[0])\t\(.name)"' \
   "$WORK/versions.json" > "$WORK/real-tags.tsv"

real_tag_count=$(wc -l < "$WORK/real-tags.tsv")
echo "Real tags found: $real_tag_count"

# Keep-set: all parent digests + all manifest children
: > "$WORK/keep-digests.txt"
while IFS=$'\t' read -r tag parent_digest; do
  echo "$parent_digest" >> "$WORK/keep-digests.txt"
  # Fetch manifest list. Accept all common index/manifest media types.
  manifest=$(curl --fail --silent --show-error \
    -H "Authorization: Bearer ${REG_TOKEN}" \
    -H "Accept: application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json" \
    "https://ghcr.io/v2/${IMAGE_REPO}/manifests/${tag}" 2>/dev/null) || {
    echo "::warning::Failed to fetch manifest for tag '$tag'; skipping its children"
    continue
  }
  echo "$manifest" | jq -r '.manifests[]?.digest // empty' >> "$WORK/keep-digests.txt"
done < "$WORK/real-tags.tsv"

sort -u "$WORK/keep-digests.txt" -o "$WORK/keep-digests.txt"
keep_count=$(wc -l < "$WORK/keep-digests.txt")
echo "Keep-set size: $keep_count digests"
echo "::endgroup::"

# Build keep-set for sha256-<hex> referrer wrappers: convert keep-digests to "sha256-<hex>" form
sed 's|sha256:|sha256-|' "$WORK/keep-digests.txt" > "$WORK/keep-referrer-tags.txt"

echo "::group::Classifying versions"
# Untagged-prune: tagless versions whose digest isn't in keep-set
jq -r '[.[] | select((.metadata.container.tags | length) == 0)]
       | .[] | "\(.id)\t\(.name)"' "$WORK/versions.json" > "$WORK/untagged-all.tsv"

: > "$WORK/prune.tsv"
while IFS=$'\t' read -r id digest; do
  if ! grep -qFx "$digest" "$WORK/keep-digests.txt"; then
    echo -e "${id}\t${digest}\torphan-untagged" >> "$WORK/prune.tsv"
  fi
done < "$WORK/untagged-all.tsv"

# Referrer-prune: sha256-<hex> wrappers whose <hex> isn't a current parent digest
jq -r '[.[] | select(.metadata.container.tags | any(test("^sha256-")))]
       | .[] | "\(.id)\t\(.name)\t\(.metadata.container.tags | map(select(test("^sha256-"))) | .[0])"' \
   "$WORK/versions.json" > "$WORK/referrers-all.tsv"

while IFS=$'\t' read -r id digest tag; do
  if ! grep -qFx "$tag" "$WORK/keep-referrer-tags.txt"; then
    echo -e "${id}\t${digest}\torphan-referrer($tag)" >> "$WORK/prune.tsv"
  fi
done < "$WORK/referrers-all.tsv"

prune_count=$(wc -l < "$WORK/prune.tsv")
echo "Versions to prune: $prune_count"
[ "$prune_count" -gt 0 ] && cat "$WORK/prune.tsv"
echo "::endgroup::"

if [ "$prune_count" -eq 0 ]; then
  echo "Nothing to prune."
  exit 0
fi

echo "::group::Deleting orphans"
deleted=0
failed=0
while IFS=$'\t' read -r id digest reason; do
  if curl --fail --silent --show-error \
       -X DELETE \
       -H "Accept: application/vnd.github+json" \
       -H "Authorization: Bearer ${GH_TOKEN}" \
       -H "X-GitHub-Api-Version: 2022-11-28" \
       "${API}/${id}" >/dev/null 2>&1; then
    deleted=$((deleted + 1))
  else
    echo "::warning::Failed to delete version ${id} (${digest}, ${reason})"
    failed=$((failed + 1))
  fi
done < "$WORK/prune.tsv"
echo "Deleted: ${deleted}/${prune_count}, failed: ${failed}"
echo "::endgroup::"

# Always exit 0 — orphan cleanup is best-effort; the publish job must not fail
# because of a transient packages-API hiccup. Survivors get cleaned up next push.
exit 0
