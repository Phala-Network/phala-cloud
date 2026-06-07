# Open-LLM-VTuber/Open-LLM-VTuber on Phala Cloud

## Overview

Deploy a CPU-safe Open-LLM-VTuber source verifier on Phala Cloud.

Open-LLM-VTuber is a voice-interactive AI companion project with hands-free voice interaction, interruption handling, visual perception, text-to-speech, speech recognition, and Live2D avatar support. The full upstream application is a configurable backend plus web/desktop clients. Real production use normally requires a selected LLM, ASR, and TTS provider or local model stack, and may require HTTPS for browser microphone access.

This template intentionally does not start the full Open-LLM-VTuber avatar server. Instead, it downloads the real upstream GitHub source archive, installs the upstream package with `--no-deps`, imports lightweight upstream source modules, and serves deterministic JSON endpoints. The verifier exercises `BatchInput`, `TextData`, `TextSource`, `SentenceOutput`, `DisplayText`, and `Actions` from the real project source without calling an LLM provider, loading ASR/TTS engines, launching a browser, generating audio, or downloading model weights.

The normal upstream Dockerfile exposes port `12393` and requires a user-provided `/app/conf/conf.yaml`. It is not used here because a no-secret Phala template cannot rely on host bind mounts or a provider/model configuration file.

## Metadata

- Template id: `open-llm-vtuber`
- Display name: `Open-LLM-VTuber/Open-LLM-VTuber`
- Category: AI Apps & Workflows
- Upstream repository: https://github.com/Open-LLM-VTuber/Open-LLM-VTuber
- Upstream documentation: https://open-llm-vtuber.github.io/docs/quick-start
- Upstream source ref inspected: `992309c0aa19845960228f880013d4685fde93b5`
- Upstream package name: `open-llm-vtuber`
- Icon source: `avatars/shizuku.png` from the upstream repository tree. The upstream README uses `assets/banner.jpg`, but that asset is a wide banner rather than a square template icon.
- Upstream author: `Open-LLM-VTuber`

## Included Service

- `app`: Python HTTP verifier on public port `8080`. It downloads and caches the upstream source in a named Docker volume, installs the source package without dependencies, imports lightweight source primitives, and serves `/healthz`, `/demo`, and `/v1/models`.

The template does not use host bind mounts, `env_file`, privileged mode, host networking, host IPC, Docker socket access, GPU devices, browser credentials, model-provider credentials, or real secrets.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `OPEN_LLM_VTUBER_SOURCE_REF` | No | `992309c0aa19845960228f880013d4685fde93b5` | Upstream Open-LLM-VTuber commit, tag, or branch downloaded from the GitHub source archive at container startup. |
| `OPEN_LLM_VTUBER_DEMO_TEXT` | No | `Hello from Phala Cloud` | Text used by `/demo` to create deterministic upstream `BatchInput` and `SentenceOutput` objects. |

Provider variables such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, Azure speech keys, Groq keys, ElevenLabs keys, and local model paths are intentionally not used by this verifier. Add provider credentials only when replacing the verifier with a real Open-LLM-VTuber deployment.

## Persistent Data

The template creates one named Docker volume:

- `open_llm_vtuber_cache`: stores the downloaded upstream source archive contents under `/opt/open-llm-vtuber/source`.

No host bind mounts are used.

## Deploy on Phala Cloud

1. Select the prebuilt `open-llm-vtuber` template.
2. Keep the default CPU-only resources for the first smoke test.
3. Optionally set `OPEN_LLM_VTUBER_SOURCE_REF` to another compatible upstream commit or tag.
4. Deploy the CVM and wait for the first startup to complete.
5. Open `https://<your-app-domain>/healthz`.

The first startup downloads the upstream source archive from GitHub and installs the package metadata with `--no-deps`. It does not install the heavy upstream dependency set, download model weights, or start the full avatar backend.

## Exposed Endpoints

- `GET /healthz`: Returns HTTP 200 when the upstream source package is installed and the lightweight imports pass.
- `GET /demo`: Builds deterministic Open-LLM-VTuber input/output objects from upstream source primitives and returns them as JSON.
- `GET /demo?text=<message>`: Runs the same local demo with a custom input message.
- `GET /v1/models`: Returns an OpenAI-style model list containing `open-llm-vtuber/local-source-verifier`. It is metadata only, not an inference server.
- `GET /`: Returns service metadata and endpoint names.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS "https://<your-app-domain>/demo?text=hello"
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "credentials_required": false,
  "llm_provider_calls": false,
  "browser_auth_required": false,
  "model_downloaded": false,
  "audio_generated": false,
  "full_vtuber_server_started": false,
  "live2d_runtime_loaded": false,
  "demo": {
    "primitives_used": [
      "BatchInput",
      "TextData",
      "TextSource",
      "SentenceOutput",
      "DisplayText",
      "Actions"
    ]
  }
}
```

## Smoke Verification

Run locally from the parent monorepo worktree:

Use these smoke checks to verify that the service imported the upstream package and that the public JSON endpoints respond without credentials.

```bash
docker compose -f templates/prebuilt/open-llm-vtuber/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/open-llm-vtuber/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/open-llm-vtuber/docker-compose.yml down
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/open-llm-vtuber/docker-compose.yml config >/dev/null
```

If the local shell does not provide `python`, use `python3 templates/validate.py`.

## Production Notes

- The default service is a source/package verifier, not the full Open-LLM-VTuber backend.
- The full upstream server normally reads `conf.yaml`, starts FastAPI/Uvicorn, serves on port `12393`, and initializes configured LLM, ASR, TTS, VAD, Live2D, and frontend components.
- Browser microphone capture requires a secure context for remote access. Use HTTPS through Phala's public endpoint or a reverse proxy when adapting the full web client.
- Local offline mode can require model downloads for ASR, TTS, VAD, LLM, or Live2D assets. Size CPU, memory, and disk for the chosen providers before replacing this verifier.
- Hosted providers require credentials. Pass any API keys through Phala Cloud environment variables or a secret manager, never through committed Compose files, READMEs, images, or logs.
- The upstream Dockerfile expects `/app/conf/conf.yaml` and optional config assets. Use named volumes or image-baked config for Phala Cloud; do not use host bind mounts.
- Add authentication before exposing a production companion or agent API publicly. The verifier endpoints are intentionally unauthenticated smoke endpoints.
- Pin `OPEN_LLM_VTUBER_SOURCE_REF` and any provider/model versions for reproducible production deployments.

## Upstream Attribution

- Upstream repository: [Open-LLM-VTuber/Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber)
- Upstream quick start docs: [open-llm-vtuber.github.io/docs/quick-start](https://open-llm-vtuber.github.io/docs/quick-start)
- Upstream Docker Hub link from the README: [Open-LLM-VTuber/open-llm-vtuber](https://hub.docker.com/r/Open-LLM-VTuber/open-llm-vtuber)
- Template icon: `open-llm-vtuber.png`, copied from [`avatars/shizuku.png`](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber/blob/main/avatars/shizuku.png)

## Cleanup

For a local test run from the parent monorepo worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/open-llm-vtuber/docker-compose.yml down
```

To remove the cached source volume as well:

```bash
docker compose -f templates/prebuilt/open-llm-vtuber/docker-compose.yml down -v
```
