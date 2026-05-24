# Docker image supply chain

This document covers the cryptographic guarantees that ship with every
`ghcr.io/jentic/jentic-api-scorecard` image push: what is signed, how the
build authenticates to GHCR without long-lived secrets, and how to verify
an image — including platform-specific verification for multi-arch
manifests.

For the npm CLI, see [supply-chain-npm.md](./supply-chain-npm.md). For the
architectural context, see [architecture.md §8](./architecture.md#8-versioning--release).

## What is published

**Versioned releases only.** Every versioned image push (e.g. `:1.0.0-alpha.13`)
ships **two stores of attestation** for **each of two platforms** — amd64 and
arm64. The rolling `:unstable` tag, which mutates on every push to `main`,
ships **without attestations** by design — pinning a Sigstore signature to a
moving tag produces verifications that don't compose. Use a versioned tag for
any environment that runs supply-chain verification.

| Store | Provenance | SBOM | Verified with |
|---|---|---|---|
| **OCI referrers (BuildKit)** | `https://slsa.dev/provenance/v1`, attached to each child manifest | `https://spdx.dev/Document`, attached to each child manifest | `docker buildx imagetools inspect` |
| **GitHub / Sigstore** | `https://slsa.dev/provenance/v1`, attached to the manifest-list digest | `https://spdx.dev/Document/v2.3`, attached to each per-platform child digest | `gh attestation verify` |

Two stores are populated deliberately so consumers can use whichever
verification flow fits their environment:

- **Docker-native shops** that already use `imagetools inspect` and
  `cosign verify-attestation` get attestations attached to the OCI
  manifest itself, no GitHub knowledge required.
- **GitHub / Sigstore-native shops** that already use `gh attestation
  verify` (the same flow as for the npm CLI) get a Sigstore-signed
  bundle in GitHub's attestations API and as additional OCI referrers.

Per-platform SBOMs matter: an SBOM scanned on an amd64 runner only
describes amd64 contents (different glibc, different compiled wheels,
different `node` binary). The pipeline produces and attests one SBOM
per child manifest digest so an arm64 consumer who pulls + verifies
gets an SBOM that matches the bytes they downloaded. The SLSA
provenance describes the build invocation itself, which is identical
across platforms — it's attested once, against the index digest.

## Why this matters

The same three classes of attack the npm-side attestations defend against
also apply to the image, with one extra concern:

- **Build-system tampering.** The SLSA provenance binds the image digest
  to a specific GitHub Actions workflow run. A repushed tampered image
  has a different digest; signatures don't transfer.
- **Dependency substitution.** The per-platform SPDX SBOMs enumerate every
  package inside the image — Python wheels, Node.js binaries, Debian
  packages from the `python:3.12-slim` base — at the version actually
  resolved during the build.
- **Registry compromise.** A compromise of GHCR alone can't forge matching
  Sigstore signatures (ephemeral keys, rooted in GitHub's OIDC identity)
  or BuildKit referrer signatures (signed by GitHub's token issuer).
- **Cross-platform substitution** (image-specific). Multi-arch consumers
  who don't pin to a specific platform can be served a tampered child
  manifest if the index referrer chain isn't checked. Per-platform
  attestations let downstream tooling verify the exact bytes their
  runtime arch will actually run.

## How publishing is authenticated

The release pipeline pushes to GHCR using the workflow's automatic
`GITHUB_TOKEN` — no PAT, no service-account credential. Pushing to
`ghcr.io/<org>/<repo>` is gated by GitHub's normal repository
permissions: any workflow with `packages: write` granted on the repo
can push there, and nothing outside the repo can.

```yaml
permissions:
  contents: read
  packages: write           # required to push to ghcr.io
  id-token: write           # required to mint OIDC tokens for Sigstore
  attestations: write       # required to write to GitHub's attestation store

steps:
  - uses: docker/login-action@v4
    with:
      registry: ghcr.io
      username: ${{ github.actor }}
      password: ${{ secrets.GITHUB_TOKEN }}
  - uses: docker/build-push-action@v7
    with:
      push: true
      sbom: true              # BuildKit-native SBOM as OCI referrer
      provenance: mode=max    # BuildKit-native SLSA provenance as OCI referrer
      # …
  - uses: actions/attest-build-provenance@v2
    with:
      subject-name: ghcr.io/jentic/jentic-api-scorecard
      subject-digest: ${{ steps.build.outputs.digest }}
      push-to-registry: true
  - uses: actions/attest@v4
    with:
      subject-name: ghcr.io/jentic/jentic-api-scorecard
      subject-digest: ${{ steps.platforms.outputs.amd64 }}
      sbom-path: ./image.sbom.amd64.spdx.json
      push-to-registry: true
  # …same for arm64
```

`docker/login-action` uses `GITHUB_TOKEN` to authenticate against GHCR.
The `actions/attest-*` steps request an OIDC token (via `id-token:
write`), exchange it with [Fulcio](https://github.com/sigstore/fulcio)
for an ephemeral signing certificate, sign the in-toto statement, and
record it in [Rekor](https://github.com/sigstore/rekor)'s transparency
log — same Sigstore flow as the npm side. With `push-to-registry: true`,
the signed bundle is also attached to the image as an OCI referrer, so
both stores carry the GitHub-side signatures.

The OIDC token's `job_workflow_ref` claim binds the certificate to the
specific workflow file. Verifiers can pin against
`jentic/jentic-api-scorecard/.github/workflows/docker-publish.yml@…` to
reject anything not signed by that exact workflow.

See [`.github/workflows/docker-publish.yml`](../.github/workflows/docker-publish.yml)
for the full pipeline.

## Verifying an image locally

### With `gh attestation verify` (Sigstore flow)

Same flow as the npm side — verify the index digest for provenance, and
the per-platform child digest for the SBOM matching your runtime arch.

```bash
# Provenance: bound to the manifest list (index)
gh attestation verify oci://ghcr.io/jentic/jentic-api-scorecard:1.0.0-alpha.13 \
  --owner jentic

# SBOM: bound to the per-platform child manifest
# Look up the child digest for your arch first
INDEX=ghcr.io/jentic/jentic-api-scorecard:1.0.0-alpha.13
ARM64_DIGEST=$(docker buildx imagetools inspect "$INDEX" --raw \
  | jq -r '.manifests[] | select(.platform.architecture == "arm64" and .platform.os == "linux") | .digest')

gh attestation verify oci://ghcr.io/jentic/jentic-api-scorecard@"$ARM64_DIGEST" \
  --owner jentic \
  --predicate-type https://spdx.dev/Document/v2.3
```

For stricter verification, pin the signer workflow:

```bash
gh attestation verify oci://ghcr.io/jentic/jentic-api-scorecard:1.0.0-alpha.13 \
  --owner jentic \
  --signer-workflow jentic/jentic-api-scorecard/.github/workflows/docker-publish.yml
```

### With `docker buildx imagetools inspect` (BuildKit-native flow)

The OCI referrer attestations are attached as additional manifests with
`platform: unknown/unknown` — `imagetools inspect` decodes them inline.

```bash
# Show the full referrer set
docker buildx imagetools inspect ghcr.io/jentic/jentic-api-scorecard:1.0.0-alpha.13 \
  --format '{{json .Manifest}}'

# Pull a specific referrer's content
docker buildx imagetools inspect ghcr.io/jentic/jentic-api-scorecard:1.0.0-alpha.13 \
  --format '{{json .SBOM}}' | jq .
docker buildx imagetools inspect ghcr.io/jentic/jentic-api-scorecard:1.0.0-alpha.13 \
  --format '{{json .Provenance}}' | jq .
```

`{{json .SBOM}}` and `{{json .Provenance}}` walk the per-platform
attestation manifests automatically and return one entry per platform.

## Downloading an SBOM

To save the SPDX document for downstream SCA tooling:

```bash
# Via Sigstore — one platform at a time
INDEX=ghcr.io/jentic/jentic-api-scorecard:1.0.0-alpha.13
AMD64_DIGEST=$(docker buildx imagetools inspect "$INDEX" --raw \
  | jq -r '.manifests[] | select(.platform.architecture == "amd64" and .platform.os == "linux") | .digest')

gh attestation verify oci://ghcr.io/jentic/jentic-api-scorecard@"$AMD64_DIGEST" \
  --owner jentic \
  --predicate-type https://spdx.dev/Document/v2.3 \
  --format json \
  | jq '.[0].verificationResult.statement.predicate' \
  > image.sbom.amd64.spdx.json

# Via BuildKit — both platforms in one call
docker buildx imagetools inspect "$INDEX" --format '{{json .SBOM}}' \
  > image.sbom.all-platforms.json
```

Either is a valid SPDX 2.3 document; the BuildKit form bundles both
platforms in a single JSON object keyed by platform.

## Verifying in a downstream pipeline

Gate a deployment on per-platform verification:

```yaml
- name: Verify scorecard image for the runtime platform
  run: |
    INDEX="ghcr.io/jentic/jentic-api-scorecard:1.0.0-alpha.13"
    PLATFORM_DIGEST=$(docker buildx imagetools inspect "$INDEX" --raw \
      | jq -r '.manifests[] | select(.platform.architecture == "amd64" and .platform.os == "linux") | .digest')

    gh attestation verify "oci://${INDEX%:*}@${PLATFORM_DIGEST}" \
      --owner jentic \
      --signer-workflow jentic/jentic-api-scorecard/.github/workflows/docker-publish.yml \
      --predicate-type https://spdx.dev/Document/v2.3

    gh attestation verify "oci://${INDEX}" \
      --owner jentic \
      --signer-workflow jentic/jentic-api-scorecard/.github/workflows/docker-publish.yml
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The first call verifies the SBOM matches the bytes the runtime will
actually run; the second confirms the provenance covers the full
multi-arch index.
