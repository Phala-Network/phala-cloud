# nomic-ai/gpt4all

Deploy a CPU-safe GPT4All package-load demo on Phala Cloud.

## Metadata

- Template id: `gpt4all`
- Category: LLM Inference & Model Serving
- Upstream repository: https://github.com/nomic-ai/gpt4all
- Upstream documentation: https://docs.gpt4all.io/
- Python package: https://pypi.org/project/gpt4all/
- Icon source: `gpt4all-chat/icons/gpt4all.svg` from the upstream repository

## What This Template Runs

GPT4All is a local LLM project focused on running models on consumer hardware. The upstream repository is primarily a desktop app and Python bindings project, and its README points to an older Docker-based API server history rather than a current production service image.

This template runs a minimal HTTP demo service on the public `python:3.11-slim-bookworm` image. At startup it installs the official `gpt4all` Python package, imports the package and `GPT4All` class, then exposes JSON endpoints that prove the package can load in a CPU-only container.

The demo does not download model weights and does not run text generation. The upstream example models are multi-GB GGUF files, so this template intentionally keeps startup lightweight enough for a CPU-only `tdx.small` deployment.

## Services

- `app`: Python HTTP server exposed on container port `8080`.

## Ports

- `8080`: Public HTTP endpoint for health and package-load demo checks.

## Environment Variables

No credentials are required.

- `GPT4ALL_PYTHON_VERSION`: Optional GPT4All Python package version installed at container startup. Default: `2.8.2`.

## Deploy

1. Deploy the `gpt4all` template on Phala Cloud.
2. Keep the default CPU-only resources unless you are modifying the template to load a real model.
3. Optionally set `GPT4ALL_PYTHON_VERSION` to another published PyPI version.
4. Open `https://<your-app-domain>/healthz` after the first startup completes.

The first startup downloads the official Python wheel from PyPI. No private models, paid credentials, GPU devices, host mounts, or privileged container features are required.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the `gpt4all` package and binding module imported successfully.
- `GET /demo`: Returns package metadata and a CPU-only demo result showing that the Python bindings loaded without downloading model weights.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
```

## Smoke Verification

Run locally from the repository root:

```bash
docker compose -f sdks/templates/prebuilt/gpt4all/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
docker compose -f sdks/templates/prebuilt/gpt4all/docker-compose.yml down
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "check": "from gpt4all import GPT4All",
  "cpu_only": true,
  "model_downloaded": false,
  "model_loaded": false
}
```

Template validation commands:

```bash
python sdks/templates/validate.py
git -C sdks diff --check origin/main...HEAD
docker compose -f sdks/templates/prebuilt/gpt4all/docker-compose.yml config >/dev/null
```

## Security Notes

- This demo exposes unauthenticated health and demo endpoints. Add an authenticated reverse proxy before exposing real model inference or private data.
- Do not put secrets in the compose file. This template has no required credentials.
- The container does not request GPU access, privileged mode, host networking, host bind mounts, or Docker socket access.
- If you adapt this template to load models, review model licenses, expected memory use, and download size before deployment.
- Pin `GPT4ALL_PYTHON_VERSION` for reproducible deployments.
