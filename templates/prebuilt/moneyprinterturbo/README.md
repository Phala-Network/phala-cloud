# harry0703/MoneyPrinterTurbo

Deploy a CPU-safe MoneyPrinterTurbo source-package verifier on Phala Cloud.

## Metadata

- Template id: `moneyprinterturbo`
- Display name: `harry0703/MoneyPrinterTurbo`
- Category: AI Apps & Workflows
- Description: 利用AI大模型，一键生成高清短视频 Generate short videos with one click using AI LLM.
- Upstream repository: https://github.com/harry0703/MoneyPrinterTurbo
- Upstream deployment docs inspected: upstream `README.md`, `README-en.md`, `docker-compose.yml`, `Dockerfile`, `pyproject.toml`, and `docs/GPU_DOCKER_DEPLOYMENT.md`
- Default upstream source ref: `042deb84f01ee19936f8afc7b99ea36177502b37`
- Icon source: upstream README API screenshot at `docs/api.jpg`. The upstream repository did not include a dedicated logo, icon, or favicon; the file is PNG image data and is saved in this templates repo as `templates/icons/moneyprinterturbo.png`.
- Upstream author: `harry0703`

## Overview

MoneyPrinterTurbo is an application for generating short videos from a topic or keyword. The full upstream app can generate scripts, collect materials, synthesize voice, render subtitles, add background music, and compose videos through its API and Streamlit WebUI.

The upstream Docker deployment builds from the local repository and bind-mounts the checkout into containers. That shape is not suitable for Phala Cloud prebuilt templates because it depends on a host build context and host bind mounts. Full video generation also normally needs `config.toml` provider credentials for LLMs, material sources, and TTS, and the Whisper subtitle mode may download large model weights.

This template therefore runs a deterministic verifier instead of the full video pipeline. At startup it downloads the inspected upstream source tarball from GitHub, installs the real `moneyprinterturbo` Python package with `--no-deps`, imports lightweight upstream modules such as `app.models.const` and `app.config.config`, parses the upstream package metadata and FastAPI route definitions, and exposes HTTP endpoints for smoke testing.

The default verifier does not enqueue video generation, call LLM providers, call TTS providers, call material providers, download Whisper weights, require browser authentication, request GPU access, or include any real secrets.

## Services

- `app`: Python HTTP verifier service based on `ghcr.io/astral-sh/uv:python3.11-bookworm-slim`.

The service uses a named Docker volume, `moneyprinterturbo-cache`, to cache the downloaded upstream source between restarts. It does not use host bind mounts, `env_file`, privileged mode, host networking, host IPC, or an external build context.

## Ports

- `8080`: Public HTTP endpoint for health, source demo, and model-list style checks.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `MONEYPRINTERTURBO_REF` | No | `042deb84f01ee19936f8afc7b99ea36177502b37` | Git branch, tag, or commit downloaded from `harry0703/MoneyPrinterTurbo` at startup. The default is the upstream `main` HEAD inspected for this template. |
| `PORT` | No | `8080` | HTTP port listened on inside the container. The compose file publishes it as `8080`. |

## Deploy

1. Deploy the `moneyprinterturbo` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `MONEYPRINTERTURBO_REF` to a specific upstream tag, branch, or commit.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the upstream source tarball from GitHub and small Python build/runtime packages from PyPI. It intentionally does not install MoneyPrinterTurbo's full dependency set, because the full set includes video, provider, and transcription dependencies that are unnecessary for the no-secret verifier path.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the upstream source package installs and lightweight source imports pass.
- `GET /demo`: Returns deterministic source verification details: upstream source ref, package metadata, imported constants, discovered API route definitions, bundled asset counts, and runtime guard status.
- `GET /v1/models`: Returns an OpenAI-style model list containing `moneyprinterturbo/no-llm-source-verifier`. This is a compatibility endpoint only; it does not host or call a model.
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
    "tts_provider_calls": false,
    "material_provider_calls": false,
    "model_downloaded": false,
    "gpu_required": false,
    "browser_auth": false
  },
  "sample_video_request": {
    "video_subject": "Phala Cloud smoke test",
    "video_aspect": "9:16",
    "video_source": "local",
    "subtitle_enabled": false
  }
}
```

## Smoke Verification

Use these commands to verify that the template starts cleanly and that the deterministic endpoints respond without provider credentials:

Run locally from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/moneyprinterturbo/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/moneyprinterturbo/docker-compose.yml down
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/moneyprinterturbo/docker-compose.yml config >/dev/null
```

## Production Notes

- The default template is a verifier, not a full MoneyPrinterTurbo production deployment.
- For full video generation, configure the upstream application with a persistent `config.toml` and the required provider credentials for the selected LLM, material source, and TTS provider. Examples include OpenAI-compatible providers, DeepSeek, Moonshot, Gemini, Azure Speech, and Pexels, depending on the selected upstream settings.
- Do not place real API keys, tokens, passwords, or private keys directly in the compose file. Use Phala Cloud environment variables or secret management when adapting the template.
- The upstream API normally listens on `8080`, and the upstream Streamlit WebUI listens on `8501`. This verifier only publishes `8080`.
- Upstream's `subtitle_provider = "whisper"` path may require downloading a roughly 3 GB Whisper model and benefits from GPU acceleration. This verifier does not download that model and is safe for CPU-only `tdx.small` smoke deployments.
- Upstream's Docker Compose file uses a local build context and host bind mount. A production Phala Cloud adaptation should publish a prebuilt image or use only inline config and named volumes.
- Add authentication or a private reverse proxy before exposing a full production video-generation API, especially if provider credentials or generated media are stored in the deployment.

## Cleanup

For a local test run from the parent monorepo worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/moneyprinterturbo/docker-compose.yml down
```
