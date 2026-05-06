---
name: inference-call
description: |
  Call the Phala Confidential AI API (hosted models on GPU TEE) via the
  OpenAI-compatible interface at api.redpill.ai/v1. Use when users want
  to call DeepSeek, Qwen, Llama, GPT-OSS, Gemma, etc. without deploying
  their own server — pay per token, no infrastructure.
---

# Phala Confidential AI API

OpenAI-compatible inference on confidential GPUs at `https://api.redpill.ai/v1`.

## Operations

| User says | Operation |
|---|---|
| "call confidential AI", "use phala model", "OpenAI compatible" | **First Call** |
| "get an API key", "how to authenticate" | **Get API Key** |
| "Python SDK", "TypeScript SDK" | **SDKs** |
| "stream tokens", "SSE" | **Streaming** |
| "tool calling", "function calling" | **Tool Calling** |
| "vision", "image input" | **Images & Vision** |
| "structured output", "JSON mode" | **Structured Output** |
| "verify the response", "signed receipt" | **Verify Signature** |
| "list models", "available models" | **Model Catalog** |

---

## Get API Key

1. Go to [cloud.phala.com](https://cloud.phala.com) and add at least $5 in credits (Dashboard → Deposit).
2. Open **Dashboard → Confidential AI API** and click **Enable**.
3. Click **Create Key**, give it a name, and copy the value (starts with `sk-`).

Store the key in your environment:

```bash
export CONFIDENTIAL_AI_KEY="sk-..."
```

---

## First Call

### cURL

```bash
curl https://api.redpill.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONFIDENTIAL_AI_KEY" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [
      { "role": "user", "content": "Hello world!" }
    ]
  }'
```

That's the canonical "hello world." Replace the model and message and you're done.

---

## Model Catalog

Models are namespaced by provider. All run inside GPU TEE.

### Phala provider (lowest cost)

| Model | Model ID | Context | $/1M (in/out) |
|---|---|---|---|
| DeepSeek V3 0324 | `deepseek/deepseek-chat-v3-0324` | 163K | 0.28 / 1.14 |
| Qwen 2.5 VL 72B | `qwen/qwen2.5-vl-72b-instruct` | 65K | 0.59 / 0.59 |
| Gemma 3 27B | `google/gemma-3-27b-it` | 53K | 0.11 / 0.40 |
| GPT-OSS 120B | `openai/gpt-oss-120b` | 131K | 0.10 / 0.49 |
| GPT-OSS 20B | `openai/gpt-oss-20b` | 131K | 0.04 / 0.15 |
| Qwen 2.5 7B | `qwen/qwen-2.5-7b-instruct` | 32K | 0.04 / 0.10 |

### Other providers

| Model | Model ID | Context |
|---|---|---|
| DeepSeek V3.1 (NearAI) | `deepseek/deepseek-chat-v3.1` | 163K |
| Qwen3 30B (NearAI) | `qwen/qwen3-30b-a3b-instruct-2507` | 262K |
| Z.AI GLM 4.6 (NearAI) | `z-ai/glm-4.6` | 202K |
| Phi-4 (Tinfoil) | check live catalog | — |

The full live catalog: <https://redpill.ai/models> — filter by **GPU TEE** to see only confidential variants.

---

## SDKs

The endpoint is OpenAI-compatible. Any OpenAI SDK works — just change the base URL.

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["CONFIDENTIAL_AI_KEY"],
    base_url="https://api.redpill.ai/v1",
)

response = client.chat.completions.create(
    model="phala/deepseek-chat-v3-0324",
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

const client = new OpenAI({
  baseURL: "https://api.redpill.ai/v1",
  apiKey: process.env.CONFIDENTIAL_AI_KEY,
})

const completion = await client.chat.completions.create({
  model: "phala/deepseek-chat-v3-0324",
  messages: [{ role: "user", content: "What is your model name?" }],
})

console.log(completion.choices[0].message)
```

### LangChain

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="phala/deepseek-chat-v3-0324",
    base_url="https://api.redpill.ai/v1",
    api_key=os.environ["CONFIDENTIAL_AI_KEY"],
)
```

---

## Streaming

```python
stream = client.chat.completions.create(
    model="phala/qwen-2.5-7b-instruct",
    messages=[{"role": "user", "content": "Write a haiku about TEEs"}],
    stream=True,
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="", flush=True)
```

cURL with SSE:

```bash
curl https://api.redpill.ai/v1/chat/completions \
  -H "Authorization: Bearer $CONFIDENTIAL_AI_KEY" \
  -H "Content-Type: application/json" \
  -N \
  -d '{
    "model": "phala/qwen-2.5-7b-instruct",
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
    model="phala/deepseek-chat-v3-0324",
    messages=[{"role": "user", "content": "Weather in Tokyo?"}],
    tools=tools,
)
print(response.choices[0].message.tool_calls)
```

Models that support tool calling: most Phala-provider models. Check the catalog page for capability flags.

---

## Images & Vision

For VLM models like `qwen/qwen2.5-vl-72b-instruct`:

```python
response = client.chat.completions.create(
    model="qwen/qwen2.5-vl-72b-instruct",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "What's in this image?"},
            {"type": "image_url", "image_url": {"url": "https://example.com/img.jpg"}},
        ],
    }],
)
```

---

## Structured Output

JSON mode + JSON Schema:

```python
response = client.chat.completions.create(
    model="phala/deepseek-chat-v3-0324",
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

Every Confidential AI API response can be cryptographically verified — the response chains to the GPU TEE quote.

### Per-request attestation report

Fetch a fresh attestation tied to a nonce:

```bash
NONCE=$(openssl rand -hex 32)
curl -s "https://api.redpill.ai/v1/attestation/report?model=phala/deepseek-chat-v3-0324&nonce=$NONCE" \
  -H "Authorization: Bearer $CONFIDENTIAL_AI_KEY" > report.json
```

The response has `nvidia_payload`, `intel_quote`, `signing_address`, and `signing_algo`.

### Response headers (per-request)

| Header | Meaning |
|---|---|
| `x-phala-receipt-sig` | Signature over `(model_id, prompt_hash, response_hash, timestamp)` |
| `x-phala-compose-hash` | Compose-hash of the model-serving CVM |
| `x-phala-app-id` | Per-app key identity |

### Full verification flow

For the complete end-to-end verification — verify NVIDIA GPU via NRAS, verify Intel TDX, check report-data binds the signing key + nonce, verify the compose manifest, check Sigstore provenance, and verify the response signature — follow `verify-attestation.md`.

Reference implementation: [`Phala-Network/private-ml-sdk/vllm-proxy/verifiers/attestation_verifier.py`](https://github.com/Phala-Network/private-ml-sdk/blob/main/vllm-proxy/verifiers/attestation_verifier.py).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| 401 Unauthorized | Bad / expired key | Generate a new key in Dashboard → Confidential AI API |
| 402 Payment Required | Out of credits | Add funds in Dashboard → Deposit |
| 404 Not Found | Wrong model ID | Use lowercase, e.g. `phala/deepseek-chat-v3-0324` not `Phala/DeepSeek-V3` |
| 429 Rate Limited | Workspace quota | Wait or contact Phala for quota increase |
| Response cuts off | Hit `max_tokens` | Increase `max_tokens` in request |
| Slow first token | Cold start on smaller models | Use a Dedicated Model deployment for predictable latency |

---

## Reference: minimal end-to-end

```bash
# 1. Get API key from cloud.phala.com (one-time)
export CONFIDENTIAL_AI_KEY="sk-..."

# 2. Call
curl https://api.redpill.ai/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONFIDENTIAL_AI_KEY" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [{"role":"user","content":"Hello world!"}]
  }'
```

For self-hosted alternative (dedicated GPU + your own model weights), see `gpu-vllm-deploy.md`.
