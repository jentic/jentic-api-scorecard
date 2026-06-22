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
    # Refresh bundled npm so its transitive deps (picomatch via tinyglobby,
    # ip-address, brace-expansion, …) carry current fixes. Required: stock npm
    # bundles vulnerable picomatch 4.0.3 (CVE-2026-33671); npm@latest ships the
    # fixed 4.0.4. The trade-off is that npm@latest also bundles undici 6.26.0
    # (CVE-2026-12151), patched just below.
    npm install -g npm@latest && \
    npm cache clean --force && \
    # Patch undici CVE-2026-12151 (WebSocket-client DoS): npm@latest bundles
    # undici 6.26.0, below the 6.27.0 fix, and the npx-warmed validators pull
    # 6.24.0 into the cache. The flaw is unreachable here (the validators only
    # GET specs over HTTP — no WebSocket client), but we ship the image, so
    # consumers' scanners flag it and can't patch; only an in-image bump reaches
    # them. Stash the latest 6.x to /opt (always >= 6.27.0, never a downgrade)
    # and overwrite npm's bundled copy now; the cache copy is patched as runner
    # after the warm-cache run below. Drop once both carry undici >= 6.27.0.
    mkdir -p /opt/undici-6 && \
    npm pack undici@6 --pack-destination /opt/undici-6 > /dev/null && \
    tar -xzf /opt/undici-6/undici-*.tgz -C /opt/undici-6 && \
    rm -f /opt/undici-6/undici-*.tgz && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/undici && \
    cp -a /opt/undici-6/package /usr/local/lib/node_modules/npm/node_modules/undici && \
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
# Then overwrite the vulnerable undici 6.24.0 the validators pulled into the
# npx cache with the patched 6.x stashed at /opt (see CVE-2026-12151 above);
# runner owns the cache, so this must run in the unprivileged layer.
RUN python -m jentic_scorecard_runner score \
        --url https://raw.githubusercontent.com/jentic/jentic-public-apis/refs/heads/main/apis/openapi/swagger-api/petstore/1.0.27/openapi.json \
        > /dev/null && \
    find /var/cache/npm -type d -path '*/node_modules/undici' \
        -exec sh -c 'rm -rf "$1" && cp -r /opt/undici-6/package "$1"' _ {} \;

ENTRYPOINT ["python", "-m", "jentic_scorecard_runner"]
