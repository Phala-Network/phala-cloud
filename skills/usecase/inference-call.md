---
name: inference-call
description: |
  Call Phala Private AI (hosted models in TEEs) via the
  OpenAI-compatible interface at inference.phala.com/v1. Use when users want
  to use hosted chat, embeddings, or System One decisions without deploying
  their own server — pay per token, no infrastructure.
---

# Phala Private AI

OpenAI-compatible confidential inference at `https://inference.phala.com/v1`.

## Operations

| User says | Operation |
| --- | --- |
| "call confidential AI", "use phala model", "OpenAI compatible" | **First Call** |
| "get an API key", "how to authenticate" | **Get API Key** |
| "Python SDK", "TypeScript SDK" | **SDKs** |
| "stream tokens", "SSE" | **Streaming** |
| "tool calling", "function calling" | **Tool Calling** |
| "vision", "image input" | **Images & Vision** |
| "structured output", "JSON mode" | **Structured Output** |
| "verify the response", "signed receipt" | **Verify Signature** |
| "list models", "available models", "embeddings" | **Model Catalog** |
| "Kev", "System One", "typed decisions" | **System One Decisions** |

---

## Get API Key

1. Sign in to [cloud.phala.com](https://cloud.phala.com). Private AI is paid from your workspace Balance, the same Balance that pays for CVMs. There is no separate top-up and no minimum; Gifted credits do not pay for it. If your Balance is empty, top up (or add a card and claim a welcome credit if one is offered).
2. Open **Private AI → API Keys**.
3. Click **Create Key**, give it a name, and copy the value (starts with `sk-`).

Store the key in your environment:

```bash
export PHALA_AI_API_KEY="sk-..."
```

---

## First Call

### cURL

```bash
curl --fail-with-body -sS https://inference.phala.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PHALA_AI_API_KEY" \
  -d '{
    "model": "z-ai/glm-5.3",
    "messages": [
      { "role": "user", "content": "Hello world!" }
    ]
  }'
```

That's the canonical "hello world." Replace the model and message and you're done.

---

## Model Catalog

Fetch the public catalogs before selecting a model or quoting a price. Model IDs are namespaced by model publisher; `providers` lists the serving routes. Models on this endpoint run in TEEs, with evidence coverage that varies by provider. Catalog flags do not verify a particular response.

```bash
curl --fail-with-body -sS https://inference.phala.com/v1/models | \
  jq '.data[] | {id, providers, context_length, input_modalities,
                output_modalities, supported_parameters, supported_features, pricing}'

curl --fail-with-body -sS https://inference.phala.com/v1/embeddings/models | \
  jq '.data[] | {id, providers, context_length, pricing}'
```

`pricing.prompt`, `pricing.completion`, and `pricing.input_cache_read` (when present) are USD per token; multiply by 1,000,000 for per-million-token prices. Usage can include `cost`, the request charge in USD. Read current prices from the catalog instead of maintaining a static table.

Choose the API by modality:

| Model kind | Endpoint | Selection |
| --- | --- | --- |
| Chat/text | `POST /v1/chat/completions` | For example, `z-ai/glm-5.3`; check supported parameters/features for tools and structured output. |
| Embeddings | `POST /v1/embeddings` | Select a model from `/v1/embeddings/models`. |
| Decisions | `POST /v1/systemone` | `jaredpalmer/kev-4b` has `output_modalities: ["decisions"]`; it does not serve chat or stream. |

## System One Decisions

Kev answers typed questions about a state. Send `noul`, `choice`, and `score` questions through System One:

```bash
curl --fail-with-body -sS https://inference.phala.com/v1/systemone \
  -H "Authorization: Bearer $PHALA_AI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "jaredpalmer/kev-4b",
    "state": "I was charged twice this month. Please fix it today.",
    "questions": {
      "billing": { "type": "noul", "instructions": "Is this about billing?" },
      "tone": {
        "type": "choice",
        "instructions": "What is the tone?",
        "criteria": { "calm": null, "upset": null }
      },
      "urgency": {
        "type": "score",
        "instructions": "How urgent is it?",
        "criteria": ["low", "medium", "high"]
      }
    }
  }'
```

The response's `answers.billing.noul` is the probability of true, `answers.tone.choice` is the selected option, and `answers.urgency.score` is the probability-weighted level index. See the [System One reference](https://docs.phala.com/phala-cloud/confidential-ai/confidential-model/api-reference/systemone) for the full response and TypeSafe SDK examples. Those SDKs append `/v1/systemone`, so their base URL is `https://inference.phala.com` without `/v1`.

---

## SDKs

Use the OpenAI SDK with the Phala base URL and API key for compatible chat requests. This alone does not verify attestation or response receipts; see **Verify Signature**.

### Python (OpenAI SDK)

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["PHALA_AI_API_KEY"],
    base_url="https://inference.phala.com/v1",
)

response = client.chat.completions.create(
    model="z-ai/glm-5.3",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is your model name?"},
    ],
)
print(response.choices[0].message.content)
```

### TypeScript (OpenAI SDK)

```typescript
import OpenAI from "openai"

const apiKey = process.env.PHALA_AI_API_KEY
if (!apiKey) throw new Error("PHALA_AI_API_KEY is required")

const client = new OpenAI({
  baseURL: "https://inference.phala.com/v1",
  apiKey,
})

const completion = await client.chat.completions.create({
  model: "z-ai/glm-5.3",
  messages: [{ role: "user", content: "What is your model name?" }],
})

console.log(completion.choices[0].message)
```

### LangChain

```python
import os
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="z-ai/glm-5.3",
    base_url="https://inference.phala.com/v1",
    api_key=os.environ["PHALA_AI_API_KEY"],
)
```

---

## Streaming

```python
stream = client.chat.completions.create(
    model="z-ai/glm-5.3",
    messages=[{"role": "user", "content": "Write a haiku about TEEs"}],
    stream=True,
)
for chunk in stream:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="", flush=True)
```

cURL with SSE:

```bash
curl --fail-with-body -sS https://inference.phala.com/v1/chat/completions \
  -H "Authorization: Bearer $PHALA_AI_API_KEY" \
  -H "Content-Type: application/json" \
  -N \
  -d '{
    "model": "z-ai/glm-5.3",
    "messages": [{"role":"user","content":"Hello"}],
    "stream": true
  }'
```

---

## Tool Calling

Standard OpenAI tool-calling format.

```python
tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get weather for a city",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    },
}]

response = client.chat.completions.create(
    model="z-ai/glm-5.3",
    messages=[{"role": "user", "content": "Weather in Tokyo?"}],
    tools=tools,
)
print(response.choices[0].message.tool_calls)
```

Check `supported_parameters` for `tools` and the catalog's `supported_features` before using tool calling with a model.

---

## Images & Vision

For VLM models like `qwen/qwen3-vl-30b-a3b-instruct`:

```python
response = client.chat.completions.create(
    model="qwen/qwen3-vl-30b-a3b-instruct",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What's in this image?"},
            {"type": "image_url", "image_url": {"url": "https://upload.wikimedia.org/wikipedia/commons/6/67/Giant_Pandas_having_a_snack.jpg"}},
        ],
    }],
)
```

---

## Structured Output

JSON mode + JSON Schema:

```python
response = client.chat.completions.create(
    model="z-ai/glm-5.3",
    messages=[{"role": "user", "content": "Give me a person record."}],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "person",
            "schema": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "age": {"type": "integer"},
                },
                "required": ["name", "age"],
            },
        },
    },
)
```

---

## Verify Signature

Use [the TypeScript ACI SDK](https://docs.phala.com/phala-cloud/confidential-ai/verify/typescript-sdk) (`connectAci`) or [Private AI Proxy](https://docs.phala.com/phala-cloud/confidential-ai/agents/private-ai-proxy) for client-side verification. Ordinary OpenAI clients and cURL do not verify each response.

The proof artifacts are:

| Artifact | Endpoint | Scope |
| --- | --- | --- |
| Attestation | `GET /v1/aci/attestation?nonce=<64 lowercase hex>` | The Phala gateway's quote and workload keyset. |
| Receipt | `GET /v1/aci/receipts/{id}` | Signed event log with `workload_keyset_digest` and request/response `body_hash` values; obtain the id from `x-receipt-id`. |
| Session | `GET /v1/aci/sessions/{session_id}` | Evidence and channel binding for the upstream cited by the receipt; coverage varies by provider. |

To inspect the public gateway report:

```bash
NONCE=$(openssl rand -hex 32)
curl --fail-with-body -sS "https://inference.phala.com/v1/aci/attestation?nonce=$NONCE" | \
  jq '{api_version, workload_keyset_digest, attestation, service_capabilities}'
```

This displays evidence; it does not verify the quote, nonce binding, TLS pin, or receipt signature. Fetch receipts after consuming the complete response, using the same API key that made the request. See [verify-attestation.md](verify-attestation.md) for verification clients, receipt/session checks, and self-deployed CVM verification.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| 400 Bad Request | Unknown model or unsupported parameter | Select an exact model ID and supported parameters from the live catalog |
| 401 Unauthorized | Bad / expired key | Generate a new key in Private AI → API Keys |
| 403 Forbidden | Balance too low to fund Private AI | Top up your Balance (or turn on auto-topup); calls work again within about 5 minutes |
| 404 Not Found | No eligible route, or unknown/expired receipt or session | Inspect request constraints and artifact retention |
| 412 Precondition Failed | `session_not_accepted`: none of the pinned sessions can serve | Fetch and verify current sessions before updating `provider.aci_session_ids` |
| 429 Rate Limited | Rate limit reached | Back off and respect `Retry-After` when present |
| 503 Service Unavailable | `upstream_verification_failed`: required upstream verification or binding failed | Inspect the failure and retry when verification is healthy; do not bypass verification |
| Response cuts off | Hit `max_tokens` | Increase `max_tokens` in request |
| Slow first token | Model/provider latency varies | Inspect request timing and the current model catalog |

---

## Reference: minimal API call

```bash
# 1. Get an API key from cloud.phala.com → Private AI → API Keys (paid from your Balance)
export PHALA_AI_API_KEY="sk-..."

# 2. Call
curl --fail-with-body -sS https://inference.phala.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PHALA_AI_API_KEY" \
  -d '{
    "model": "z-ai/glm-5.3",
    "messages": [{"role":"user","content":"Hello world!"}]
  }'
```

For self-hosted alternative (dedicated GPU + your own model weights), see `gpu-vllm-deploy.md`.
