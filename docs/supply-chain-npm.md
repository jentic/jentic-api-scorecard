# npm package supply chain

This document covers the cryptographic guarantees that ship with every
`@jentic/api-scorecard-cli` release on npm: what is signed, how the pipeline
authenticates to npm without long-lived secrets, and how to verify a tarball
end-to-end.

For the GHCR container image, see [supply-chain-docker.md](./supply-chain-docker.md).
For the architectural context, see [architecture.md §8](./architecture.md#8-versioning--release).

## What is published

Every alpha release publishes one tarball plus two independently-signed
attestations bound to the tarball's SHA-256 digest:

| Artifact | Predicate type | Stored in | Tells you |
|---|---|---|---|
| **Tarball** | — | npm registry | The published bytes consumers actually download. |
| **npm provenance** | `https://slsa.dev/provenance/v1` | npm registry record + GitHub attestations API | Where and how the tarball was built (workflow ref, commit SHA, builder identity). |
| **SPDX SBOM** | `https://spdx.dev/Document/v2.3` | GitHub attestations API | The runtime dependency closure of the published tarball, in [SPDX 2.3](https://spdx.github.io/spdx-spec/v2.3/) form. |

Both attestations ship with every release.

## Why this matters

Three classes of supply-chain attack the attestations let you defend against:

- **Build-system tampering.** The SLSA provenance binds the tarball digest to
  a specific GitHub Actions workflow run. If an attacker re-publishes a
  tampered tarball, its digest won't match any provenance attestation and
  `verify` fails. Pinning to a known-good `--signer-workflow` makes this
  detection mandatory rather than advisory.
- **Dependency substitution.** The SPDX SBOM enumerates every runtime
  dependency at the version actually resolved during `npm install
  --omit=dev`. If a transitive dep gets compromised, any SCA tool
  (Trivy, Grype, OSV-Scanner) can scan the SBOM directly and tell you
  whether you're affected — without re-running install.
- **Registry compromise.** Both attestations live outside npm's primary
  control plane (provenance is also indexed at GitHub's attestation API,
  SBOM lives there exclusively). A compromise of npm alone can't forge
  matching Sigstore signatures because the signing keys are ephemeral and
  rooted in GitHub's OIDC identity.

## How publishing is authenticated

The release pipeline never carries an `NPM_TOKEN` secret. Authentication to
npm uses **OIDC trusted publishing**:

```yaml
permissions:
  id-token: write           # required to mint OIDC tokens
  contents: write
  attestations: write

steps:
  - uses: actions/setup-node@v6
    with:
      registry-url: https://registry.npmjs.org   # tells npm CLI where to authenticate
  - run: npx lerna publish from-package --no-private --yes --dist-tag alpha
```

`actions/setup-node` configures the npm CLI to request an OIDC token from
GitHub's token issuer and exchange it with npm for short-lived publish
credentials. The token's `job_workflow_ref` claim names the exact workflow
file + ref that's allowed to publish — npm enforces this against the
trusted-publisher configuration on the npm side. There is no long-lived
secret to steal, rotate, or accidentally leak.

The same job also requests `id-token: write` for Sigstore: the SLSA
provenance step (`actions/attest-build-provenance`) and the SPDX attestation
step (`actions/attest`) mint an ephemeral signing certificate from
[Fulcio](https://github.com/sigstore/fulcio) bound to the workflow's OIDC
identity, sign the in-toto statement, and record it in
[Rekor](https://github.com/sigstore/rekor)'s transparency log. The keys
live for the duration of the signing operation; nothing persistent is
held by the runner.

See [`.github/workflows/release.yml`](../.github/workflows/release.yml) for
the full pipeline.

## Verifying a release locally

Verification needs only [GitHub CLI](https://cli.github.com/) ≥ 2.49 — no
separate Sigstore client install.

```bash
# 1. Download the published tarball
npm pack @jentic/api-scorecard-cli@alpha

# 2. Verify the npm provenance (gh's default predicate type)
gh attestation verify ./jentic-api-scorecard-cli-*.tgz --owner jentic

# 3. Verify the SPDX SBOM (non-default predicate, must be requested explicitly)
gh attestation verify ./jentic-api-scorecard-cli-*.tgz --owner jentic \
  --predicate-type https://spdx.dev/Document/v2.3
```

Each successful run reports `Loaded digest sha256:…` and lists the matched
attestation, the certificate's signer-workflow identity, and the Rekor log
entry. A failed verification exits non-zero.

For stricter verification, pin the signer workflow:

```bash
gh attestation verify ./jentic-api-scorecard-cli-*.tgz --owner jentic \
  --signer-workflow jentic/jentic-api-scorecard/.github/workflows/release.yml
```

This rejects any tarball not signed by exactly that workflow file —
useful in policy-controller setups where you want to refuse tarballs from
unrelated workflows even within the same org.

## Downloading the SBOM

`gh attestation verify` proves authenticity but does not print the SPDX
document itself. The SBOM is embedded as the `predicate` of the verified
in-toto statement; extract it with `--format json` and pipe through `jq`:

```bash
gh attestation verify ./jentic-api-scorecard-cli-*.tgz --owner jentic \
  --predicate-type https://spdx.dev/Document/v2.3 \
  --format json \
  | jq '.[0].verificationResult.statement.predicate' \
  > sbom.spdx.json
```

`sbom.spdx.json` is a complete SPDX 2.3 document — the document root carries
the published package's purl
(`pkg:npm/@jentic/api-scorecard-cli@<version>`) and the `packages` array
enumerates every runtime dependency with its exact resolved version. Feed
it directly to any SPDX-aware tool ([Trivy](https://trivy.dev/),
[Grype](https://github.com/anchore/grype),
[OSV-Scanner](https://github.com/google/osv-scanner)).

Tying download to verification is deliberate: the recipe above succeeds
only if the signature checks out, so you never end up with bytes that
didn't pass the trust check.

## Verifying in a downstream pipeline

Any GitHub Actions workflow can gate on the same verification before
installing or running the CLI:

```yaml
- name: Verify and install scorecard CLI
  run: |
    npm pack @jentic/api-scorecard-cli@alpha
    gh attestation verify ./jentic-api-scorecard-cli-*.tgz --owner jentic \
      --signer-workflow jentic/jentic-api-scorecard/.github/workflows/release.yml
    npm install -g ./jentic-api-scorecard-cli-*.tgz
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The `GH_TOKEN` is needed only for the GitHub attestations API lookup
(public-repo reads use the workflow's default token, no extra scope
required).
