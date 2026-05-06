---
name: gpu-tee-custom
description: |
  Deploy any custom workload to a Phala Cloud GPU TEE — Jupyter notebooks,
  custom training scripts, computer vision pipelines, scientific compute.
  Generic recipe for getting a Docker image running on H200 with TDX +
  NVIDIA CC attestation. For LLM serving see gpu-vllm-deploy. For
  fine-tuning see training-run.
---

# Custom Workload on Phala GPU TEE

`phala deploy` any Docker image onto an H200 GPU with full TDX + NVIDIA CC attestation.

## Operations

| User says | Operation |
|---|---|
| "deploy my notebook", "Jupyter", "research env" | **Jupyter Notebook** |
| "run inference", "computer vision pipeline", "custom workload" | **First Deploy** |
| "list GPUs", "what instances", "pricing" | **Instance Types** |
| "scale to 8 GPU" | **Multi-GPU** |
| "verify GPU CC", "is the GPU sealed" | **Verify GPU CC** |
| "SSH into GPU" | **SSH** |
| "GPU support for H100", "B300" | **Availability** |

This skill builds on the foundational `../phala-cli/SKILL.md`. Install + login per that skill first.

---

## Instance Types

Run live:

```bash
phala instance-types
```

Current GPU types (as of writing):

| ID | GPUs | vCPU | RAM | Hourly |
|---|---|---|---|---|
| `h200.small` | 1× H200 SXM 141GB | 24 | 192 GB | $3.50 |
| `h200.16xlarge` | 8× H200 SXM 141GB | 64 | 256 GB | $23.04 |
| `h200.8x.large` | 8× H200 SXM 141GB | 192 | 1.5 TB | $23.04 |

Pick `h200.small` for single-GPU workloads (most fine-tuning, single-tenant inference). Pick the 8× variants for multi-GPU training, large-model inference, or heavy CPU/RAM needs.

### Availability

The CLI lists what's actually deployable in your workspace. **H100 and B300 SKUs may appear on the marketing site but not the CLI** depending on current capacity. Run `phala instance-types` for ground truth. For other regions / hardware, contact Phala sales.

---

## Jupyter Notebook

The fastest path to "I can run code in a GPU TEE."

### Step 1: `docker-compose.yml`

```yaml
services:
  jupyter:
    image: quay.io/jupyter/scipy-notebook:cuda-latest
    restart: unless-stopped
    environment:
      - JUPYTER_TOKEN=${JUPYTER_TOKEN}
    ports:
      - "8888:8888"
    volumes:
      - work:/home/jovyan/work
      - /var/run/dstack.sock:/var/run/dstack.sock
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
volumes:
  work:
```

### Step 2: `.env`

```
JUPYTER_TOKEN=pick-a-strong-token
```

### Step 3: Deploy

```bash
phala deploy -n my-jupyter -c docker-compose.yml -e .env -t h200.small --kms phala --wait
```

### Step 4: Open the notebook

```bash
# URL shape: https://<app_id>-<port>.<gateway_base_domain>
# Get it live from the CVM:
phala cvms get my-jupyter --json | jq -r '.endpoints[] | select(.app | contains("-8888.")) | .app'
# Open the URL in your browser, paste your JUPYTER_TOKEN to log in.
```

---

## First Deploy (Generic)

For any custom Docker image:

### Step 1: Compose template

```yaml
services:
  workload:
    image: <your-org>/<your-image>:<tag>     # publicly pullable
    restart: unless-stopped
    environment:
      - YOUR_VAR=${YOUR_VAR}
    volumes:
      - data:/data
      - /var/run/dstack.sock:/var/run/dstack.sock
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
volumes:
  data:
```

### Step 2: Build + push your image

```bash
docker build -t ghcr.io/<your-org>/<your-image>:v1 .
docker push ghcr.io/<your-org>/<your-image>:v1
```

For private registries, set `DSTACK_DOCKER_USERNAME` and `DSTACK_DOCKER_PASSWORD` in your `.env`.

### Step 3: Deploy

```bash
phala deploy -n my-workload -c docker-compose.yml -e .env -t h200.small --kms phala --wait
```

### Step 4: Verify

```bash
phala ps                  # is your container running?
phala logs -f             # output
phala cvms attestation    # TDX + GPU NV-CSE quote
```

---

## Multi-GPU

Tensor-parallel or data-parallel across 8× H200:

### Compose changes

```yaml
services:
  workload:
    # ... same as above ...
    command: >
      torchrun
      --nproc_per_node=8
      train.py
```

### Deploy

```bash
phala deploy -n my-workload -c docker-compose.yml -e .env -t h200.16xlarge --kms phala --wait
```

`h200.16xlarge` and `h200.8x.large` both give 8× H200; pick `8x.large` for larger host CPU/RAM (192 vCPU, 1.5 TB RAM).

---

## Verify GPU CC

NVIDIA Confidential Computing seals the GPU memory. Confirm it's active:

### Inside the CVM

```bash
phala ssh
nvidia-smi conf-compute -q
# Look for: ConfComputeMode : ON
```

### From the attestation

```bash
phala cvms attestation my-workload --json | jq '.app_certificates[0].quote'
```

The hex `quote` decodes into a combined TDX + GPU NV-CSE attestation. For the full verification flow (Intel TDX + NVIDIA NRAS + report-data binding + compose-hash), follow `verify-attestation.md`. Offline-only path: `dcap-qvl` for the TDX layer + `nvattest-verifier` for the NVIDIA layer.

For a full reference on parsing the combined TDX+NVIDIA quote, see `https://docs.phala.com/phala-cloud/confidential-ai/verify/verify-attestation`.

---

## SSH

Useful for debugging GPU-specific issues.

```bash
phala ssh
# inside the CVM:
nvidia-smi                         # check GPU state
nvidia-smi conf-compute -q         # check CC mode
docker ps                          # what's running
docker logs <container>            # container logs
```

Run a single command without an interactive shell:

```bash
phala ssh -- nvidia-smi
phala ssh -- docker stats --no-stream
```

Port-forward a custom port back to your laptop:

```bash
phala ssh -- -L 8088:localhost:8088
```

---

## Common Docker images

| Use case | Image | Notes |
|---|---|---|
| Jupyter + PyTorch | `quay.io/jupyter/scipy-notebook:cuda-latest` | Pre-installed CUDA, scipy, sklearn |
| PyTorch dev | `nvcr.io/nvidia/pytorch:24.10-py3` | NVIDIA's official, CUDA 12.x |
| TensorFlow | `tensorflow/tensorflow:latest-gpu` | TF 2.x with GPU support |
| Ollama | `ollama/ollama:latest` | Local LLM serving (alternative to vLLM) |
| ComfyUI / Stable Diffusion | `yanwk/comfyui-boot:latest` | SD pipeline |
| Whisper / TTS | `onerahmet/openai-whisper-asr-webservice` | ASR endpoints |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Container reports `no CUDA device` | GPU passthrough missing | Add the `deploy.resources.reservations.devices` block to compose |
| OOM during model load | Model too big for 1 H200 (141 GB VRAM) | Move to `h200.16xlarge` (8× 141 = 1.1 TB total) |
| Jupyter login loop | Wrong token | `phala logs` to find the auto-generated token, or set `JUPYTER_TOKEN` env explicitly |
| `manifest unknown` on deploy | Image not public | Push to public registry OR add `DSTACK_DOCKER_USERNAME/PASSWORD` to env |
| Slow `apt-get` / `pip` | dstack-gateway egress | Pre-bake all dependencies into the Docker image |
| `nvidia-smi conf-compute -q` says OFF | Host config | Open a Phala support ticket |

---

## Reference: minimal end-to-end

```bash
# 1. Scaffold + build
docker build -t ghcr.io/me/my-workload:v1 ./workload
docker push ghcr.io/me/my-workload:v1

# 2. Deploy on 1× H200
phala login
phala deploy -n my-workload -c docker-compose.yml -t h200.small --kms phala --wait

# 3. Verify + use
phala cvms attestation --json | jq
phala ssh -- nvidia-smi conf-compute -q
phala cvms get my-workload --json | jq '.endpoints'
```
