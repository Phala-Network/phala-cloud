# galilai-group/stable-worldmodel on Phala Cloud

This template deploys a CPU-safe `stable-worldmodel` verifier behind a public Caddy proxy. It installs the real upstream Python package, imports the package, verifies local variation-space primitives, runs a tiny deterministic CEM planning solver against an in-memory cost fixture, and exposes JSON endpoints for deployment smoke tests.

The default service does not create Gymnasium environments, collect datasets, inspect private caches, download datasets, download checkpoints, load model weights, train world models, evaluate policies, call hosted model providers, require browser auth, or require credentials. It is scoped for small CPU-only Phala Cloud deployments.

## Metadata

- Template id: `stable-worldmodel`
- Display name: `galilai-group/stable-worldmodel`
- Category: AI Apps & Workflows
- Upstream repo: `https://github.com/galilai-group/stable-worldmodel`
- Upstream docs: `https://galilai-group.github.io/stable-worldmodel/`
- Upstream package: `stable-worldmodel==0.1.0`
- Upstream author: GalilAI group / `galilai-group`
- Icon source: `https://github.com/galilai-group.png`, the GitHub organization avatar. The upstream README, docs tree, and MkDocs config were inspected and no dedicated logo, icon, favicon, or SVG asset was present.

## What Runs By Default

- `app`: an internal Python HTTP verifier on `APP_PORT=8000`. On startup it installs CPU-only PyTorch and TorchVision wheels, installs `stable-worldmodel`, imports the package, checks the package API and environment registry, and serves smoke-test endpoints.
- `proxy`: a public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

The `/demo` endpoint exercises safe local primitives from the real package:

- `stable_worldmodel.spaces.Discrete`, `RGBBox`, and `Dict`
- `stable_worldmodel.policy.PlanConfig`
- `stable_worldmodel.solver.CEMSolver`
- the `swm --version` CLI path through `python -m stable_worldmodel.cli --version`

The solver demo uses a local quadratic cost fixture and tiny tensors only. It is not a real model-serving endpoint.

## Deployment

1. Deploy the `stable-worldmodel` template on Phala Cloud.
2. Keep the default CPU resources for the verifier.
3. Open the public endpoint on port `8080`.
4. Check `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads Python wheels from the public package indexes. No persistent volume is required because the verifier does not store datasets, checkpoints, model weights, or generated artifacts.

## Environment Variables

No credentials are required by the default verifier.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `APP_PORT` | `8000` | No | Internal Python app port. Caddy proxies to this port; the public host port is `8080`. |
| `STABLE_WORLDMODEL_VERSION` | `0.1.0` | No | Pinned `stable-worldmodel` package version installed by the verifier. |
| `PYTORCH_CPU_VERSION` | `2.7.1+cpu` | No | CPU-only PyTorch wheel version installed from the official PyTorch CPU wheel index before `stable-worldmodel`. |
| `TORCHVISION_CPU_VERSION` | `0.22.1+cpu` | No | CPU-only TorchVision wheel version matching the default PyTorch version. |
| `OPENCV_PYTHON_HEADLESS_VERSION` | `4.12.0.88` | No | Headless OpenCV compatibility package used because upstream imports visual wrappers at package import time. |
| `IMAGEIO_VERSION` | `2.37.0` | No | ImageIO compatibility package used because upstream imports visual wrapper helpers at package import time. |
| `STABLEWM_HOME` | `/tmp/stable_worldmodel` | No | Cache root used by upstream helpers if users later add dataset or checkpoint code. The default verifier does not populate it. |
| `HF_HUB_DISABLE_TELEMETRY` | `1` | No | Disables Hugging Face telemetry in case users extend the verifier with Hub-aware code. |
| `WANDB_DISABLED` | `true` | No | Keeps Weights & Biases disabled for the default verifier. |
| `WANDB_MODE` | `offline` | No | Keeps Weights & Biases offline for the default verifier. |
| `CUDA_VISIBLE_DEVICES` | empty | No | Hides CUDA devices from the default runtime. CUDA is not required. |

Provider, dataset, checkpoint, and telemetry credentials such as `HF_TOKEN`, `HUGGING_FACE_HUB_TOKEN`, `WANDB_API_KEY`, `OPENAI_API_KEY`, or private storage tokens are intentionally not required and are not consumed by the default demo. Add secrets only if you replace this verifier with a real training, evaluation, dataset, or inference workflow.

## Exposed Endpoints

The public HTTP API is available through Caddy on port `8080`.

- `GET /healthz`: returns HTTP 200 when the real package imports and the package/API checks pass.
- `GET /demo`: runs deterministic local `stable-worldmodel` space, planning config, CEM solver, and CLI checks. It returns explicit booleans showing that no training, evaluation, model download, checkpoint loading, dataset download, provider call, credential requirement, or GPU requirement is active.
- `GET /v1/models`: returns an OpenAI-shaped metadata list with `stable-worldmodel/no-model-download-demo`. It is metadata only; the default template does not host or load a model.
- `GET /`: returns the same readiness payload as `/healthz`.

## Smoke Verification

Run these checks after deployment to verify the CPU-safe demo:

```bash
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `/demo` contains `"ok": true`.
- `/demo.demo.runtime.model_downloads` is `false`.
- `/demo.demo.runtime.training_started` is `false`.
- `/demo.demo.runtime.provider_api_calls` is `false`.
- `/v1/models` includes `stable-worldmodel/no-model-download-demo`.

For a local Compose smoke test from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/stable-worldmodel/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/stable-worldmodel/docker-compose.yml down
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/stable-worldmodel/docker-compose.yml config >/dev/null
```

## Production Notes

`stable-worldmodel` is a research library for data collection, world-model training, and evaluation with model-predictive control. The upstream quick start and CLI docs show workflows such as `World(...)`, `world.collect(...)`, `swm envs`, dataset inspection, checkpoint listing, and planning with `CEMSolver`. Real workloads can require environment extras, simulator dependencies, datasets, checkpoints, GPU or accelerator resources, large storage, reproducibility controls, and experiment tracking.

Before adapting this template for production research:

- Pick the exact environment suite and install only the required upstream extras or simulator packages.
- Size CPU, memory, disk, and GPU resources around the selected environment, batch size, model, dataset format, and checkpoint storage.
- Use named volumes for datasets, caches, checkpoints, and logs when persistence is needed.
- Review dataset, simulator, model, and checkpoint licenses before downloading or serving artifacts.
- Store credentials through Phala Cloud secrets or required environment variables; never hardcode tokens in `docker-compose.yml` or this README.
- Add authentication before exposing dataset, checkpoint, training, evaluation, or file-management endpoints.
- Replace the verifier with an explicit training, evaluation, or serving command and document any required datasets, checkpoints, credentials, and accelerator assumptions.

## Security Notes

- Only Caddy publishes a host port: `8080:80`.
- The app service is internal and uses `expose`, not `ports`.
- The template does not use privileged mode, host networking, host IPC, host PID, Docker socket mounts, host bind mounts, external `env_file`, real secrets, or private credentials.
- The default endpoints are unauthenticated metadata and smoke-test endpoints only.
- The default runtime path does not download datasets, model weights, or checkpoints and does not call external model providers.

## Cleanup

```bash
docker compose -f templates/prebuilt/stable-worldmodel/docker-compose.yml down
```

No named volumes are created by this template.
