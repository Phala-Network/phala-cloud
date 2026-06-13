# LMCache/LMCache on Phala Cloud

Deploy a CPU-safe LMCache package and source verifier on Phala Cloud.

## Overview

- Template id: `lmcache`
- Display name: `LMCache/LMCache`
- Category: AI Frameworks & Model Tools
- Upstream repository: https://github.com/LMCache/LMCache
- Upstream documentation: https://docs.lmcache.ai/
- Python package: https://pypi.org/project/lmcache/
- Pinned upstream release: `v0.4.7`
- Icon source: `lmcache.png` is the upstream README logo from `https://github.com/LMCache/LMCache/blob/dev/asset/logo.png`

LMCache is a KV cache management layer for LLM inference. It is designed to reduce time-to-first-token and improve throughput by storing, reusing, and moving KV cache across serving engines and storage backends.

The upstream runtime is production infrastructure around engines such as vLLM, SGLang, and TensorRT-LLM. The official quickstart and deployment docs start real model-serving processes, and production Docker examples commonly involve GPU runtimes, model downloads, host networking or IPC, and sometimes credentials such as `HF_TOKEN`.

This template intentionally keeps the default Phala Cloud deployment small and safe for CPU-only `tdx.small` smoke tests. It builds a Python image, installs the real upstream `LMCache` release source artifact as a pure-Python package with `NO_NATIVE_EXT=1`, imports `lmcache`, verifies selected installed source files, and exposes deterministic HTTP endpoints.

The default verifier does not start `lmcache server`, run vLLM or SGLang, download model weights, load an LLM, call a model provider, require browser auth, request GPU devices, use host networking, use host IPC, or include secrets.

## Services

- `app`: Python HTTP verifier exposed on container port `8080`.

## Environment Variables

No credentials are required for the default verifier.

- `LMCACHE_LOG_LEVEL`: Optional LMCache logger level used while importing the package. Default: `INFO`.

If you adapt this template for real model serving, add only the credentials your selected model or backend needs. For gated Hugging Face models, use a Phala Cloud required environment variable such as `HF_TOKEN`; never hardcode tokens in `docker-compose.yml` or this README.

## Deploy

1. Deploy the `lmcache` template on Phala Cloud.
2. Keep the default resources for the CPU-safe verifier.
3. Optionally set `LMCACHE_LOG_LEVEL` to `WARNING` to reduce import logging.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The image build downloads the public LMCache `v0.4.7` source archive from GitHub and installs it without dependency or native-extension builds. Runtime startup does not download models or require private credentials.

## Exposed Endpoints

- `GET /healthz`: Returns readiness, imported package metadata, CPU device mode, and source marker checks.
- `GET /demo`: Runs a deterministic local chunk-reuse verifier that illustrates cache-key reuse without inference.
- `GET /v1/models`: Returns an OpenAI-compatible model-list shape with an empty `data` array because no inference model is served.
- `GET /`: Returns basic service readiness metadata.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS "https://<your-app-domain>/demo?query=What%20is%20being%20verified"
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "demo": {
    "demo_kind": "deterministic_chunk_reuse_verifier",
    "llm_provider_calls": false,
    "model_downloaded": false,
    "model_loaded": false,
    "gpu_required": false
  },
  "ok": true
}
```

## Smoke Verification

Run locally from the parent monorepo worktree:

Use these commands to verify the Compose file and the running HTTP endpoints:

```bash
docker compose -f templates/prebuilt/lmcache/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/lmcache/docker-compose.yml up -d --build
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/lmcache/docker-compose.yml down
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/lmcache/docker-compose.yml config >/dev/null
```

If your local environment only has `python3`, run `python3 templates/validate.py`.

## Production Notes

This verifier is not a production LMCache server. It proves that the upstream package source artifact is installable and importable in a minimal CPU container, and that important source modules for CLI, cache engine, and server behavior are present.

For real LMCache serving, choose a serving engine and deployment mode from the upstream docs:

- vLLM quickstart: LMCache MP mode starts `lmcache server` and points vLLM at the MP connector.
- SGLang quickstart: SGLang can launch with `--enable-lmcache`.
- TensorRT-LLM integration: Configure the LMCache connector in the engine config.
- Multiprocess mode: The LMCache server exposes a ZMQ control plane and HTTP management endpoints.

Real deployments must account for model license, model size, memory, disk, CPU latency, GPU requirements, CUDA or accelerator version, cache storage backend, observability, network placement, and authentication. The upstream Docker examples use GPU runtime flags and sometimes host networking, host IPC, model cache mounts, or credentials; those settings are deliberately not present in this Phala Cloud-safe default template.

When you replace the verifier with real serving, keep the Phala template constraints in place: no host bind mounts, no `env_file`, no privileged mode, no host network, no host IPC, and no hardcoded secrets. Use named volumes for persistent cache data and Phala Cloud environment variables for credentials.

## Cleanup

For local Docker Compose testing:

```bash
docker compose -f templates/prebuilt/lmcache/docker-compose.yml down
```

The default verifier does not create named volumes. Delete the deployment in Phala Cloud when you no longer need the CVM.
