# AIDC-AI/Pixelle-Video

Deploy a CPU-safe Pixelle-Video source verifier on Phala Cloud.

## Metadata

- Template id: `pixelle-video`
- Display name: `AIDC-AI/Pixelle-Video`
- Category: AI Apps & Workflows
- Description: 🚀 AI 全自动短视频引擎 | AI Fully Automated Short Video Engine
- Upstream repository: https://github.com/AIDC-AI/Pixelle-Video
- Upstream documentation: https://aidc-ai.github.io/Pixelle-Video/
- Upstream deployment docs inspected: upstream `README.md`, `README_EN.md`, `Dockerfile`, `docker-compose.yml`, `pyproject.toml`, `config.example.yaml`, `docs/en/getting-started/installation.md`, `docs/en/getting-started/configuration.md`, `docs/en/user-guide/api.md`, and `docs/en/reference/api-overview.md`
- Default upstream source ref: `db2e43a121a60b5042f72bec3f2627772dd401d6`
- Icon source: upstream repository asset `resources/example.png`. The inspected upstream tree did not include a dedicated logo, icon, or favicon, so this template uses that bundled square visual asset and saves it as `templates/icons/pixelle-video.png`.
- Upstream author: `AIDC-AI`

## Overview

Pixelle-Video is an AI short-video creation app. The upstream project can generate scripts, AI images or videos, narration, background music, and composed short videos from a topic. It provides a Streamlit web UI, a FastAPI backend, Python SDK APIs, ComfyUI and RunningHub workflow integrations, OpenAI-compatible LLM presets, Edge-TTS or ComfyUI TTS paths, frame templates, and video composition utilities.

The full upstream runtime is not a safe default `tdx.small` template. Its normal quick start expects users to configure LLM credentials and an image/video generation backend such as ComfyUI or RunningHub. Local ComfyUI production usage can require GPU capacity and model files, while cloud generation requires API keys. The upstream Docker Compose also builds from a local repository checkout and uses host bind mounts for config, data, and output.

This template therefore runs a deterministic verifier instead of the full media-generation pipeline. At startup it downloads the inspected upstream source tarball from GitHub, installs the real `pixelle-video` Python source package with `--no-deps`, loads lightweight upstream source modules, and exposes HTTP smoke-test endpoints. The `/demo` endpoint exercises local Pixelle-Video primitives by reading upstream package metadata, loading LLM preset definitions, validating the upstream Pydantic config schema, creating upstream storyboard dataclasses, counting bundled templates and workflows, and reading the example config.

The default verifier does not call LLM providers, call ComfyUI, call RunningHub, synthesize speech, start video generation, download model weights, require browser authentication, request GPU access, include real secrets, use privileged mode, use host networking, use host IPC, use `env_file`, use host bind mounts, or depend on an external build context.

## Services

- `app`: Python HTTP verifier service based on `ghcr.io/astral-sh/uv:python3.11-bookworm-slim`.

The service uses a named Docker volume, `pixelle_video_cache`, to cache the downloaded upstream source between restarts. It does not mount host paths.

## Ports

- `8080`: Public HTTP endpoint for health, demo, and model-list compatibility checks.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PIXELLE_VIDEO_REF` | No | `db2e43a121a60b5042f72bec3f2627772dd401d6` | Git branch, tag, or commit downloaded from `AIDC-AI/Pixelle-Video` at startup. The default is the upstream `main` HEAD inspected for this template. |
| `PORT` | No | `8080` | HTTP port listened on inside the container. The compose file publishes it as `8080`. |

The compose file also sets internal Python and pip runtime flags. Those are fixed by the template and do not need user input.

## Deploy

1. Deploy the `pixelle-video` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `PIXELLE_VIDEO_REF` to a specific upstream tag, branch, or commit.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the upstream source tarball from GitHub and small Python build/runtime packages from PyPI. It intentionally does not install Pixelle-Video's full dependency set, because the default path must run without media generation providers, browser setup, model downloads, or GPU-specific assets.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the upstream source is present and the verifier is ready.
- `GET /demo`: Runs deterministic source verification and returns upstream package metadata, config schema checks, LLM presets, storyboard dataclass output, bundled asset counts, example config defaults, and runtime guard status.
- `GET /v1/models`: Returns an OpenAI-style model list containing `pixelle-video/no-llm-source-verifier`. This is a compatibility endpoint only; it does not host or call an inference model.
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
  "runtime_guards": {
    "credentials_required": false,
    "llm_provider_calls": false,
    "comfyui_calls": false,
    "runninghub_calls": false,
    "tts_provider_calls": false,
    "video_generation_started": false,
    "model_downloaded": false,
    "gpu_required": false
  },
  "demo": {
    "source_import_ok": true,
    "storyboard_demo": {
      "title": "Phala Cloud Pixelle-Video smoke test",
      "frame_count": 2
    }
  }
}
```

## Smoke Verification

Use these commands to verify that the template starts cleanly and that the deterministic endpoints respond without provider credentials.

Run locally from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/pixelle-video/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/pixelle-video/docker-compose.yml down
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/pixelle-video/docker-compose.yml config >/dev/null
```

## Production Notes

- The default template is a verifier, not a full Pixelle-Video production deployment.
- Full video generation needs configuration for the selected LLM provider and image/video generation backend. Upstream examples include OpenAI-compatible providers, Qwen, DeepSeek, Ollama, ComfyUI, RunningHub, Edge-TTS, and ComfyUI TTS workflows.
- Do not place real API keys, tokens, passwords, private keys, or one-time passwords directly in the compose file or README. Use Phala Cloud environment variables or secret handling when adapting the template.
- A production Phala Cloud deployment should avoid the upstream compose shape that builds from a host checkout and bind-mounts local config, data, and output directories. Use a prebuilt image, inline configuration, and named volumes instead.
- Local ComfyUI deployments may require GPU resources and model files. RunningHub workflows require a RunningHub API key. Hosted LLM providers require their own API keys. This verifier intentionally leaves all of those paths disabled.
- The upstream FastAPI service normally listens on `8000`, and the Streamlit UI normally listens on `8501`. This verifier only publishes `8080`.
- Add authentication or a private reverse proxy before exposing a production video-generation API, especially if provider credentials or generated media are stored in the deployment.

## Cleanup

For a local test run from the parent monorepo worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/pixelle-video/docker-compose.yml down
```
