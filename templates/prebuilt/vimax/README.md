# HKUDS/ViMax on Phala Cloud

This template runs a CPU-safe ViMax source verifier behind a public HTTP port. The app downloads the pinned upstream ViMax source tree, imports real upstream modules, constructs deterministic local scene-planning objects, resolves a provider preset without a secret, and exposes JSON endpoints for smoke testing.

It does not run video generation by default. ViMax's documented production workflows require chat, image, and video provider configuration, and real generation can call hosted APIs. This template intentionally avoids provider calls, API keys, browser authentication, model downloads, model weights, GPU/CUDA paths, training, and media rendering so it can start on a small CPU-only Phala CVM such as `tdx.small`.

## Metadata

- Template id: `vimax`
- Display name: `HKUDS/ViMax`
- Category: AI Apps & Workflows
- Description: ViMax: Agentic Video Generation (Director, Screenwriter, Producer, and Video Generator All-in-One)
- Upstream repository: `https://github.com/HKUDS/ViMax`
- Upstream author: `HKUDS`
- Default upstream source ref: `d653f20483907e0aec6e4f20554eca222486294d`
- Upstream docs inspected: upstream `readme.md`, `pyproject.toml`, `configs/idea2video.yaml`, `configs/script2video.yaml`, `configs/idea2video_minimax.yaml`, `configs/script2video_minimax.yaml`, `main_idea2video.py`, `main_script2video.py`, `pipelines/idea2video_pipeline.py`, `pipelines/script2video_pipeline.py`, and local interface/provider modules.
- Icon source: upstream README image `assets/vimax.png`, saved in this templates repo as `templates/icons/vimax.png`.

## Overview

ViMax is an agentic video generation framework for transforming ideas, novels, or scripts into multi-scene video plans and final generated clips. The upstream README describes Idea2Video, Novel2Video, Script2Video, and AutoCameo workflows, with agents for screenwriting, character extraction, storyboard design, camera planning, reference image selection, image generation, and video generation.

The upstream quick start uses `uv sync`, then asks users to configure model and API key information in YAML files. The default examples include a chat model, an image generator, and a video generator. MiniMax can also be used as an OpenAI-compatible chat provider through `MINIMAX_API_KEY`.

That production shape is not appropriate for a no-secret prebuilt smoke template. Instead, this template downloads the real upstream source artifact and imports local modules such as `interfaces` and `utils.provider_presets`. The `/demo` endpoint constructs upstream Pydantic models for a scene, shot brief, shot description, camera, and event, and verifies that a MiniMax provider preset can be resolved without configuring a key.

## Services

- `app`: a Python 3.12 HTTP verifier based on `ghcr.io/astral-sh/uv:python3.12-bookworm-slim`.

The service uses the named Docker volume `vimax-cache` to cache the downloaded upstream source between restarts. It does not use host bind mounts, `env_file`, privileged mode, host networking, host IPC, host PID, Docker socket mounts, external build contexts, GPU device requests, or real credentials.

## Ports

- `8080`: public HTTP endpoint for health, demo, and model-list style checks.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `VIMAX_REF` | No | `d653f20483907e0aec6e4f20554eca222486294d` | Git branch, tag, or commit downloaded from `HKUDS/ViMax` at startup. The default is the upstream `main` HEAD inspected for this template. |
| `PORT` | No | `8080` | HTTP port listened on inside the container. The compose file publishes it as `8080`. |

The default verifier does not consume `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `GOOGLE_API_KEY`, `MINIMAX_API_KEY`, image-generation provider keys, or video-generation provider keys. Add those only if you replace the verifier with a real ViMax production workflow.

## Deploy

1. Deploy the `vimax` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier: 1 vCPU, 1 GB memory, and 10 GB disk.
3. Optionally set `VIMAX_REF` to a specific upstream tag, branch, or commit.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the pinned upstream source tarball from GitHub and installs a small set of Python runtime packages needed to import the local verifier path. It does not run `uv sync` for the full ViMax dependency set, because the complete generation stack is unnecessary for the no-secret smoke path and can pull in heavier media/provider dependencies.

## Exposed Endpoints

- `GET /healthz`: returns HTTP 200 when the upstream source artifact is present, `pyproject.toml` matches the expected project name, and the local import/demo checks pass.
- `GET /demo`: returns deterministic source verification details, including upstream config summaries, imported interface symbols, constructed scene/shot/camera/event objects, the provider preset result, the upstream logo metadata, and explicit runtime guard booleans.
- `GET /v1/models`: returns an OpenAI-shaped model list containing `vimax/no-provider-source-verifier`. This is metadata only; it does not host, download, or call a model.
- `GET /`: returns service metadata and endpoint names.

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
    "chat_model_calls": false,
    "image_generation_calls": false,
    "video_generation_calls": false,
    "model_downloaded": false,
    "gpu_or_cuda_required": false
  },
  "imports": {
    "demo": {
      "provider_preset_without_secret": {
        "model_provider": "openai",
        "model": "MiniMax-M2.7",
        "api_key_configured": false
      }
    }
  }
}
```

## Smoke Verification

Use these commands from the parent monorepo worktree to verify the template locally:

```bash
docker compose -f templates/prebuilt/vimax/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/vimax/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/vimax/docker-compose.yml down
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/vimax/docker-compose.yml config >/dev/null
```

## Production Notes

- The default template is a verifier, not a full ViMax generation deployment.
- Full Idea2Video or Script2Video execution requires real provider configuration for the chat model, image generator, and video generator. Upstream examples use OpenAI-compatible/OpenRouter chat configuration, Google image/video generator classes, and MiniMax provider presets.
- Do not place real API keys, tokens, passwords, or private keys directly in `docker-compose.yml` or this README. Use Phala Cloud environment variables or secret management when adapting the template.
- A production deployment should generate or mount explicit ViMax YAML config at runtime, choose provider classes deliberately, persist working directories only when needed, and document any required credentials as required environment variables.
- Real video generation can create external API traffic, generated media files, content-safety obligations, rate-limit behavior, and cost exposure. Add authentication, rate limits, logging controls, and storage lifecycle management before exposing generation endpoints.
- The upstream code can use media libraries such as OpenCV and MoviePy and can call hosted image/video generation APIs. Size Phala resources based on the selected provider workflow rather than the small verifier.
- Review upstream and model/provider licenses before using generated media in production.

## Cleanup

For a local test run from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/vimax/docker-compose.yml down
```

To remove the cached upstream source volume as well:

```bash
docker compose -f templates/prebuilt/vimax/docker-compose.yml down -v
```
