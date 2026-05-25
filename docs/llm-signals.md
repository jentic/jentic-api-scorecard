# LLM-Backed Signals

Add `--with-llm` to your scoring command and the engine runs LLM-backed analysis alongside the
standard structural checks. This produces deeper semantic signals — things a regex or AST walk
can't catch — across several JAIRF dimensions.

## What LLM signals add

Without `--with-llm`, scoring relies on structural analysis: validators (Redocly, Spectral,
Speclynx) and rule-based heuristics. These catch conformance issues, missing fields, and
structural patterns, but they can't evaluate whether a description *makes sense to an agent* or
whether error responses give enough context for autonomous recovery.

With `--with-llm`, the engine sends targeted prompts to an LLM to evaluate:

| Dimension | What the LLM evaluates |
|---|---|
| **AI-Readiness & Agent Experience (ARAX)** | Are operation descriptions actionable? Do summaries give an agent enough context to choose the right endpoint? Are parameter descriptions unambiguous? |
| **Agent Usability (AU)** | Can an agent reason about multi-step workflows from the spec alone? Are error responses informative enough for autonomous retry/recovery? |
| **AI Discoverability (AID)** | Is the spec's descriptive richness sufficient for an AI system to index and retrieve operations by intent? |
| **Developer Experience (DXJ)** | Are examples realistic and representative? Do descriptions match actual behavior? |

The result JSON shape is unchanged — LLM-derived signals appear in the same
`details[].dimensions[].signals[]` array with the same `kind`/`name`/`score`/`metadata` structure.
Scores from `--with-llm` runs are **not directly comparable** to runs without it: the LLM signals
contribute to dimension and overall scores, so the same spec may score differently with and without
the flag.

## Quick start

### Cloud provider (OpenAI example)

```bash
export OPENAI_API_KEY=sk-...
export LLM_PROVIDER=OPENAI
export LIGHT_LLM_PROVIDER=OPENAI
export LLM_LIGHT_MODEL=gpt-4o-mini

npx @jentic/api-scorecard-cli@alpha score ./openapi.yaml --with-llm
```

### Cloud provider (Anthropic example)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export LLM_PROVIDER=ANTHROPIC
export LIGHT_LLM_PROVIDER=ANTHROPIC
export LLM_LIGHT_MODEL=claude-haiku-4-5-20251001

npx @jentic/api-scorecard-cli@alpha score ./openapi.yaml --with-llm
```

### Cloud provider (AWS Bedrock)

Bedrock is the engine's default provider. Export your AWS credentials and override the light
model ID to match your region's inference profile:

```bash
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=eu-west-1
export LLM_LIGHT_MODEL=eu.anthropic.claude-haiku-4-5-20251001-v1:0

npx @jentic/api-scorecard-cli@alpha score ./openapi.yaml --with-llm
```

The engine defaults to `global.anthropic.claude-haiku-4-5-20251001-v1:0` for `LLM_LIGHT_MODEL`
(cross-region inference profile). If your account uses region-scoped profiles, override with the
appropriate prefix (`eu.`, `us.`, or the base model ID without prefix for single-region access).
The scoring engine uses the light model exclusively for semantic analysis.

### Local endpoint (Ollama Docker image)

Run a local LLM in Docker — nothing leaves your network. Since Docker is already installed for
the scorecard, this is the fastest path:

```bash
# Pull and start Ollama in a container (runs on port 11434)
docker run -d --name ollama -p 11434:11434 ollama/ollama

# Pull a model into the running container
docker exec ollama ollama pull llama3.1:8b

# Score with the local model
export LLM_PROVIDER=OPENAI
export LIGHT_LLM_PROVIDER=OPENAI
export OPENAI_API_URL=http://localhost:11434/v1/chat/completions
export OPENAI_API_KEY=ollama
export LLM_MODEL=llama3.1:8b
export LLM_LIGHT_MODEL=llama3.1:8b

npx @jentic/api-scorecard-cli@alpha score ./openapi.yaml --with-llm
```

For GPU acceleration, add `--gpus all` to the `docker run` command.

This works identically with any OpenAI-compatible server (LM Studio, vLLM, llama.cpp, …)
exposing the `/v1/chat/completions` endpoint on your host.

## Environment variables reference

### Credentials (at least one required)

| Variable | Provider |
|---|---|
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic |
| `GEMINI_API_KEY` | Google Gemini |
| `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` | AWS Bedrock |
| `AWS_SESSION_TOKEN` | AWS Bedrock (temporary credentials) |
| `AWS_REGION` | AWS Bedrock (region selection) |
| `AWS_BEARER_TOKEN_BEDROCK` | AWS Bedrock (bearer token auth) |

### Routing (required for non-Bedrock providers)

| Variable | Purpose |
|---|---|
| `LLM_PROVIDER` | Primary model provider (`OPENAI`, `ANTHROPIC`, `GEMINI`, `BEDROCK`) |
| `LIGHT_LLM_PROVIDER` | Lightweight model provider (same values) |
| `LLM_LIGHT_MODEL` | Lightweight model ID — **this is what scoring uses** (e.g. `gpt-4o-mini`, `eu.anthropic.claude-haiku-4-5-20251001-v1:0`) |
| `LLM_MODEL` | Primary model ID (not used for scoring today; reserved for future engine features) |
| `LLM_MAX_TOKENS` | Max tokens per LLM call (optional) |
| `OPENAI_API_URL` | Custom endpoint URL (for local/self-hosted) |
| `ANTHROPIC_API_URL` | Custom Anthropic endpoint URL |
| `GEMINI_API_URL` | Custom Gemini endpoint URL |

**Important:** The engine defaults to Bedrock for all three routing variables. Without
`LLM_LIGHT_MODEL` the engine falls back to a Bedrock model ID and the run will fail for
non-Bedrock providers. Always set `LLM_PROVIDER`, `LIGHT_LLM_PROVIDER`, and `LLM_LIGHT_MODEL`
together when using a non-Bedrock provider.

## Token cost

The engine uses the lightweight model (`LLM_LIGHT_MODEL`) exclusively and processes operations
in batches of ~7. Each batch sends a system prompt (~800 tokens), a compact semantic context
(API info, tags, security schemes, and the names/descriptions of the top 15 referenced
schemas — not full schema bodies), and the operation signatures with their current descriptions.
The full spec is never sent — only the minimal context needed for quality assessment (~500–1000
tokens for the shared context, plus per-operation metadata).

The engine caps at 7 batches by default, sampling randomly when there are more. This keeps cost
bounded regardless of spec size: a 200-operation spec runs the same number of LLM calls as a
50-operation spec.

Actual per-run cost depends on the spec's verbosity and your provider's pricing. As a reference,
the [Petstore v3](https://petstore3.swagger.io/api/v3/openapi.json) spec (19 operations, 3 batches) consumed roughly 15k input tokens and 8k output
tokens per run with Claude Haiku. Local models (Ollama, vLLM) cost nothing per call.

## How it works under the hood

1. The CLI scans your environment for credentials and routing variables.
2. If `--with-llm` is set and no usable provider is found, the CLI exits immediately with a
   guidance message — no Docker container is started, no network calls are made.
3. Credentials (API keys, AWS secrets) are forwarded via Docker's `-e NAME` passthrough — values
   never appear on the command line or in logs. Endpoint URLs (`*_API_URL`) may be rewritten for
   container reachability and passed as `-e NAME=value` (URLs are not secrets).
4. For local endpoints pointing at `localhost` / `127.0.0.1` / `0.0.0.0`, the CLI automatically
   configures Docker networking so the container can reach your host machine — `--network host`
   on Linux (localhost just works), `--add-host` + URL rewrite to `host.docker.internal` on
   macOS / Windows. This works on all three platforms with no extra configuration.
5. Inside the container, the engine reads the forwarded variables and routes LLM calls to the
   configured provider.

## Security notes

- Credentials (API keys, AWS secrets) are forwarded using Docker's passthrough form (`-e NAME`
  without `=value`). They never appear in process argument lists, spinner output, error messages,
  or logs. Endpoint URLs may be rewritten for container reachability and passed as `-e NAME=value`
  — URLs are not secrets, but avoid embedding credentials in custom endpoint URLs.
- For the duration of the scoring run, forwarded credentials are visible via
  `docker inspect <container-id>`. This is standard Docker behavior — anyone with access to your
  Docker daemon already has this level of access.
- Local-endpoint mode keeps all data on your machine. The container reaches your local LLM server
  via the host gateway; no spec content or credentials leave your network.

## Troubleshooting

**"--with-llm requires an LLM provider but none was detected"**

The CLI couldn't find any credentials. Check that your exports are in the current shell session
(not just in a `.env` file). Run `echo $OPENAI_API_KEY` (or whichever credential) to confirm.

**Engine fails with a Bedrock error but you're using OpenAI/Anthropic/Gemini**

You're missing the routing triple. The engine defaults all three to Bedrock-shaped values. Set:
```bash
export LLM_PROVIDER=OPENAI          # match your credential
export LIGHT_LLM_PROVIDER=OPENAI
export LLM_LIGHT_MODEL=gpt-4o-mini  # must be valid for your provider
```

**Local endpoint unreachable from container**

Ensure your server is listening on `0.0.0.0` (not just `127.0.0.1`) and that `OPENAI_API_URL`
uses `localhost` or `127.0.0.1` in the hostname. The CLI detects these and injects the Docker
host-gateway flag automatically.

**Scoring takes much longer with `--with-llm`**

Expected. LLM calls add latency — typically 30–90 seconds depending on the provider, model, and
spec size. Local models may be slower depending on hardware. Use `--detail signals` to see which
signals benefited from LLM analysis.
