# bentoml/OpenLLM on Phala Cloud

Deploy a CPU-safe OpenLLM package-load demo on Phala Cloud.

## Metadata

- Template id: `openllm`
- Category: LLM Inference & Model Serving
- Upstream repository: https://github.com/bentoml/OpenLLM
- Upstream project: OpenLLM by the BentoML team
- Python package: https://pypi.org/project/openllm/
- Icon source: the upstream repository did not include a local logo, icon, or favicon asset, so `openllm.jpg` uses the BentoML GitHub organization avatar fallback from `https://avatars.githubusercontent.com/u/49176046?s=256&v=4`

## What This Template Runs

OpenLLM runs open-source LLMs and custom models as OpenAI-compatible APIs. The upstream `openllm serve <model>` path normally needs a selected model, model downloads, and often GPU-class resources. Gated Hugging Face models also require credentials such as `HF_TOKEN`.

This template intentionally keeps the default deployment safe for a CPU-only `tdx.small` smoke test. It starts a small Python HTTP service on the public `python:3.11-slim-bookworm` image, installs the pinned `openllm` package, imports `openllm.__main__`, `openllm.local`, `bentoml`, and `openai`, then exposes JSON endpoints that prove the OpenLLM package and serving-related modules can load.

The demo does not run `openllm serve`, download model weights, load a model, call BentoCloud, require a Hugging Face token, or require GPU access.

## Services

- `app`: Python HTTP demo service exposed on container port `8080`.

## Ports

- `8080`: Public HTTP endpoint for health, package-load demo checks, and an OpenAI-compatible model-list stub.

## Environment Variables

No credentials are required for the default demo.

- `OPENLLM_PYTHON_VERSION`: Optional OpenLLM Python package version installed at container startup. Default: `0.6.30`.

If you modify this template to run real model serving, add only the variables required by your model or deployment target. For gated Hugging Face models, use a Phala Cloud secret or required environment variable for `HF_TOKEN`; do not hardcode tokens in the compose file or README.

## Deploy

1. Deploy the `openllm` template on Phala Cloud.
2. Keep the default CPU-only resources for the package-load smoke test.
3. Optionally set `OPENLLM_PYTHON_VERSION` to another published PyPI version.
4. Open `https://<your-app-domain>/healthz` after the first startup completes.

The first startup downloads the pinned OpenLLM package and its Python dependencies from PyPI. No private models, paid credentials, GPU devices, host mounts, Docker socket access, host networking, or privileged container features are required.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the OpenLLM package, CLI/local modules, BentoML dependency, and OpenAI client dependency imported successfully.
- `GET /demo`: Returns package metadata and a CPU-only demo result showing that no model was downloaded or loaded.
- `GET /v1/models`: Returns an OpenAI-compatible model-list shape with an empty `data` array because no model server is running.
- `GET /`: Same readiness payload as `/healthz`.

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
  "check": "import openllm.__main__, openllm.local, bentoml, openai",
  "cpu_only": true,
  "model_downloaded": false,
  "model_loaded": false,
  "inference_started": false
}
```

## Smoke Verification

Run locally from the repository root:

```bash
docker compose -f templates/prebuilt/openllm/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/openllm/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/openllm/docker-compose.yml down
```

Template validation commands:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/openllm/docker-compose.yml config >/dev/null
```

## Extending To Real OpenLLM Serving

To run real inference, replace the demo HTTP server with an OpenLLM serving command for a model that fits your resources, for example:

```bash
openllm serve llama3.2:1b --port 3000
```

Real serving requirements depend on the selected model and backend. Review the model license, memory requirements, disk size, download size, CPU latency, GPU requirements, and credential requirements before deploying. The upstream README notes that OpenLLM does not store model weights and that gated Hugging Face models require `HF_TOKEN`.

After a real OpenLLM server is running, the OpenAI-compatible base URL is typically:

```text
https://<your-app-domain>/v1
```

Example OpenAI-compatible request after adapting the template to serve a real model:

```bash
curl -fsS https://<your-app-domain>/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"<served-model-id>","messages":[{"role":"user","content":"Reply with a short health check."}]}'
```

## Security Notes

- The default demo exposes unauthenticated health and metadata endpoints. Add authentication before exposing real model inference or private data.
- Do not put secrets in `docker-compose.yml`. Use Phala Cloud environment variables or secret handling for credentials such as `HF_TOKEN` or BentoCloud access tokens.
- The container does not request GPU access, privileged mode, host networking, host IPC, host bind mounts, or Docker socket access.
- Pin `OPENLLM_PYTHON_VERSION` for reproducible deployments.

## Cleanup

For local Docker Compose testing:

```bash
docker compose -f templates/prebuilt/openllm/docker-compose.yml down
```

The default demo does not create named volumes. In Phala Cloud, delete the deployment when you no longer need the CVM.
