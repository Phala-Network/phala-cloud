# huggingface/diffusers on Phala Cloud

This template runs a CPU-safe Hugging Face Diffusers package verifier behind a public Caddy proxy. The app installs the real `diffusers` Python package, imports it, verifies local `ConfigMixin` and `BaseOutput` primitives, and exposes JSON endpoints for deployment smoke tests.

The default demo does not run image generation, does not create a pipeline, does not download models, does not load model weights, does not install or require PyTorch, does not require a GPU, does not use CUDA, does not call Hugging Face Hub model APIs, and does not require provider credentials. It is intentionally scoped for deterministic startup on a small CPU-only Phala CVM such as `tdx.small`.

## Metadata

- Template id: `diffusers`
- Category: Media & Design, Developer Tools
- Upstream repo: `https://github.com/huggingface/diffusers`
- Upstream author: Hugging Face / `huggingface`
- Package: `diffusers==0.38.0`
- Python runtime: `python:3.12-slim-bookworm`
- Icon source: `https://raw.githubusercontent.com/huggingface/diffusers/main/docs/source/en/imgs/diffusers_library.jpg`

## What Runs By Default

- `app`: an internal Python HTTP service on `APP_PORT=8000`. On startup it installs `diffusers`, imports the package, checks `ConfigMixin` and `BaseOutput`, registers a tiny local scheduler metadata config, and returns a deterministic output fixture.
- `proxy`: a public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

The verifier never calls `DiffusionPipeline.from_pretrained`, never loads weights, never starts image generation, never downloads from model repositories, and never requests GPU devices. `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1` are set for the running app so accidental model lookup paths stay disabled after package installation.

## Deploy

From this template directory:

```bash
docker compose config
docker compose up -d
```

On Phala Cloud, deploy the prebuilt `diffusers` template and open the public endpoint on port `8080`.

The first start can take a few minutes because the app installs the pinned Diffusers package and dependencies inside the container. Restarts are lighter if the container filesystem is retained, but this template does not require a persistent volume.

## Environment Variables

The default template requires no credentials.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `DIFFUSERS_PACKAGE_VERSION` | `0.38.0` | No | Pinned Hugging Face Diffusers package version installed by the demo service at container startup. Override only when testing another compatible release. |
| `APP_PORT` | `8000` | No | Internal app port. Caddy proxies to this port; the host only exposes `8080:80`. |
| `HF_HUB_DISABLE_TELEMETRY` | `1` | No | Disables Hugging Face Hub telemetry in the demo runtime. |
| `HF_HUB_OFFLINE` | `1` | No | Keeps the running verifier offline with respect to Hugging Face Hub model lookups. Package installation still uses public package indexes at startup. |
| `TRANSFORMERS_OFFLINE` | `1` | No | Keeps Transformers offline after installation so imports cannot trigger model lookups if users add Transformers-dependent code later. |
| `DIFFUSERS_VERBOSITY` | `error` | No | Reduces Diffusers log noise in the smoke-test service. |

Provider or model credentials such as `HF_TOKEN`, `HUGGING_FACE_HUB_TOKEN`, `WANDB_API_KEY`, `OPENAI_API_KEY`, or image-generation provider keys are intentionally not required and are not consumed by the default demo. Add secrets only if you replace this verifier with a real training or inference workload.

## Exposed Endpoints

The public HTTP API is available through Caddy on port `8080`.

- `GET /healthz`: returns HTTP 200 only when the real `diffusers` package import and config/output checks pass. Returns HTTP 503 with the import error if startup checks failed.
- `GET /demo`: returns Diffusers package metadata, checked config/output primitives, a tiny local scheduler metadata fixture, and explicit booleans showing that no image generation, model download, GPU/CUDA path, provider call, or credential requirement is active.
- `GET /v1/models`: returns an OpenAI-shaped model list with a `diffusers/no-model-download-demo` placeholder. It is metadata only; the default template does not host, download, generate with, or load a model.
- `GET /`: returns service metadata and endpoint links.

## Verification

Run these smoke checks after deployment:

```bash
docker compose ps
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo | jq '.diffusers.import_ok, .runtime.model_downloads, .runtime.gpu_or_cuda_required'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `.diffusers.import_ok` is `true`.
- `.runtime.model_downloads` is `false`.
- `.runtime.gpu_or_cuda_required` is `false`.
- `/v1/models` includes `diffusers/no-model-download-demo`.

Template validation commands from the monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/diffusers/docker-compose.yml config >/dev/null
```

## Production Caveats

Diffusers is a library for diffusion pipelines, schedulers, training utilities, and inference workflows. Real image generation or training is outside the default template and can require PyTorch, model weight downloads, accelerator memory, GPU scheduling, CUDA-compatible wheels, persistent storage, content moderation decisions, and Hugging Face credentials for private or gated repositories.

Before adapting this template for real generation or training:

- Pick model, scheduler, precision, attention implementation, and batch size based on the actual CVM resources.
- Review the model and dataset licenses before downloading, training, or serving outputs.
- Use Phala Cloud secrets or required environment variables for credentials; do not hardcode tokens in `docker-compose.yml` or this README.
- Add persistent volumes only when needed for model/cache/checkpoint storage.
- Replace the verifier with an explicit pipeline, training, or serving command and document the PyTorch/GPU/CUDA/resource requirements.
- Add authentication, rate limits, and abuse controls before exposing image-generation endpoints or endpoints that reveal private model metadata, logs, prompts, or artifacts.

## Security Notes

- Only Caddy publishes a host port: `8080:80`.
- The app service is internal and uses `expose`, not `ports`.
- The template does not use privileged mode, host networking, host IPC, host PID, Docker socket mounts, host bind mounts, external build contexts, or external credentials.
- No API keys, tokens, passwords, or private repository credentials are baked into the compose file.
- The default endpoints are metadata and smoke-test endpoints only; do not expose real generation, training, file-upload, or model-management endpoints without authentication and input validation.

## Cleanup

```bash
docker compose down
```

No named volumes are created by this template.
