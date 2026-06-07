# fathah/hermes-desktop on Phala Cloud

## Overview

Hermes Desktop is a native Electron desktop companion for installing, configuring, and chatting with Hermes Agent. The upstream app manages local or remote Hermes Agent connections, provider setup, chat, sessions, profiles, memory, skills, tools, schedules, messaging gateways, and related desktop workflows.

This Phala Cloud template runs a CPU-safe HTTP verifier for the upstream source instead of launching the desktop GUI. At startup it downloads the real `fathah/hermes-desktop` GitHub source tarball pinned by `HERMES_DESKTOP_REF`, parses the upstream package metadata, verifies desktop/runtime source markers, and exposes smoke-test endpoints.

The default path does not start Electron, run the Hermes installer, call LLM providers, perform browser authentication, download model weights, or require credentials.

## Metadata

- Template ID: `hermes-desktop`
- Display name: `fathah/hermes-desktop`
- Category: AI Agents & Developer Tools
- Upstream repository: `https://github.com/fathah/hermes-desktop`
- Description: Desktop Companion for Hermes Agent
- Default resources: 1 vCPU, 1024 MB memory, 10 GB disk

## Upstream Runtime Notes

The upstream README describes Hermes Desktop as a native desktop app for Hermes Agent. It supports:

- Local mode, where the desktop app installs or uses Hermes under `~/.hermes` and talks to `http://127.0.0.1:8642`.
- Remote mode, where the desktop app talks to a remote Hermes API URL plus API key.
- SSH tunnel mode, documented in `docs/SSH-TUNNEL-VPS.md`, where the desktop forwards a local port to a remote Hermes Agent running on `127.0.0.1:8642`.

Because Phala Cloud deployments are headless CVMs, this template provides the closest honest verifier: a small HTTP service that checks the real upstream source artifact and reports what the desktop runtime would need. For a production Hermes backend on Phala Cloud, use the `hermes-agent` template and connect the desktop app to that API endpoint.

## Services And Ports

- `hermes-desktop`: Python 3.11 HTTP verifier for the upstream Hermes Desktop source artifact.
- Public port: `8080`
- Container port: `8080`

No proxy sidecar is used because the verifier exposes one small HTTP service directly on port `8080`.

## Environment Variables

The default verifier has no required secrets.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `HERMES_DESKTOP_REF` | No | `2c2ee24928fa017971ee057c36870be508578cb0` | Upstream `fathah/hermes-desktop` git ref downloaded from the GitHub source tarball API at startup. The default is the inspected `main` commit. |
| `PORT` | No | `8080` | HTTP port inside the container. The Compose file maps `8080:8080` by default. |

Do not place real API keys, tokens, private keys, OTPs, or passwords in `docker-compose.yml` or this README. If you extend this verifier into a real Hermes Agent backend, provide secrets through Phala Cloud environment variables or another secret-management path.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `hermes-desktop` prebuilt template.
2. Keep the default resources for the verifier.
3. Leave all provider credentials unset.
4. Deploy the CVM.
5. Open the generated public endpoint for port `8080`.

The first startup downloads the pinned public GitHub source tarball and extracts it under `/tmp`. It should stay lightweight on `tdx.small` because it does not install npm dependencies or run Electron.

## Exposed Endpoints

Set the base URL to your Phala Cloud endpoint:

```bash
export HERMES_DESKTOP_URL=https://<your-app-domain>
```

Health check:

```bash
curl -fsS "$HERMES_DESKTOP_URL/healthz"
```

Source verifier report:

```bash
curl -fsS "$HERMES_DESKTOP_URL/demo"
```

OpenAI-compatible model-list shape for client smoke checks:

```bash
curl -fsS "$HERMES_DESKTOP_URL/v1/models"
```

Expected `/v1/models` response shape:

```json
{
  "object": "list",
  "data": [
    {
      "id": "hermes-desktop/source-verifier",
      "object": "model",
      "owned_by": "fathah"
    }
  ]
}
```

This is metadata only. It does not host chat completions, embeddings, model inference, or a Hermes Agent API server.

## Local Smoke Verification

Use these commands from this template directory to verify the Compose file and HTTP smoke endpoints:

```bash
docker compose config
docker compose up -d
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS http://127.0.0.1:8080/demo
curl -fsS http://127.0.0.1:8080/v1/models
docker compose down
```

A healthy deployment returns HTTP `200` from all three endpoints. `/demo` should report `source_ok: true`, the upstream package name `hermes-desktop`, the pinned source ref, and safety flags showing no provider calls, no browser auth, no model downloads, no Electron GUI, and no Hermes installer run.

## Production Notes

- This template is a verifier for the Hermes Desktop source artifact, not a remote desktop session or a hosted Electron GUI.
- Hermes Desktop is intended to run on a user's workstation. It can connect to a remote Hermes Agent API server or SSH tunnel into a host running Hermes Agent.
- To run the actual Hermes Agent backend on Phala Cloud, deploy the `hermes-agent` prebuilt template. That template exposes the Hermes API server on port `8642` and can enable the dashboard on port `9119`.
- Real Hermes Agent usage can require provider credentials such as OpenRouter, Anthropic, OpenAI, Google, xAI, Nous Portal, Qwen, MiniMax, Hugging Face, Groq, or local OpenAI-compatible endpoints. This verifier intentionally does not accept or use those credentials.
- Real desktop local mode may run the official Hermes installer and manage files under `~/.hermes`. That workflow is interactive and host-specific, so it is not suitable as a default Phala Cloud prebuilt smoke path.
- The upstream Linux desktop packages are Electron packages such as AppImage, `.deb`, and `.rpm`; they are not a headless server image.

## Security Notes

- The Compose file uses no host bind mounts, no `env_file`, no external build context, no privileged mode, no host network, no host IPC, and no real secrets.
- The service drops `NET_RAW` and `NET_ADMIN` and sets `no-new-privileges`.
- The verifier downloads only the upstream public GitHub source tarball. It does not download model weights or call provider APIs.
- The public API reports source metadata and safety flags only. It does not echo secret values.

## Icon Source

The template icon is `templates/icons/hermes-desktop.png`, downloaded from the upstream repository asset `resources/icon.png`.

Source URL:

```text
https://raw.githubusercontent.com/fathah/hermes-desktop/main/resources/icon.png
```

## Attribution

- Upstream project: `fathah/hermes-desktop`
- Upstream repository: `https://github.com/fathah/hermes-desktop`
- License: MIT, as published in the upstream repository.
- Related backend project: `https://github.com/NousResearch/hermes-agent`
