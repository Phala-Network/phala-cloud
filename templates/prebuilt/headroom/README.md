# chopratejas/headroom

Deploy a CPU-safe Headroom local compression verifier on Phala Cloud.

## Metadata

- Template id: `headroom`
- Display name: `chopratejas/headroom`
- Category: LLM Gateway & API Proxy
- Upstream repository: https://github.com/chopratejas/headroom
- Upstream docs: https://headroom-docs.vercel.app/docs
- Python package: `headroom-ai`
- Default package version: `0.23.0`
- Icon source: `headroom.jpg` is the GitHub owner avatar fallback from `https://github.com/chopratejas.png`. The upstream README/tree includes demo GIFs and screenshots but no dedicated logo, icon, or favicon asset.
- Upstream author: `chopratejas`, via the `chopratejas/headroom` GitHub repository

## Overview

Headroom compresses LLM context before it reaches a model: tool outputs, logs, files, RAG chunks, and conversation history. The upstream project supports Python and TypeScript libraries, an HTTP proxy, agent wrappers, MCP tools, cross-agent memory, and optional ML compression.

This template intentionally runs a small local HTTP verifier instead of starting a credentialed production proxy. The container installs the real `headroom-ai==0.23.0` package, imports the upstream Python API, disables telemetry with `HEADROOM_TELEMETRY=off`, and exposes deterministic JSON endpoints for smoke testing.

The `/demo` endpoint builds a synthetic incident-log tool output, calls `headroom.compress()` with `kompress_model="disabled"`, and verifies that the real Headroom SmartCrusher pipeline compresses JSON locally. It does not call OpenAI, Anthropic, Gemini, Copilot, Bedrock, or any other hosted model provider. It does not download model weights, start browser auth, require GPU access, mount host paths, use `env_file`, run privileged mode, or require secrets.

## Service

- `app`: Python FastAPI verifier exposed on container and host port `8080`.

## Port

- `8080`: Public HTTP endpoint for health, demo compression, OpenAI-shaped model metadata, direct local compression, and upstream metadata.

On Phala Cloud, open:

```bash
https://<your-app-domain>/healthz
```

For local Compose testing from the parent monorepo worktree:

```bash
http://localhost:8080/healthz
```

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `HEADROOM_AI_VERSION` | No | `0.23.0` | Pinned `headroom-ai` package version installed into the demo image. |

The compose file also sets `HEADROOM_TELEMETRY=off`, `HOME=/home/app`, `PYTHONUNBUFFERED=1`, and `XDG_CACHE_HOME=/tmp/.cache` inside the container.

## Deploy On Phala Cloud

1. Select the `headroom` prebuilt template.
2. Keep the default CPU resources for the first smoke deployment: 1 vCPU, 2048 MB memory, and 20 GB disk.
3. Leave `HEADROOM_AI_VERSION` at `0.23.0` unless you intentionally want to test another published package version.
4. Deploy the CVM.
5. Open `https://<your-app-domain>/healthz` after the image build and startup finish.
6. Open `https://<your-app-domain>/demo` to run the local deterministic compression verifier.

The first build downloads Python wheels from PyPI. After startup, the demo path is local and deterministic.

## Endpoints

- `GET /healthz`: Imports `headroom-ai`, reports package/runtime metadata, and checks that the compression API is available.
- `GET /demo`: Runs a deterministic local SmartCrusher compression demo over synthetic JSON tool output.
- `GET /v1/models`: Returns an OpenAI-compatible model-list shape for the local compression verifier. It is not an LLM model server.
- `POST /v1/compress`: Compresses caller-provided `messages` or `content` locally with the real `headroom.compress()` API and no provider call.
- `GET /upstream`: Returns upstream repository, package, docs, Docker image, and icon attribution metadata.
- `GET /`: Returns a compact endpoint index.

Example smoke checks:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
curl -fsS https://<your-app-domain>/upstream
```

Example direct local compression request:

```bash
curl -fsS https://<your-app-domain>/v1/compress \
  -H "Content-Type: application/json" \
  -d '{"content":"{\"logs\":[{\"level\":\"FATAL\",\"service\":\"checkout-api\",\"message\":\"database pool exhausted\"},{\"level\":\"INFO\",\"service\":\"checkout-api\",\"message\":\"request completed\"}]}"}'
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "remote_model_calls": false,
  "provider_credentials_required": false,
  "model_downloaded": false,
  "demo": {
    "ok": true,
    "tokens_saved": 1000,
    "transforms_applied": ["router:smart_crusher:0.21"],
    "fatal_marker_preserved": true
  }
}
```

Token counts and transform ordering vary slightly by `tiktoken` and package versions, so verify the shape, positive savings, and presence of a `router:smart_crusher:*` transform rather than exact numbers.

## Local Verification

Run from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/headroom/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/headroom/docker-compose.yml up -d --build
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/upstream
docker compose -f templates/prebuilt/headroom/docker-compose.yml down
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/headroom/docker-compose.yml config >/dev/null
```

If local port `8080` is already in use, temporarily change only the host side of the port mapping, for example `18080:8080`, then use `http://localhost:18080/healthz`.

## Production Notes

- This template is a verifier for the Headroom package/runtime, not a production LLM gateway.
- The upstream production proxy is usually started with `headroom proxy --host 0.0.0.0 --port 8787` or with the upstream `ghcr.io/chopratejas/headroom` image. Real proxy traffic must be pointed at a downstream provider or OpenAI-compatible API and should be protected before public exposure.
- The default verifier sets `kompress_model="disabled"` so it does not download Hugging Face model weights. If you enable Headroom's optional `[ml]`, `[memory]`, `[relevance]`, `[image]`, or `[all]` extras, review CPU, memory, disk, model-download, and dependency-size impact before deploying on `tdx.small`.
- The verifier endpoints are unauthenticated. Add authentication, authorization, rate limits, request logging, and request-size limits before adapting this template for private workloads.
- Store real provider credentials as Phala Cloud environment variables or secrets. Do not put API keys, bearer tokens, private keys, OTPs, passwords, or generated master keys in `docker-compose.yml`, README examples, or source control.
- Keep `HEADROOM_AI_VERSION` pinned for reproducible builds, and test `/healthz`, `/demo`, and a representative `/v1/compress` request after changing the package version.
- The compose file intentionally avoids host bind mounts, `env_file`, external build contexts, privileged mode, host networking, host IPC, Docker socket access, GPU devices, browser authentication, hosted model calls, and model-weight downloads.

## Upstream Runtime Notes Inspected

The template shape is based on the upstream README, `pyproject.toml`, `Dockerfile`, `docker-compose.yml`, `wiki/quickstart.md`, `wiki/proxy.md`, `wiki/mcp.md`, and `wiki/docker-install.md`.

Relevant upstream behavior:

- `pip install headroom-ai` provides the core Python compression API.
- `pip install "headroom-ai[proxy]"` adds FastAPI/HTTP proxy, MCP, and related proxy dependencies.
- `headroom proxy` exposes upstream health/readiness and proxy endpoints such as `/health`, `/readyz`, `/stats`, and `/v1/compress`.
- `headroom mcp` provides `headroom_compress`, `headroom_retrieve`, and `headroom_stats` for MCP clients.
- The upstream Docker image is designed for the proxy runtime on port `8787`; this template uses a custom local verifier on port `8080` so the default deployment stays no-secret and deterministic.

## Upstream Attribution

Headroom is developed by the `chopratejas/headroom` project:

- Repository: https://github.com/chopratejas/headroom
- Documentation: https://headroom-docs.vercel.app/docs
- Package index: https://pypi.org/project/headroom-ai/
- Container image: https://github.com/chopratejas/headroom/pkgs/container/headroom
- License: https://github.com/chopratejas/headroom/blob/main/LICENSE

This Phala Cloud template installs and imports the real upstream `headroom-ai` package and preserves upstream attribution in the template metadata.
