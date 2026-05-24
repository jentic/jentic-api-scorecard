FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.8.5 /uv /usr/local/bin/uv

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project


FROM python:3.12-slim

LABEL maintainer="vladimir@jentic.com" \
      org.opencontainers.image.authors="vladimir@jentic.com" \
      org.opencontainers.image.url="https://github.com/jentic/jentic-api-scorecard" \
      org.opencontainers.image.source="https://github.com/jentic/jentic-api-scorecard" \
      org.opencontainers.image.description="Jentic API Scorecard Docker image" \
      org.opencontainers.image.licenses="Apache-2.0"

COPY --from=node:24-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:24-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx && \
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

# Warm npm cache: run a real score so npx-invoked validators get cached
COPY --chown=runner:runner .build/sample.yaml /tmp/sample.yaml
RUN jentic-apitools score /tmp/sample.yaml --format json --quiet > /dev/null && \
    rm /tmp/sample.yaml

ENTRYPOINT ["python", "-m", "jentic_scorecard_runner"]
