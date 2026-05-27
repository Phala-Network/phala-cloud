# Block Goose

Deploy a CPU-safe Goose CLI verifier and recipe-validation demo on Phala Cloud.

## Metadata

- Template id: `goose`
- Display name: `Block Goose`
- Category: AI Coding Agents & Developer Tools
- Deployable template repository: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/goose
- Upstream repository requested for attribution: https://github.com/block/goose
- Current upstream home: https://github.com/aaif-goose/goose
- Upstream documentation: https://goose-docs.ai/docs/getting-started/installation
- Installed upstream release by default: `goose` CLI `v1.35.0`
- Icon source: `documentation/static/img/goose.svg` from the upstream Goose repository
- Upstream author attribution: Goose was founded by Block and is now stewarded by the Agentic AI Foundation (AAIF) at the Linux Foundation.

## Overview

Goose is a native open source AI agent for terminal workflows, coding tasks, automation, and agent integrations. The full Goose agent can use providers such as Anthropic, OpenAI, Google, Ollama, OpenRouter, Azure, Bedrock, and others, but those workflows require provider configuration or local model setup.

This Phala Cloud prebuilt template intentionally runs a credential-free verifier. It installs the real upstream Goose CLI binary with the official release installer, starts a small Python HTTP service, and exposes endpoints that prove the CLI is installed and can perform local Goose-specific checks without sending prompts to a hosted model.

## What This Template Runs

- `app`: a `python:3.11-slim-bookworm` container with a Python HTTP server on port `8080`.
- At startup, the container installs `curl`, `bzip2`, `tar`, CA certificates, and `libgomp1` if the base image does not already have them. `libgomp1` provides `libgomp.so.1`, which the Goose CLI requires on `python:3.11-slim-bookworm`.
- The startup command downloads the official Goose CLI installer from `aaif-goose/goose` releases and installs the pinned `GOOSE_VERSION` into a named volume at `/opt/goose/bin`.
- The HTTP service runs deterministic local checks:
  - `goose --version`
  - `goose info`
  - `goose recipe validate /smoke-recipe.yaml`

The smoke path does not require API keys, provider credentials, GPU access, browser authentication, hosted model calls, model downloads, private source code, host bind mounts, privileged mode, host networking, an external build context, or an `env_file`.

## Environment Variables

No credentials are required for `/healthz`, `/demo`, or `/v1/models`.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `GOOSE_VERSION` | No | `1.35.0` | Goose CLI release installed by the official upstream installer. The script normalizes this to `v1.35.0`. |
| `GOOSE_PROVIDER` | No | Empty | Optional provider name for manual production Goose sessions, for example `openai` or `anthropic`. The smoke endpoints do not use it. |
| `GOOSE_MODEL` | No | Empty | Optional model name for manual production Goose sessions. The smoke endpoints do not use it. |
| `OPENAI_API_KEY` | No | Empty | Optional OpenAI provider key for manual Goose use. Use a placeholder such as `<openai-api-key>` in documentation and a real secret only in Phala Cloud environment settings. |
| `OPENAI_HOST` | No | Empty | Optional OpenAI-compatible endpoint for manual Goose use, for example `<openai-compatible-base-url>`. |
| `ANTHROPIC_API_KEY` | No | Empty | Optional Anthropic provider key for manual Goose use. Use a placeholder such as `<anthropic-api-key>` in documentation and a real secret only in Phala Cloud environment settings. |
| `ANTHROPIC_HOST` | No | Empty | Optional Anthropic-compatible endpoint for manual Goose use, for example `<anthropic-compatible-base-url>`. |
| `GOOSE_DISABLE_KEYRING` | No | `1` | Forces file-based configuration behavior suitable for headless containers. |
| `GOOSE_TELEMETRY_ENABLED` | No | `false` | Keeps Goose telemetry disabled by default. |
| `GOOSE_DISABLE_SESSION_NAMING` | No | `true` | Avoids background session-title model calls during manual headless Goose usage. |
| `GOOSE_DISABLE_TOOL_CALL_SUMMARY` | No | `true` | Avoids per-tool-call summary model calls during manual headless Goose usage. |

The compose file also sets container paths such as `GOOSE_BIN_DIR`, `HOME`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, and `XDG_STATE_HOME` so Goose state stays inside named volumes.

## Deploy

1. Deploy the `goose` prebuilt template on Phala Cloud.
2. Keep the default CPU-only resource profile for the verifier path.
3. Leave all provider credentials empty for the default smoke demo.
4. Optionally set `GOOSE_VERSION` to another published Goose release, for example `1.35.0`.
5. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the Goose CLI release archive from GitHub and caches the binary in the `goose_bin` named volume. Changing `GOOSE_VERSION` causes the startup command to reinstall the requested version.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the Goose CLI is installed, `goose info` runs successfully, and the bundled Goose recipe validates.
- `GET /demo`: Runs the same local Goose-specific checks and returns a detailed JSON payload describing what was verified.
- `GET /v1/models`: Returns an OpenAI-style metadata-only model list for developer-agent template compatibility. It does not host or proxy a model.
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
  "cpu_only": true,
  "credentials_required_for_health": false,
  "remote_model_calls": false,
  "model_downloaded": false,
  "model_loaded": false,
  "what_ran": [
    "goose --version",
    "goose info",
    "goose recipe validate /smoke-recipe.yaml"
  ]
}
```

## Smoke Verification

Run locally from the `sdks/` directory:

```bash
docker compose -f templates/prebuilt/goose/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/goose/docker-compose.yml down
```

Template validation commands from the repository root:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/goose/docker-compose.yml config >/dev/null
```

## Security And Credential Notes

- The default HTTP endpoints are unauthenticated. Put an authenticated proxy in front of the service before exposing private workflows or operational controls.
- Do not put real API keys in the compose file or README. Configure optional provider credentials only through Phala Cloud environment settings.
- Provider credentials are optional and are not required for the template health or demo paths.
- The verifier does not run `goose run`, `goose session`, or `goose serve`, so it does not send prompts to any LLM provider.
- The compose file does not use host bind mounts, `env_file`, privileged mode, host networking, Docker socket mounts, external build contexts, GPU devices, or local machine paths.
- The container sets `GOOSE_DISABLE_KEYRING=1` for headless operation and `GOOSE_TELEMETRY_ENABLED=false` by default.
- Goose is a developer agent. Before adapting this verifier into a production agent endpoint, review upstream security guidance and restrict filesystem, network, extension, and credential access according to your threat model.

## Upstream Attribution

This template packages a verifier for the upstream Goose project. The repository requested for attribution is `block/goose`, whose README states that the project moved from Block to the Agentic AI Foundation at the Linux Foundation. Current upstream development is under `aaif-goose/goose`.

The template icon is copied from `documentation/static/img/goose.svg` in the upstream Goose repository. The Phala Cloud template assets live under the Phala prebuilt template path listed in the metadata above.

## Cleanup

For a local test run from `sdks/`, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/goose/docker-compose.yml down
```
