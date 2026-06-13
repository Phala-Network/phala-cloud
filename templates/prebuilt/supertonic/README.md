# supertone-inc/supertonic on Phala Cloud

This template runs a CPU-safe Supertonic package verifier behind a public Caddy proxy. The app installs the real `supertonic` Python package, imports the package and upstream constants, exercises deterministic utility functions, and exposes JSON endpoints for smoke testing.

The default deployment does not synthesize speech, does not instantiate `supertonic.TTS`, does not download Hugging Face model weights, does not call external model providers, does not require browser authentication, and does not require credentials. Supertonic's real TTS path is a local ONNX runtime, but the first synthesis or official server startup can download model assets; this template keeps that as an explicit production opt-in.

## Metadata

- Template id: `supertonic`
- Display name: `supertone-inc/supertonic`
- Category: AI Apps & Workflows
- Description: Lightning-Fast, On-Device, Multilingual TTS — running natively via ONNX.
- Upstream repo: `https://github.com/supertone-inc/supertonic`
- Upstream Python package repo: `https://github.com/supertone-inc/supertonic-py`
- Upstream documentation: `https://supertone-inc.github.io/supertonic-py/`
- Upstream author: `supertone-inc`
- Package: `supertonic==1.3.1`
- Python runtime: `python:3.12` from the `ghcr.io/astral-sh/uv:python3.12-bookworm-slim` image
- Icon source: upstream `docs/assets/images/logo_square.png` from the official `supertone-inc/supertonic-py` docs tree, linked from the main `supertonic` README, inspected at commit `908a56486e821e833a80530ff0cae3ad0b046fce`

## What This Template Runs

Supertonic is an on-device multilingual text-to-speech system powered by ONNX Runtime. The upstream README and Python docs show three important runtime facts:

- `pip install supertonic` installs the Python SDK.
- `TTS(auto_download=True)` and the first synthesis can download model assets from Hugging Face.
- `pip install 'supertonic[serve]' && supertonic serve --host 127.0.0.1 --port 7788` starts the official local HTTP server with `/v1/tts`, `/v1/audio/speech`, `/v1/styles`, `/v1/styles/import`, `/v1/tts/batch`, and `/docs`.

Those upstream paths are real local inference workflows. They normally need model storage for the downloaded ONNX assets and enough CPU/memory for the selected model. The default Phala Cloud template is therefore a verifier:

- Installs the real `supertonic` package artifact with `uv pip install "supertonic==${SUPERTONIC_PACKAGE_VERSION}"`.
- Imports the upstream package, `supertonic.config`, and `supertonic.utils`.
- Verifies package metadata, `TTS`, `Style`, `UnicodeProcessor`, model constants, 31-language support, and the `na` fallback language.
- Exercises the upstream `chunk_text()` and `sanitize_filename()` utility functions on deterministic demo text.
- Returns model metadata for `supertonic`, `supertonic-2`, and `supertonic-3` without downloading or loading their ONNX weights.

## Services

- `app`: internal Python HTTP service. At startup it installs the pinned `supertonic` package, imports real package symbols and constants, and serves JSON on port `8000`.
- `proxy`: public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

## Deploy

From this template directory:

```bash
docker compose config
docker compose up -d
```

On Phala Cloud, deploy the `supertonic` prebuilt template and open the public endpoint on port `8080`.

The first start downloads the pinned Python package and dependencies from PyPI. The template does not require a persistent volume.

## Environment Variables

The default template requires no credentials.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `SUPERTONIC_PACKAGE_VERSION` | `1.3.1` | No | Pinned Supertonic Python package version installed by the verifier service at startup. Override only when testing another compatible release. |
| `SUPERTONIC_DEMO_TEXT` | `Supertonic verifier running on Phala Cloud` | No | Text split by upstream utility functions and echoed by `/demo`. It is not synthesized into audio by the default template. |
| `APP_PORT` | `8000` | No | Internal verifier HTTP port. Caddy proxies to this port; the host only exposes `8080:80`. |

No API keys, Hugging Face tokens, passwords, OTPs, or private keys are required or consumed by the default verifier.

## Exposed Endpoints

The public HTTP API is available through Caddy on port `8080`.

- `GET /healthz`: Returns HTTP 200 when the installed `supertonic` package import and verifier checks pass.
- `GET /v1/health`: Alias with the same readiness payload shape as `/healthz`.
- `GET /demo`: Returns package metadata, deterministic utility output, an example official TTS request payload, and flags confirming that no model weights were downloaded or loaded.
- `GET /v1/models`: Returns an OpenAI-shaped model list for upstream Supertonic model ids, marked as metadata-only and not loaded.
- `GET /`: Returns service metadata and endpoint names.

Example:

```bash
curl -fsS http://localhost:8080/healthz | jq
curl -fsS http://localhost:8080/demo | jq
curl -fsS http://localhost:8080/v1/models | jq
```

## Smoke Verification

Run these smoke checks after deployment to verify the package artifact and endpoints:

```bash
docker compose ps
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo | jq '.package.import_ok, .model_downloaded, .model_loaded, .audio_generated'
curl -fsS http://localhost:8080/demo | jq '.package.checks.has_supertonic_3, .package.checks.has_na_language_fallback'
curl -fsS http://localhost:8080/v1/models | jq '.data[].id'
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `.package.import_ok` is `true`.
- `.model_downloaded`, `.model_loaded`, and `.audio_generated` are `false`.
- The verifier checks for `has_supertonic_3` and `has_na_language_fallback` are `true`.
- `/v1/models` includes `supertonic`, `supertonic-2`, and `supertonic-3`.

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/supertonic/docker-compose.yml config >/dev/null
```

## Production Notes

- To run real local synthesis, replace the verifier app with the official server path: `pip install 'supertonic[serve]'` and `supertonic serve --host 0.0.0.0 --port 7788`.
- The official server loads a model on startup and can download model assets on first use. Add a named volume for `~/.cache/supertonic3` or set `SUPERTONIC_CACHE_DIR` to a persistent path if you want restarts to reuse downloaded weights.
- The upstream server exposes native `POST /v1/tts`, OpenAI-compatible `POST /v1/audio/speech`, `GET /v1/styles`, `POST /v1/styles/import`, `POST /v1/tts/batch`, and interactive `/docs`.
- Supertonic 3 supports 31 language codes plus `na` for language-agnostic fallback. The built-in voice names are `M1` through `M5` and `F1` through `F5`; custom Voice Builder JSON files can be imported by the official server.
- CPU inference is supported through ONNX Runtime's `CPUExecutionProvider`, but real-time performance depends on the chosen CVM size, text length, quality steps, and concurrency. Size production CVMs with realistic synthesis load tests.
- Voice cloning and public TTS endpoints carry misuse risk. Add authentication, rate limits, consent workflows, logging controls, and abuse monitoring before exposing real speech generation publicly.

## Security Notes

- Only Caddy publishes a host port: `8080:80`.
- The app service is internal and uses `expose`, not `ports`.
- The template does not use privileged mode, host networking, host IPC, Docker socket mounts, host bind mounts, `env_file`, external build contexts, or external credentials.
- No secrets are baked into the compose file.
- The default runtime does not download model weights, instantiate `TTS`, synthesize speech, or make remote model/provider calls.

## Cleanup

```bash
docker compose down
```

No named volumes are created by this template.
