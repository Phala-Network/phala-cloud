---
name: gpu-vllm-deploy
description: |
  Deploy vLLM (or any OpenAI-compatible LLM server) onto a Phala Cloud
  GPU TEE — Llama, Qwen, DeepSeek, Mistral, etc. Use when users want
  self-hosted private inference on H200 with verifiable attestation
  and an OpenAI-compatible endpoint at /v1/chat/completions.
---

# Self-Hosted vLLM on Phala GPU TEE

`phala deploy` an OpenAI-compatible inference server inside a confidential H200 GPU.

## Operations

| User says | Operation |
|---|---|
| "deploy vLLM", "run my own LLM", "self-host inference" | **First Deploy** |
| "load Llama", "load Qwen", "switch model" | **Choose Model** |
| "scale to 8 GPU", "tensor parallel" | **Multi-GPU** |
| "verify GPU TEE", "is the GPU in CC mode" | **Verify GPU CC** |
| "private model weights", "seal weights" | **Seal Weights** |
| "OpenAI client can't connect" | **Endpoint** |

This skill builds on the foundational `../phala-cli/SKILL.md`. Install + login per that skill first.

---

## Choose Model

vLLM supports any HuggingFace model. Common choices for confidential workloads:

| Model | HF ID | VRAM | Fits on |
|---|---|---|---|
| Llama 3.1 8B Instruct | `meta-llama/Llama-3.1-8B-Instruct` | 16 GB | `h200.small` |
| Llama 3.1 70B Instruct | `meta-llama/Llama-3.1-70B-Instruct` | 140 GB | `h200.small` (FP8) or `h200.16xlarge` (FP16) |
| Qwen 2.5 7B Instruct | `Qwen/Qwen2.5-7B-Instruct` | 16 GB | `h200.small` |
| DeepSeek V3 0324 | `deepseek-ai/DeepSeek-V3-0324` | ~600 GB | `h200.16xlarge` (8× H200, FP8) |
| GPT-OSS 120B | `openai/gpt-oss-120b` | ~240 GB | `h200.16xlarge` (FP8) |
| Gemma 3 27B | `google/gemma-3-27b-it` | 54 GB | `h200.small` |

Confirm available types:

```bash
phala instance-types
```

---

## Scaffold

### Step 1: Project layout

```bash
mkdir my-llm && cd my-llm
```

```
my-llm/
├── docker-compose.yml
├── .env.example         # HF_TOKEN
└── .env                 # gitignored
```

### Step 2: `docker-compose.yml`

```yaml
services:
  vllm:
    image: vllm/vllm-openai:latest
    restart: unless-stopped
    environment:
      - HF_TOKEN=${HF_TOKEN}
      - VLLM_API_KEY=${VLLM_API_KEY:-sk-local}
    volumes:
      - hf-cache:/root/.cache/huggingface
      - /var/run/dstack.sock:/var/run/dstack.sock
    ports:
      - "8000:8000"
    command: >
      --model meta-llama/Llama-3.1-8B-Instruct
      --dtype auto
      --max-model-len 8192
      --api-key $${VLLM_API_KEY}
volumes:
  hf-cache:
```

Notes:
- `vllm/vllm-openai:latest` exposes `/v1/chat/completions` and `/v1/completions` on port 8000.
- The `HF_TOKEN` env (sealed via `phala deploy -e`) lets vLLM pull gated models from Hugging Face.
- `VLLM_API_KEY` protects the endpoint — anyone hitting it must know the key.
- For GPU CC mode confirmation, see **Verify GPU CC** below.

### Step 3: `.env`

```
HF_TOKEN=hf_real_token_here
VLLM_API_KEY=sk-pick-something-secret
```

---

## First Deploy

### Step 1: Pick GPU shape

| Use case | Instance type | vCPU / RAM | Notes |
|---|---|---|---|
| 7-13B model, single user | `h200.small` (1× H200) | 24 / 192 GB | $3.50/hr |
| 70B FP16, batch | `h200.16xlarge` (8× H200) | 64 / 256 GB | $23/hr — needs `--tensor-parallel-size 8` |
| 70B FP16, GPU-heavy throughput | `h200.8x.large` (8× H200) | 192 / 1.5 TB | $23/hr — same GPUs, more host CPU/RAM |

```bash
phala deploy -n my-llm -c docker-compose.yml -e .env -t h200.small --kms phala --wait
```

### Step 2: Get the endpoint

```bash
phala cvms get my-llm --json | jq '.endpoints'
# Each endpoint has shape: { "app": "https://<app_id>-<port>.<gateway>", "instance": "..." }
```

The URL format is `https://<app_id>-<port>.<gateway_base_domain>` — the
gateway base domain is per-cluster (e.g. `dstack-pha-prod12.phala.network`),
NOT a global `dstack.phala.network`. Always pull it live from the CVM JSON.

### Step 3: Test the endpoint

```bash
ENDPOINT=$(phala cvms get my-llm --json | jq -r '.endpoints[] | select(.app | contains("-8000.")) | .app')
curl $ENDPOINT/v1/chat/completions \
  -H "Authorization: Bearer sk-pick-something-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Llama-3.1-8B-Instruct",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

---

## Multi-GPU

For 70B models or higher throughput, spread across 8× H200.

### Step 1: Update compose

```yaml
services:
  vllm:
    image: vllm/vllm-openai:latest
    # ... env, volumes, ports same as above ...
    command: >
      --model meta-llama/Llama-3.1-70B-Instruct
      --tensor-parallel-size 8
      --dtype auto
      --max-model-len 16384
      --api-key $${VLLM_API_KEY}
```

### Step 2: Deploy on the 8× H200 instance

```bash
phala deploy -n my-llm-70b -c docker-compose.yml -e .env -t h200.16xlarge --kms phala --wait
```

vLLM auto-shards the model across all 8 GPUs.

---

## Verify GPU CC

### From inside the CVM

```bash
phala ssh
nvidia-smi conf-compute -q
# Expect: ConfComputeMode : ON
```

### Full attestation flow

For the complete verification (NVIDIA NRAS + Intel TDX + report-data binding + compose-hash + Sigstore), follow `verify-attestation.md`.

The minimum check:

```bash
phala cvms attestation my-llm --json > attestation.json
# The .app_certificates[0].quote contains the combined TDX + GPU NV-CSE attestation.
# Verify with Phala's online endpoint or dcap-qvl + nvattest-verifier offline.
```

---

## Seal Weights

If your model weights are private and shouldn't be re-pullable on every deploy:

### Option 1: Pre-launch download

```bash
phala deploy ... --pre-launch-script ./download-weights.sh
```

`download-weights.sh` runs inside the CVM after attestation. Use `HF_TOKEN` (sealed env) to pull, write to a persistent volume.

### Option 2: Encrypt-at-rest

Encrypt the weight tarball client-side, ship to S3, decrypt inside the CVM with a key derived from `HKDF(kms_root_pubkey, app_id, compose_hash)`. The decrypt key only re-derives if the compose-hash matches — stolen ciphertext is useless.

See `data-coanalysis.md` for the HKDF pattern.

---

## Endpoint

### Public URL

The shape is `https://<app_id>-<port>.<gateway_base_domain>/v1/chat/completions`.
`<port>` is whatever port your compose exposes (8000 for vLLM by default).
The gateway base domain is per-cluster — pull it from `phala cvms get`:

```bash
phala cvms get my-llm --json | jq -r '.gateway.base_domain'
# e.g. dstack-pha-prod5.phala.network
phala cvms get my-llm --json | jq -r '.app_id'
# e.g. e029a4b8...
# Compose: https://e029a4b8...-8000.dstack-pha-prod5.phala.network
```

### Custom domain

`dstack-gateway` supports custom domain mapping via the dashboard. Add `gateway.alias.example.com` → `<cvm-id>-8000`. The TLS cert continues to carry the TDX quote in an X.509 extension.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| vLLM OOMs on startup | Model too big for 1 GPU | Move to `h200.16xlarge` + `--tensor-parallel-size 8` |
| `HF_TOKEN` invalid | Sealed env not passed | Re-deploy with `-e .env` and confirm token in HF account has read access |
| Endpoint times out | vLLM still loading weights | First boot can take 10-20 min for large models. `phala logs -f` shows progress. |
| `nvidia-smi conf-compute -q` says OFF | GPU not in CC mode | Open a Phala support ticket — host config issue |
| 401 from `/v1/chat/completions` | Wrong API key | Set `Authorization: Bearer $VLLM_API_KEY` |
| Throughput poor on 70B | FP16 on 1 GPU | Switch to FP8 or move to 8× H200 |

---

## Reference: minimal end-to-end

```bash
# 1. Scaffold
mkdir my-llm && cd my-llm
# (write docker-compose.yml + .env with HF_TOKEN)

# 2. Auth + deploy
phala login
phala deploy -n my-llm -c docker-compose.yml -e .env -t h200.small --kms phala --wait

# 3. Verify GPU CC + endpoint
phala cvms attestation --json | jq '.app_certificates[0].quote'
# The hex string decodes into the combined TDX quote. For GPU CC verification,
# use NVIDIA's nvattest-verifier or dstack-verifier on the same blob —
# the GPU quote is bound into the TDX report_data.
phala ssh -- nvidia-smi conf-compute -q
ENDPOINT=$(phala cvms get my-llm --json | jq -r '.endpoints[0]')
curl $ENDPOINT/v1/chat/completions -H "Authorization: Bearer $VLLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"meta-llama/Llama-3.1-8B-Instruct","messages":[{"role":"user","content":"Hello"}]}'
```

The endpoint is OpenAI-compatible. Drop into any OpenAI SDK by setting `base_url=$ENDPOINT/v1`.
