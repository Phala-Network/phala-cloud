# deepspeedai/DeepSpeed on Phala Cloud

Deploy a CPU-safe DeepSpeed source/runtime verifier on Phala Cloud.

## Overview

[DeepSpeed](https://github.com/deepspeedai/DeepSpeed) is a GPU-oriented distributed training and inference optimization framework from the DeepSpeed team. Full DeepSpeed workloads normally involve PyTorch, accelerator-specific kernels, distributed launchers, CUDA/ROCm or other accelerator backends, model checkpoints, and training or inference jobs that must be sized for the selected hardware.

This prebuilt template intentionally does not run a full DeepSpeed training or inference server. The default deployment is a minimal HTTP verifier that is safe for a CPU-only Phala Cloud `tdx.small`-style deployment. It downloads selected public DeepSpeed source and documentation files from a pinned upstream Git ref, verifies markers for core concepts, and `py_compile` checks selected Python source files without importing `deepspeed` or `torch`.

The demo does not download model weights, run distributed training, start inference, require CUDA/GPU access, require provider credentials, require Hugging Face tokens, mount host paths, or use privileged container features.

## Metadata

- Template id: `deepspeed`
- Display name: `deepspeedai/DeepSpeed`
- Upstream repository: https://github.com/deepspeedai/DeepSpeed
- Upstream documentation: https://www.deepspeed.ai/
- Default source ref: `v0.19.1`
- Icon source: upstream DeepSpeed README logo at `docs/assets/images/DeepSpeed_light.svg`
- Upstream author: DeepSpeed Team, via the `deepspeedai/DeepSpeed` GitHub repository
- Phala prebuilt source: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/deepspeed

## What This Template Runs

The compose file starts one public HTTP service:

- `app`: A `python:3.12-slim-bookworm` container that runs an inline Python HTTP server on port `8080`.

On startup, the verifier fetches these upstream files from `deepspeedai/DeepSpeed` at `DEEPSPEED_SOURCE_REF`:

- `README.md`
- `deepspeed/launcher/runner.py`
- `deepspeed/runtime/engine.py`
- `deepspeed/runtime/config.py`
- `deepspeed/inference/engine.py`
- `docs/_pages/config-json.md`
- `docs/_pages/inference.md`

The verifier checks for launcher, runtime engine, inference engine, and JSON config documentation markers, then compiles the selected Python source files with `py_compile`. It never imports DeepSpeed at module import time or request time, which avoids Torch/CUDA initialization and extension compilation on small CPU-only CVMs.

## Deploy

1. Deploy the `deepspeed` prebuilt template on Phala Cloud.
2. Keep the default CPU-only resource profile for the source verifier.
3. Optionally set `DEEPSPEED_SOURCE_REF` to another public DeepSpeed tag, branch, or commit.
4. Open the generated public endpoint for port `8080`.
5. Visit `https://<your-app-domain>/healthz`.

The first startup fetches a small set of public source files from GitHub. No private repositories, model registries, paid provider APIs, GPU devices, host bind mounts, Docker socket access, host networking, external build contexts, `env_file`, or privileged mode are required.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DEEPSPEED_SOURCE_REF` | No | `v0.19.1` | Public DeepSpeed Git tag, branch, or commit used for source checks. |

If you adapt this template to run real DeepSpeed training or inference, add only the variables required by your selected model, dataset, storage backend, or provider. For gated Hugging Face models, use a required secret or environment variable such as `HF_TOKEN`; do not hardcode real tokens in `docker-compose.yml` or this README.

## Usage Endpoints

The public endpoint exposes JSON on port `8080`:

- `GET /healthz`: Readiness and verifier status. It returns HTTP `200` with `"ok": true` once the source check passes, and includes errors if a ref or marker check fails.
- `GET /demo`: Detailed verifier output, including fetched files, SHA-256 hashes, marker checks, compile checks, and flags confirming that no model, GPU, training, or provider credentials are used.
- `GET /v1/models`: OpenAI-compatible model-list shape with an empty `data` array because this template does not run an inference server.
- `GET /`: Same basic payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields after the source check completes include:

```json
{
  "ok": true,
  "source_check": {
    "cpu_only": true,
    "deepspeed_imported": false,
    "torch_imported": false,
    "cuda_required": false,
    "distributed_training_started": false,
    "model_downloaded": false,
    "provider_credentials_required": false
  }
}
```

The `/v1/models` response intentionally has an empty `data` list:

```json
{
  "object": "list",
  "data": [],
  "demo": {
    "message": "No DeepSpeed model server is running in this CPU-safe source verifier."
  }
}
```

## Verification/Smoke Test

Run from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/deepspeed/docker-compose.yml config >/dev/null
```

Optional local runtime check from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/deepspeed/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/deepspeed/docker-compose.yml down
```

A healthy verifier returns `"ok": true` after it downloads the selected files, verifies the expected DeepSpeed markers, and compiles the selected Python files.

## Resource Notes

The default resource profile is intentionally conservative for a Phala Cloud `tdx.small`-style CPU deployment:

- 1 vCPU
- 2 GiB memory
- 10 GiB disk

The default container downloads only selected source files into `/tmp` and does not create named volumes. A real DeepSpeed deployment can require substantially more CPU, memory, disk, network bandwidth, GPUs or other accelerators, PyTorch/CUDA-compatible images, distributed job coordination, model checkpoints, and dataset or object-storage access.

## Production Extension Notes

- Replace the verifier with a purpose-built DeepSpeed training, inference, or launcher command only after choosing the model, dataset, checkpoint format, and hardware target.
- Pin DeepSpeed, PyTorch, CUDA/ROCm, base image, and model versions for reproducibility.
- Review upstream DeepSpeed installation guidance before enabling ops or JIT extension compilation.
- Use Phala Cloud secrets or required environment variables for credentials such as `HF_TOKEN`, object storage keys, or provider API keys. Keep placeholder names in examples and never commit real values.
- Add authentication before exposing real training controls, model inference, logs, or private metadata.
- Keep host bind mounts, Docker socket mounts, host networking, and privileged mode out of production templates unless there is a reviewed operational reason.

## Security Notes

- The default HTTP verifier is unauthenticated and returns source metadata only.
- The compose file uses a public image and inline Compose configs only.
- The compose file does not use host bind mounts, `env_file`, real secrets, privileged mode, host networking, external build contexts, Docker socket access, or GPU device requests.
- `/v1/models` is a compatibility stub, not proof that a model server is running.

## Upstream Attribution

DeepSpeed is developed by the DeepSpeed Team in the `deepspeedai/DeepSpeed` repository: https://github.com/deepspeedai/DeepSpeed.

This Phala Cloud prebuilt template preserves upstream attribution in the template metadata and README while routing deployable assets through the Phala prebuilt template path: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/deepspeed.

The icon saved as `deepspeed.svg` is the upstream DeepSpeed README logo from `docs/assets/images/DeepSpeed_light.svg` in the `deepspeedai/DeepSpeed` repository.
