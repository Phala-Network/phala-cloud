# hiyouga/LlamaFactory on Phala Cloud

## Overview

This template deploys a CPU-safe Phala Cloud smoke-test service for [hiyouga/LlamaFactory](https://github.com/hiyouga/LlamaFactory), the upstream project also published as `hiyouga/LLaMA-Factory`.

LlamaFactory is a unified framework for LLM fine-tuning, inference, and model export workflows. It supports CLI commands, LLaMA Board Web UI, OpenAI-style API serving, many model families, LoRA and QLoRA-style training flows, and experiment tracking integrations.

The full upstream runtime normally requires selected model weights, datasets, large disk and memory, and often GPU, NPU, or ROCm resources. Gated/private Hugging Face models or external logging services may also require credentials. The official upstream Docker path is CUDA-oriented and documents `--gpus=all` plus host IPC for its GPU image, which is not appropriate as a default `tdx.small` Phala Cloud smoke test.

To keep the default deployment honest and small, this template does not start training, inference, LLaMA Board, model downloads, or provider calls. It starts a small Python HTTP verifier that downloads selected release-tagged upstream source files from GitHub, compiles key Python modules, verifies CLI/Web UI/API/Docker/runtime source markers, and exposes JSON endpoints for smoke testing.

## Metadata

- Template id: `llamafactory`
- Display name: `hiyouga/LlamaFactory`
- Category: LLM Fine-Tuning & Training
- Deployable template repository URL: `https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/llamafactory`
- Upstream repository: `https://github.com/hiyouga/LlamaFactory`
- Upstream project canonical/legacy path: `https://github.com/hiyouga/LLaMA-Factory`
- Python package: `https://pypi.org/project/llamafactory/`
- Default upstream source ref: `v0.9.4`
- Icon: `llamafactory.png`

## Deploy on Phala Cloud

1. Create a new Phala Cloud deployment from the `llamafactory` prebuilt template.
2. Keep the default CPU-only resources for the verifier smoke test.
3. Optionally set `LLAMAFACTORY_REF` to another public LlamaFactory tag, commit, or simple branch ref.
4. Deploy the CVM and open the generated public endpoint for port `8080`.
5. Visit `https://<your-app-domain>/healthz` after startup.

The default container uses the public `python:3.12-slim-bookworm` image and fetches a small set of upstream source files at runtime. It does not use host bind mounts, `env_file`, host networking, host IPC, privileged mode, Docker socket access, GPU device reservations, or an external build context.

## Environment Variables

No credentials are required for the default verifier.

- `LLAMAFACTORY_REF`: Optional LlamaFactory Git tag, commit, or simple branch ref used for source checks. Default: `v0.9.4`.

When adapting this template into a real LlamaFactory training or inference deployment, add only the variables your selected workflow actually requires. Common production variables include:

- `HF_TOKEN`: Optional Hugging Face token for gated/private models or datasets.
- `HUGGINGFACE_HUB_TOKEN`: Optional alternative Hugging Face token name used by some tools.
- `WANDB_API_KEY`: Optional Weights & Biases API key when `report_to: wandb` is enabled in a training config.
- `SWANLAB_API_KEY`: Optional SwanLab API key when SwanLab tracking is enabled.
- `API_KEY`: Optional LlamaFactory OpenAI-style API bearer token when running `llamafactory-cli api`.
- `MODEL_NAME_OR_PATH`: Optional model identifier or local model path for your adapted training or inference command.
- `DATASET`: Optional dataset identifier or dataset configuration name for your adapted training command.

Use Phala Cloud environment variables or secret handling for real credentials. Do not place real tokens, private keys, OTPs, or API keys in `docker-compose.yml` or this README.

## Usage and Endpoints

The public endpoint exposes a small JSON API on port `8080`:

- `GET /healthz`: Readiness payload. Returns HTTP `200` when the release-tagged source check passes.
- `GET /demo`: Detailed verifier result, including downloaded source files, Python compile checks, package metadata checks, CLI/Web UI/API markers, and official Docker runtime notes.
- `GET /v1/models`: OpenAI-compatible model-list shape with an empty `data` array because no model server is running.
- `GET /`: Same payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "credentials_required": false,
  "model_downloaded": false,
  "model_loaded": false,
  "training_started": false,
  "inference_started": false,
  "web_ui_started": false,
  "provider_calls": false
}
```

## Verification and Smoke Commands

Run from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/llamafactory/docker-compose.yml config >/dev/null
python3 templates/validate.py
git diff --check origin/main...HEAD
```

Run from inside the `sdks` submodule:

```bash
docker compose -f templates/prebuilt/llamafactory/docker-compose.yml config >/dev/null
python3 templates/validate.py
git diff --check origin/main...HEAD
```

Optional local runtime smoke test from the `sdks` submodule:

```bash
docker compose -f templates/prebuilt/llamafactory/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/llamafactory/docker-compose.yml down
```

## Resource and Production Caveats

The default verifier is intended for a small CPU-only confidential VM:

- 1 vCPU
- 2 GiB memory
- 10 GiB disk

Real LlamaFactory training and serving are different workloads. Review the selected model license, parameter count, quantization method, dataset size, checkpoint/output size, memory requirements, disk requirements, GPU/NPU/ROCm availability, CUDA or accelerator runtime, and expected startup time before replacing the verifier with a full command.

Typical upstream commands after adapting the template include:

```bash
llamafactory-cli webui
llamafactory-cli train examples/train_lora/qwen3_lora_sft.yaml
API_PORT=8000 llamafactory-cli api examples/inference/qwen3.yaml infer_backend=vllm vllm_enforce_eager=true
```

These commands are examples only. They can download model weights or datasets, load models into memory, and require accelerator resources or credentials depending on the selected configuration.

## Security Notes

- The default verifier exposes unauthenticated metadata endpoints. Add authentication before exposing real training controls, model inference, datasets, checkpoints, or private metadata.
- Do not hardcode secrets in this template. Use Phala Cloud environment variables or secret handling for `HF_TOKEN`, `WANDB_API_KEY`, `SWANLAB_API_KEY`, API bearer tokens, or provider credentials.
- Pin `LLAMAFACTORY_REF` to a release tag or commit for reproducible source verification.
- Avoid host bind mounts, Docker socket mounts, host networking, host IPC, privileged mode, and external build contexts unless you have reviewed the risk and Phala Cloud support for the specific production deployment.
- Validate model and dataset licenses before deployment.

## Upstream Attribution and Icon Source

- Upstream repository: [hiyouga/LlamaFactory](https://github.com/hiyouga/LlamaFactory), redirected/canonicalized by GitHub from [hiyouga/LLaMA-Factory](https://github.com/hiyouga/LLaMA-Factory).
- Upstream README and documentation: [README](https://github.com/hiyouga/LlamaFactory/blob/main/README.md) and [LlamaFactory docs](https://llamafactory.readthedocs.io).
- Upstream Docker docs: [docker/docker-cuda/README.md](https://github.com/hiyouga/LlamaFactory/blob/main/docker/docker-cuda/README.md) and [docker/docker-cuda/docker-compose.yml](https://github.com/hiyouga/LlamaFactory/blob/main/docker/docker-cuda/docker-compose.yml).
- Icon source: `llamafactory.png` is copied from the upstream README logo at `https://github.com/hiyouga/LlamaFactory/blob/main/assets/logo.png`.
