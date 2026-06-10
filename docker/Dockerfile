FROM python:3.14-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.8.5 /uv /usr/local/bin/uv

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project


FROM python:3.14-slim

LABEL maintainer="vladimir@jentic.com" \
      org.opencontainers.image.authors="vladimir@jentic.com" \
      org.opencontainers.image.url="https://github.com/jentic/jentic-api-scorecard" \
      org.opencontainers.image.source="https://github.com/jentic/jentic-api-scorecard" \
      org.opencontainers.image.description="Jentic API Scorecard Docker image" \
      org.opencontainers.image.licenses="Apache-2.0"

COPY --from=node:24-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:24-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
# hadolint ignore=DL3008  # openssl bump below is intentionally unpinned (see comment)
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx && \
    # TEMPORARY: patch CVE-2026-45447 (OpenSSL PKCS#7 use-after-free). The fix
    # is in Debian trixie-security as 3.5.6-1~deb13u2 but not yet baked into
    # python:3.14-slim. We ship the runtime image, so consumers' container
    # scanners (and admission controllers) flag it on the image they pull and
    # can't patch — only a bump here reaches them. Drop this whole apt block
    # once the base image carries the fix (then the package is current anyway).
    # Intentionally unpinned: apt installs the newest available candidate (the
    # fix or any later ~deb13uN), giving ">= fixed version" semantics without a
    # brittle exact pin that breaks once that version is superseded and dropped.
    apt-get update && \
    apt-get install -y --no-install-recommends \
        openssl libssl3t64 openssl-provider-legacy && \
    rm -rf /var/lib/apt/lists/* && \
    # Refresh bundled npm so its transitive deps (ip-address, brace-expansion, …) carry current fixes.
    npm install -g npm@latest && \
    npm cache clean --force && \
    # System pip is unused at runtime — venv ships via uv. Remove it to drop pip CVEs from the scan.
    rm -rf /usr/local/lib/python3.14/site-packages/pip \
           /usr/local/lib/python3.14/site-packages/pip-*.dist-info \
           /usr/local/bin/pip /usr/local/bin/pip3 /usr/local/bin/pip3.14 && \
    groupadd --gid 10001 runner && \
    useradd --uid 10001 --gid 10001 --home-dir /home/runner \
            --create-home --shell /usr/sbin/nologin runner && \
    mkdir -p /var/cache/npm && \
    chown runner:runner /var/cache/npm

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv
COPY src/ ./src/
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH=/app/src \
    HOME=/home/runner \
    NPM_CONFIG_CACHE=/var/cache/npm

USER runner

# Warm npm cache: run a real score so npx-invoked validators get cached.
# The OAK petstore URL is on the gate's allowlist, so no key is required.
RUN python -m jentic_scorecard_runner score \
        --url https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/swagger-api/petstore/1.0.27/openapi.json \
        > /dev/null

ENTRYPOINT ["python", "-m", "jentic_scorecard_runner"]
