# OpenBMB/VoxCPM on Phala Cloud

This template runs a CPU-safe VoxCPM2 package/source verifier behind a public Caddy proxy. The app installs the real `voxcpm` Python distribution, inspects the installed source files and package metadata, and exposes JSON endpoints for smoke testing.

The default deployment does not synthesize speech, does not import the top-level `voxcpm` module, does not download Hugging Face or ModelScope model weights, does not call model providers, does not require browser authentication, and does not require credentials. VoxCPM's real text-to-speech path loads the PyTorch/audio stack and model snapshots such as `openbmb/VoxCPM2`; this template keeps that as an explicit production opt-in rather than a small-CVM default.

## Metadata

- Template id: `voxcpm`
- Display name: `OpenBMB/VoxCPM`
- Category: AI Apps & Workflows
- Upstream repo: `https://github.com/OpenBMB/VoxCPM`
- Upstream documentation: `https://voxcpm.readthedocs.io/en/latest/`
- Upstream author: `OpenBMB`
- Package: `voxcpm==2.0.3`
- Python runtime: `python:3.12` from the `ghcr.io/astral-sh/uv:python3.12-bookworm-slim` image
- Icon source: upstream `assets/voxcpm_logo.png` from `OpenBMB/VoxCPM`, referenced by the upstream README

## What This Template Runs

VoxCPM2 is a tokenizer-free TTS system for multilingual speech generation, voice design, controllable voice cloning, and transcript-guided cloning. The upstream README and docs show real synthesis through `VoxCPM.from_pretrained("openbmb/VoxCPM2")`, CLI commands such as `voxcpm design` and `voxcpm clone`, the local `app.py` Gradio demo, and production serving options through Nano-vLLM-VoxCPM and vLLM-Omni.

Those upstream runtime paths are real model-serving workflows. They normally need the PyTorch/audio dependency stack, model storage for the downloaded weights, and enough CPU/GPU resources for the selected backend. The default Phala Cloud template is therefore a verifier:

- Installs the real `voxcpm` package artifact with `uv pip install --no-deps voxcpm==${VOXCPM_PACKAGE_VERSION}`.
- Reads installed `voxcpm` source files and distribution metadata.
- Verifies that the package exports `VoxCPM`, declares the expected PyTorch/audio dependencies, contains `VoxCPM.from_pretrained()`, `generate()`, `generate_streaming()`, CLI entry point `voxcpm`, and runtime device-selection helpers.
- Returns metadata for `openbmb/VoxCPM2` without downloading or loading that model.

The verifier deliberately does not import `voxcpm` at the top level because upstream `voxcpm.__init__` imports `voxcpm.core`, and `voxcpm.core` imports the PyTorch model modules. A full import check should be part of a production model image or larger CVM deployment, not the no-credential small verifier.

## Services

- `app`: internal Python HTTP service. At startup it installs the pinned `voxcpm` package without dependencies, verifies the installed source and metadata, and serves JSON on port `8000`.
- `proxy`: public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

## Deploy

From this template directory:

```bash
docker compose config
docker compose up -d
```

On Phala Cloud, deploy the `voxcpm` prebuilt template and open the public endpoint on port `8080`.

The first start downloads the pinned `voxcpm` package artifact from PyPI. The template does not require a persistent volume.

## Environment Variables

The default template requires no credentials.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `VOXCPM_PACKAGE_VERSION` | `2.0.3` | No | Pinned VoxCPM Python package version installed by the verifier at startup. Override only when testing another compatible release. |
| `VOXCPM_DEMO_TEXT` | `VoxCPM2 package verifier running on Phala Cloud` | No | Text echoed by the `/demo` endpoint as verifier metadata. It is not synthesized into audio by the default template. |

No API keys, Hugging Face tokens, ModelScope tokens, passwords, OTPs, or private keys are required or consumed by the default verifier.

## Exposed Endpoints

The public HTTP API is available through Caddy on port `8080`.

- `GET /healthz`: Returns HTTP 200 when the installed `voxcpm` package metadata and source checks pass.
- `GET /demo`: Returns package metadata, verifier checks, upstream capabilities, and flags confirming that no model weights were downloaded or loaded.
- `GET /v1/models`: Returns an OpenAI-shaped model list containing a local `voxcpm/package-source-verifier` entry plus the upstream `openbmb/VoxCPM2` model id marked as not loaded.
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
curl -fsS http://localhost:8080/demo | jq '.artifact_verified, .model_downloaded, .model_loaded, .audio_generated'
curl -fsS http://localhost:8080/demo | jq '.verifier_checks.checks.has_from_pretrained, .verifier_checks.checks.has_generate_streaming'
curl -fsS http://localhost:8080/v1/models | jq '.data[].id'
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `.artifact_verified` is `true`.
- `.model_downloaded`, `.model_loaded`, and `.audio_generated` are `false`.
- The verifier checks for `has_from_pretrained` and `has_generate_streaming` are `true`.
- `/v1/models` includes `voxcpm/package-source-verifier` and `openbmb/VoxCPM2`.

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/voxcpm/docker-compose.yml config >/dev/null
```

## Production Notes

- Real VoxCPM2 synthesis uses `VoxCPM.from_pretrained("openbmb/VoxCPM2")` or an equivalent local model path. That call can download model weights and initialize the PyTorch/audio runtime.
- The upstream docs list Python 3.10 to 3.12, PyTorch 2.5 or newer, and optional CUDA 12.0 or newer for NVIDIA GPU acceleration. CUDA is not required for CPU inference, but CPU synthesis can be slow.
- Upstream production options include Nano-vLLM-VoxCPM for high-throughput serving and vLLM-Omni for an OpenAI-compatible `/v1/audio/speech` path. Size the CVM, disk, and accelerator resources for the backend you choose.
- The upstream Gradio `app.py` web demo requires a source checkout and real model loading. It is a useful reference for a custom production image, but it is not used by this no-model verifier.
- Voice cloning and realistic synthetic speech carry misuse risk. Add authentication, logging controls, consent workflows, watermarking or labeling policies, and abuse monitoring before exposing real speech generation publicly.

## Security Notes

- Only Caddy publishes a host port: `8080:80`.
- The app service is internal and uses `expose`, not `ports`.
- The template does not use privileged mode, host networking, host IPC, Docker socket mounts, host bind mounts, `env_file`, external build contexts, or external credentials.
- No secrets are baked into the compose file.
- The default runtime does not download model weights or make remote model/provider calls.

## Cleanup

```bash
docker compose down
```

No named volumes are created by this template.
