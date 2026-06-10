# `--with-llm`: LLM-backed analysis

Read this before building any `--with-llm` invocation. The flag turns on extra
JAIRF signals that an LLM evaluates (e.g. descriptive richness of summaries and
descriptions). When `--with-llm` is **off**, those signals hold a perfect-score
baseline and no provider is contacted.

## How the CLI finds a provider

When `--with-llm` is set, the CLI scans the **host environment** for provider
credentials plus routing variables and forwards the detected set into the
container. It does not read a config file — everything comes from environment
variables. If no usable provider is detected, the CLI exits **before** scoring with
a guidance message; it does not silently skip the LLM signals.

A provider is "usable" when one of these is true:

- A cloud credential is present: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
  `GEMINI_API_KEY`, or AWS Bedrock credentials (`AWS_ACCESS_KEY_ID` +
  `AWS_SECRET_ACCESS_KEY`, **or** `AWS_BEARER_TOKEN_BEDROCK`).
- A local OpenAI-compatible endpoint is configured: `LLM_PROVIDER=OPENAI` **and**
  `OPENAI_API_URL` set **and** `OPENAI_API_KEY` set (any non-empty value).

## Routing variables

For any non-Bedrock provider you must also set routing variables, or the engine
falls back to a Bedrock model ID and the run fails. Set all three together:

| Variable | Purpose |
|---|---|
| `LLM_PROVIDER` | `OPENAI`, `ANTHROPIC`, `GEMINI`, or `BEDROCK` — match your credential. |
| `LIGHT_LLM_PROVIDER` | Provider for the lightweight model (usually the same value). |
| `LLM_LIGHT_MODEL` | The lightweight model ID scoring actually uses (e.g. `gpt-4o-mini`). |

Optional: `LLM_MODEL` (primary model ID, reserved), `LLM_MAX_TOKENS` (cap),
`OPENAI_API_URL` / `ANTHROPIC_API_URL` / `GEMINI_API_URL` (custom endpoints).

> AWS Bedrock is the engine's default provider, so a Bedrock setup can omit
> `LLM_PROVIDER` / `LIGHT_LLM_PROVIDER` — but you still set `LLM_LIGHT_MODEL` to a
> Bedrock model ID. Every other provider needs the three routing vars above.

## Recipes

### Cloud — OpenAI

```bash
export OPENAI_API_KEY=sk-...
export LLM_PROVIDER=OPENAI
export LIGHT_LLM_PROVIDER=OPENAI
export LLM_LIGHT_MODEL=gpt-4o-mini

JENTIC_API_KEY=$KEY npx @jentic/api-scorecard-cli@latest score ./openapi.yaml --with-llm
```

### Cloud — Anthropic

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export LLM_PROVIDER=ANTHROPIC
export LIGHT_LLM_PROVIDER=ANTHROPIC
export LLM_LIGHT_MODEL=claude-haiku-4-5-20251001

JENTIC_API_KEY=$KEY npx @jentic/api-scorecard-cli@latest score ./openapi.yaml --with-llm
```

### Cloud — AWS Bedrock

```bash
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=eu-west-1
export LLM_LIGHT_MODEL=eu.anthropic.claude-haiku-4-5-20251001-v1:0

JENTIC_API_KEY=$KEY npx @jentic/api-scorecard-cli@latest score ./openapi.yaml --with-llm
```

### Local — Ollama (OpenAI-compatible, keeps everything on-machine)

```bash
docker run -d --name ollama -p 11434:11434 ollama/ollama
docker exec ollama ollama pull llama3.1:8b

export LLM_PROVIDER=OPENAI
export LIGHT_LLM_PROVIDER=OPENAI
export OPENAI_API_URL=http://localhost:11434/v1/chat/completions
export OPENAI_API_KEY=ollama          # any non-empty value
export LLM_MODEL=llama3.1:8b
export LLM_LIGHT_MODEL=llama3.1:8b

JENTIC_API_KEY=$KEY npx @jentic/api-scorecard-cli@latest score ./openapi.yaml --with-llm
```

The CLI rewrites loopback URLs so a host-side Ollama is reachable from inside the
container.

## Failure semantics (exit code 8)

If the provider call fails (bad credentials, unreachable endpoint, model error),
the LLM-derived signals would otherwise be scored as perfect and **inflate** the
result. To avoid reporting a misleadingly high score, the CLI **suppresses the
report**, prints the affected signals and the provider error on stderr, and exits
with code **8**.

When you see exit 8: either fix the provider configuration above, or re-run
**without** `--with-llm` to get a valid non-LLM score.

## Authoritative reference

The complete signal list and provider notes live in the repo's
[LLM Signals guide](https://github.com/jentic/jentic-api-scorecard/blob/main/docs/llm-signals.md).
