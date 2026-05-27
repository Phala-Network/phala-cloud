# huggingface/peft on Phala Cloud

This template runs a CPU-safe Hugging Face PEFT package verifier behind a public Caddy proxy. The app installs the real `peft` Python package, imports it, verifies safe PEFT symbols and a tiny LoRA configuration, then exposes JSON endpoints for deployment smoke tests.

The default demo does not run fine-tuning, does not download models, does not load model weights, does not require a GPU, does not use CUDA, does not call Hugging Face Hub model APIs, and does not require provider credentials. It is intentionally scoped for deterministic startup on a small CPU-only Phala CVM such as `tdx.small`.

## Metadata

- Template id: `peft`
- Category: LLM Fine-Tuning & Training
- Upstream repo: `https://github.com/huggingface/peft`
- Upstream author: Hugging Face / `huggingface`
- Package: `peft==0.19.1`
- CPU torch wheel: `torch==2.7.1+cpu` from the official PyTorch CPU wheel index
- Python runtime: `python:3.12` from the `ghcr.io/astral-sh/uv:python3.12-bookworm-slim` image
- Icon source: no dedicated PEFT logo, icon, or favicon was present in the upstream `huggingface/peft` README or repository tree when inspected at `main` commit `9725057592d06e46a45d9439c5fbaed59e7a8404`; `peft.png` uses the Hugging Face GitHub organization avatar from `https://avatars.githubusercontent.com/u/25720743?v=4`

## What Runs By Default

- `app`: an internal Python HTTP service on `APP_PORT=8000`. On startup it installs an explicit CPU-only PyTorch wheel, installs `peft`, imports the package, checks `LoraConfig`, `PeftConfig`, `TaskType`, and `get_peft_model`, and instantiates a tiny local `LoraConfig`.
- `proxy`: a public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

The verifier never calls `get_peft_model` with a model, never starts a training loop, never downloads from model repositories, and never requests GPU devices. `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1` are set for the running app so accidental model lookup paths stay disabled after package installation.

## Deploy

From this template directory:

```bash
docker compose config
docker compose up -d
```

On Phala Cloud, deploy the prebuilt `peft` template and open the public endpoint on port `8080`.

The first start can take a few minutes because the app installs the pinned CPU PyTorch wheel plus the pinned PEFT package and dependencies inside the container. Restarts are lighter if the container filesystem is retained, but this template does not require a persistent volume.

## Environment Variables

The default template requires no credentials.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `PEFT_PACKAGE_VERSION` | `0.19.1` | No | Pinned Hugging Face PEFT package version installed at container startup. Override only when testing another compatible release. |
| `TORCH_CPU_VERSION` | `2.7.1+cpu` | No | CPU-only PyTorch wheel version installed from `https://download.pytorch.org/whl/cpu` before installing PEFT. Keep the `+cpu` suffix to avoid CUDA wheels. |
| `APP_PORT` | `8000` | No | Internal app port. Caddy proxies to this port; the host only exposes `8080:80`. |
| `HF_HUB_DISABLE_TELEMETRY` | `1` | No | Disables Hugging Face Hub telemetry in the demo runtime. |
| `HF_HUB_OFFLINE` | `1` | No | Keeps the running verifier offline with respect to Hugging Face Hub model lookups. Package installation still uses public package indexes at startup. |
| `TRANSFORMERS_OFFLINE` | `1` | No | Keeps Transformers offline after installation so imports cannot trigger model lookups. |
| `TRANSFORMERS_NO_ADVISORY_WARNINGS` | `1` | No | Reduces advisory warning noise in the smoke-test service. |

Provider or model credentials such as `HF_TOKEN`, `HUGGING_FACE_HUB_TOKEN`, `WANDB_API_KEY`, `OPENAI_API_KEY`, or other training/inference credentials are intentionally not required and are not consumed by the default demo. Add secrets only if you replace this verifier with a real fine-tuning workload.

## Exposed Endpoints

The public HTTP API is available through Caddy on port `8080`.

- `GET /healthz`: returns HTTP 200 only when the real `peft` package import and symbol/config checks pass. Returns HTTP 503 with the import error if startup checks failed.
- `GET /demo`: returns PEFT package metadata, checked symbols, the tiny local LoRA config, and explicit booleans showing that no fine-tuning, model download, GPU/CUDA path, provider call, or credential requirement is active.
- `GET /v1/models`: returns an OpenAI-shaped model list with a `peft/no-model-download-demo` placeholder. It is metadata only; the default template does not host, download, train, or load a model.
- `GET /`: returns service metadata and endpoint links.

## Verification

Run these smoke checks after deployment:

```bash
docker compose ps
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo | jq '.peft.import_ok, .runtime.model_downloads, .runtime.gpu_or_cuda_required'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `.peft.import_ok` is `true`.
- `.runtime.model_downloads` is `false`.
- `.runtime.gpu_or_cuda_required` is `false`.
- `/v1/models` includes `peft/no-model-download-demo`.

Template validation commands from the monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/peft/docker-compose.yml config >/dev/null
```

## Production Caveats

PEFT is a library for parameter-efficient fine-tuning methods such as LoRA. Real fine-tuning is outside the default template and can require model weight downloads, datasets, accelerator memory, GPU scheduling, CUDA-compatible wheels, persistent storage, experiment tracking credentials, and Hugging Face credentials for private or gated repositories.

Before adapting this template for real training:

- Pick model, dataset, adapter method, precision, and batch size based on the actual CVM resources.
- Review the model and dataset licenses before downloading or training.
- Use Phala Cloud secrets or required environment variables for credentials; do not hardcode tokens in `docker-compose.yml` or this README.
- Add persistent volumes only when needed for model/cache/checkpoint storage.
- Replace the verifier with an explicit training or serving command and document the GPU/CUDA/resource requirements.
- Add authentication before exposing endpoints that reveal training state, model metadata, logs, or private artifacts.

## Security Notes

- Only Caddy publishes a host port: `8080:80`.
- The app service is internal and uses `expose`, not `ports`.
- The template does not use privileged mode, host networking, host IPC, host PID, Docker socket mounts, host bind mounts, external build contexts, or external credentials.
- No API keys, tokens, passwords, or private repository credentials are baked into the compose file.

## Cleanup

```bash
docker compose down
```

No named volumes are created by this template.
