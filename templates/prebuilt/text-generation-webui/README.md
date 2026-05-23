# oobabooga/textgen on Phala Cloud

## Overview

This template deploys a CPU-safe Phala Cloud smoke-test container for [oobabooga/text-generation-webui](https://github.com/oobabooga/text-generation-webui), now presented upstream as `oobabooga/textgen`.

TextGen is an open-source desktop app for local LLMs with a browser UI, model management, extensions, and OpenAI/Anthropic-compatible API modes. A full TextGen deployment can install large model-serving dependencies, download model weights, and require more disk, memory, or GPU resources depending on the selected backend and model.

To keep the default deployment practical on a small CPU-only confidential VM, this prebuilt template does not start the full Gradio WebUI or load a model. Instead, it starts a small HTTP service that downloads selected upstream source files from GitHub, compiles the Python entry modules, verifies the expected CPU/API startup flags from `modules/shared.py`, and exposes JSON endpoints for smoke testing.

The demo does not download model weights, run text generation, require Hugging Face credentials, request GPU devices, or use privileged container features.

## Deploy on Phala Cloud

1. Create a new deployment from the `text-generation-webui` prebuilt template on Phala Cloud.
2. Keep the default resources for a CPU-only source-check smoke test.
3. Optionally set `TEXTGEN_SOURCE_REF` to a specific upstream tag, branch, or commit.
4. Deploy the CVM and open the generated public endpoint for port `8080`.
5. Visit `https://<your-app-domain>/healthz` after startup.

The container uses the public `python:3.12-slim-bookworm` image and fetches a small set of upstream source files at runtime. No host bind mounts, `env_file`, Docker socket, host networking, host IPC, or external build context are used.

## Environment variables

No credentials are required for the default demo.

- `TEXTGEN_SOURCE_REF`: Optional upstream Git ref used when downloading source files from `oobabooga/text-generation-webui`. Default: `main`.

If you adapt this template to run real model inference, add only the credentials your selected model or provider actually requires. For gated Hugging Face models, use a Phala Cloud secret or required environment variable such as `HF_TOKEN`; do not hardcode real tokens in `docker-compose.yml` or this README.

## Usage

The public endpoint exposes a small JSON API on port `8080`:

- `GET /healthz`: Readiness payload. It returns HTTP `200` even when the upstream source check is still running or degraded, so it is safe for platform health checks.
- `GET /demo`: Detailed source-check result, including downloaded files, Python compile checks, startup flag checks, and demo scope.
- `GET /v1/models`: OpenAI-compatible model-list shape with an empty `data` array because no model server is running.
- `GET /`: Same payload as `/healthz`.

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
  "cpu_only": true,
  "model_downloaded": false,
  "model_loaded": false,
  "real_webui_started": false,
  "credentials_required": false
}
```

## Verification/Smoke test

Run from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/text-generation-webui/docker-compose.yml config >/dev/null
```

Optional local runtime check:

```bash
docker compose -f templates/prebuilt/text-generation-webui/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/text-generation-webui/docker-compose.yml down
```

A healthy source-check demo returns HTTP `200` from `/healthz` and `/demo`. When the upstream files were fetched and compiled successfully, the JSON payload includes `"ok": true`.

## Resource notes

The default resources are intentionally conservative for a Phala Cloud `tdx.small`-style CPU deployment:

- 1 vCPU
- 2 GiB memory
- 10 GiB disk

The default container downloads only selected source files and does not create persistent volumes. A real TextGen deployment with `python server.py --portable --api --listen` or a Docker CPU build can require much more disk and memory, long dependency installs, large model downloads, and careful model/backend selection. Review the upstream documentation, model license, model size, CPU latency, and credential requirements before converting this demo into a full inference service.

## Upstream attribution

- Upstream repository: [oobabooga/text-generation-webui](https://github.com/oobabooga/text-generation-webui), now shown by GitHub as [oobabooga/textgen](https://github.com/oobabooga/textgen).
- Upstream README and docs: [README](https://github.com/oobabooga/textgen/blob/main/README.md), [Docker docs](https://github.com/oobabooga/textgen/blob/main/docs/09%20-%20Docker.md), and [OpenAI API docs](https://github.com/oobabooga/textgen/blob/main/docs/12%20-%20OpenAI%20API.md).
- Icon source: `css/icon.png` from the upstream repository: https://github.com/oobabooga/textgen/blob/main/css/icon.png
