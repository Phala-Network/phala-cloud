# unslothai/unsloth on Phala Cloud

Deploy a CPU-safe Unsloth package metadata verifier on Phala Cloud.

## Metadata

- Template id: `unsloth`
- Display name: `unslothai/unsloth`
- Category: AI training and fine-tuning tools
- Upstream repository: https://github.com/unslothai/unsloth
- Upstream documentation: https://unsloth.ai/docs
- Python package: https://pypi.org/project/unsloth/
- Upstream author: Unsloth AI team, via the `unslothai/unsloth` GitHub repository
- Package metadata license: `Apache-2.0`; upstream Studio files also carry their own notices in the upstream repository
- Phala prebuilt source: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/unsloth
- Icon source: upstream repository image `images/unsloth logo only.png`, saved as `icons/unsloth.png`

## What This Template Runs

Unsloth is a GPU-oriented fine-tuning, reinforcement learning, inference, and local Studio toolkit for LLM workflows. The normal Python package dependency metadata includes the training stack around PyTorch, xformers, bitsandbytes, Triton, Transformers, PEFT, TRL, Accelerate, and Hugging Face tooling. The top-level Unsloth import on Linux enters GPU-oriented initialization and is not a good default smoke test for a small CPU-only CVM.

This template intentionally does not run training, Unsloth Studio, inference, model downloads, Hugging Face downloads, hosted provider calls, or GPU checks. Instead, it starts a small Python HTTP service on port `8080`, installs the pinned published Unsloth wheel with `pip install --no-deps`, and verifies package metadata and source files that are safe to inspect on `tdx.small`.

The health check is considered ready only when the installed wheel passes these checks:

- Distribution `unsloth` is installed at the configured `UNSLOTH_VERSION`.
- The source version in `unsloth/models/_utils.py` matches the wheel version.
- The wheel metadata points to `https://github.com/unslothai/unsloth` and `https://unsloth.ai/docs`.
- The `unsloth` console script is registered as `unsloth_cli:app`.
- Required package files for the core package and CLI are present.
- The dependency metadata shows the expected GPU/training stack, which is why the template avoids a dependency-complete import by default.

## Services

- `app`: Python 3.13 HTTP verifier service based on `python:3.13-slim-bookworm`.

## Ports

- `8080`: Public HTTP endpoint for health, demo metadata, and an OpenAI-compatible empty model-list shape.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `UNSLOTH_VERSION` | No | `2026.5.8` | Published Unsloth Python package version installed with `--no-deps` for metadata verification. |

If you adapt this template to run real Unsloth training, Studio, or inference, add only the variables required for your workload. For gated Hugging Face models, use a Phala Cloud secret or a required environment variable such as `HF_TOKEN`; do not hard-code tokens in the compose file or README.

## Deploy

1. Deploy the `unsloth` prebuilt template on Phala Cloud.
2. Keep the default CPU-only resource profile for the first smoke test.
3. Optionally set `UNSLOTH_VERSION` to another published Unsloth package version.
4. After startup completes, open `https://<your-app-domain>/healthz`.

The first startup downloads the pinned Unsloth wheel from PyPI. The default compose file does not require or use API keys, Hugging Face credentials, model weights, persistent databases, host bind mounts, host networking, privileged mode, `env_file`, Docker socket access, or GPU devices.

## Usage Endpoints

- `GET /healthz`: Returns `200` only when the Unsloth wheel metadata and source-file checks pass.
- `GET /demo`: Returns the same package metadata plus explicit flags showing that no import, training, Studio process, model load, model download, or hosted call was performed.
- `GET /v1/models`: Returns an OpenAI-compatible model-list shape with an empty `data` array because this template does not serve a model.
- `GET /`: Same readiness payload as `/healthz`.

Examples:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "demo": {
    "cpu_only": true,
    "install_mode": "pip install --no-deps unsloth==<UNSLOTH_VERSION>",
    "package_imported": false,
    "training_started": false,
    "studio_started": false,
    "model_downloaded": false,
    "model_loaded": false,
    "hugging_face_token_required": false
  }
}
```

Expected `/v1/models` shape:

```json
{
  "object": "list",
  "data": [],
  "demo": {
    "metadata_ready": true,
    "model_downloaded": false,
    "model_loaded": false
  }
}
```

## Smoke Verification

Run locally from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/unsloth/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/unsloth/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/unsloth/docker-compose.yml down
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/unsloth/docker-compose.yml config >/dev/null
```

Equivalent commands from inside the `sdks/` submodule:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/unsloth/docker-compose.yml config >/dev/null
```

## Extending To Real Unsloth Workloads

Use the upstream documentation before replacing this verifier with real Unsloth training, Studio, or inference. Real workloads can require GPU resources, large model and dataset downloads, compatible CUDA or accelerator libraries, persistent storage, and credentials for gated models or experiment tracking.

For example, a real fine-tuning deployment may require environment variables such as `HF_TOKEN` or `WANDB_API_KEY`. Treat those as deployment secrets and pass them through Phala Cloud secret handling or required environment variables. Do not place real tokens in `docker-compose.yml`, README examples, screenshots, or shared template settings.

When adapting the template, size the CVM for the selected model, dataset, context length, quantization mode, and training type. Keep the verifier template as the default because it is the only path here intended for a small CPU-only smoke deployment.

## Security Notes

- The default verifier exposes unauthenticated metadata endpoints. Add authentication before exposing training jobs, private model metadata, datasets, or inference APIs.
- The default service installs a public PyPI wheel and inspects local wheel metadata. It does not import Unsloth, execute training code, start Unsloth Studio, download models, call Hugging Face, or contact hosted LLM providers.
- The compose file does not mount host paths, use `env_file`, request privileged mode, use host networking, mount the Docker socket, or define literal secrets.
- Pin `UNSLOTH_VERSION` for reproducible deployments and review upstream release notes before changing it.
- Review upstream licenses and notices for the exact Unsloth components you run. The metadata verifier only inspects the published wheel; production Studio or training use may involve additional upstream components and notices.

## Cleanup

For local Docker Compose testing:

```bash
docker compose -f templates/prebuilt/unsloth/docker-compose.yml down
```

The default verifier does not create named volumes. In Phala Cloud, delete the deployment when you no longer need the CVM.

## Upstream Attribution

Unsloth is developed by the Unsloth AI team in the `unslothai/unsloth` repository: https://github.com/unslothai/unsloth.

This Phala Cloud prebuilt template preserves upstream attribution in the template metadata and README while routing deployable assets through the Phala prebuilt template path: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/unsloth.

The icon saved as `unsloth.png` is the upstream logo-only image from `images/unsloth logo only.png` in the Unsloth repository.
