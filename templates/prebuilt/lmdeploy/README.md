# InternLM/lmdeploy on Phala Cloud

Deploy a CPU-safe LMDeploy source-check demo on Phala Cloud.

## Metadata

- Template id: `lmdeploy`
- Category: LLM Inference & Model Serving
- Upstream repository: https://github.com/InternLM/lmdeploy
- Upstream project: LMDeploy by InternLM / OpenMMLab
- Python package: https://pypi.org/project/lmdeploy/
- Default source ref: `v0.13.0`
- Icon source: `lmdeploy.svg` is the upstream README logo from `https://github.com/InternLM/lmdeploy/blob/main/docs/en/_static/image/lmdeploy-logo.svg`

## What This Template Runs

LMDeploy is a toolkit for compressing, deploying, and serving LLMs. Its upstream serving path uses LMDeploy engines such as TurboMind and exposes OpenAI-compatible APIs, but real inference normally requires a selected model, model weight downloads, and often GPU-class CUDA resources. Gated or private model repositories may also require credentials such as `HF_TOKEN`.

This template intentionally keeps the default deployment safe for a CPU-only `tdx.small` smoke test. It starts a small Python HTTP service on the public `python:3.11-slim-bookworm` image, fetches a small set of release-tagged LMDeploy source files from GitHub, verifies the package metadata, OpenAI API server source, and TurboMind source markers, then exposes JSON endpoints for health and inspection.

The demo does not run `lmdeploy serve`, install CUDA wheels, download model weights, load a model, require a Hugging Face token, require host CUDA drivers, or request GPU access.

## Services

- `app`: Python HTTP source-check demo service exposed on container port `8080`.

## Ports

- `8080`: Public HTTP endpoint for health, source-check details, and an OpenAI-compatible model-list stub.

## Environment Variables

No credentials are required for the default demo.

- `LMDEPLOY_REF`: Optional LMDeploy Git tag, commit, or simple branch ref used for source checks. Default: `v0.13.0`.

If you modify this template to run real model serving, add only the variables required by your model or deployment target. For gated Hugging Face models, use a Phala Cloud secret or required environment variable for `HF_TOKEN`; do not hardcode tokens in the compose file or README.

## Deploy

1. Deploy the `lmdeploy` template on Phala Cloud.
2. Keep the default CPU-only resources for the source-check smoke test.
3. Optionally set `LMDEPLOY_REF` to another public LMDeploy tag, commit, or simple branch ref.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup fetches a handful of public LMDeploy source files from GitHub. No private models, paid credentials, GPU devices, host mounts, Docker socket access, host networking, or privileged container features are required.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the LMDeploy source files and expected package/API/TurboMind markers were verified.
- `GET /demo`: Returns package source metadata and confirms that no model was downloaded, loaded, or served.
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
  "check": "Fetch release-tagged LMDeploy source files and verify package, API server, and TurboMind source markers.",
  "cpu_only": true,
  "model_downloaded": false,
  "model_loaded": false,
  "inference_started": false
}
```

## Smoke Verification

Run locally from the `sdks` submodule root:

```bash
docker compose -f templates/prebuilt/lmdeploy/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/lmdeploy/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/lmdeploy/docker-compose.yml down
```

Template validation commands from the monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/lmdeploy/docker-compose.yml config >/dev/null
```

## Extending To Real LMDeploy Serving

For real inference, replace the demo HTTP server with an LMDeploy serving command for a model that fits your resources, for example:

```bash
lmdeploy serve api_server internlm/internlm2_5-7b-chat --server-name 0.0.0.0 --server-port 8080
```

Real serving requirements depend on the selected model and engine. Review the model license, memory requirements, disk size, download size, CPU latency, GPU requirements, CUDA version, and credential requirements before deploying. The upstream `v0.13.0` README notes that PyPI wheels are built for CUDA 12.8, and the upstream documentation explains how to launch the OpenAI-compatible `api_server` and tune options such as tensor parallelism and session length.

After a real LMDeploy server is running, the OpenAI-compatible base URL is typically:

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
- Do not put secrets in `docker-compose.yml`. Use Phala Cloud environment variables or secret handling for credentials such as `HF_TOKEN`.
- The container does not request GPU access, privileged mode, host networking, host IPC, host bind mounts, external build contexts, or Docker socket access.
- Pin `LMDEPLOY_REF` to a release tag or commit for reproducible deployments.

## Cleanup

For local Docker Compose testing:

```bash
docker compose -f templates/prebuilt/lmdeploy/docker-compose.yml down
```

The default demo does not create named volumes. In Phala Cloud, delete the deployment when you no longer need the CVM.
