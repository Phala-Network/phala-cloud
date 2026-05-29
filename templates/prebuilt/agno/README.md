# agno-agi/agno

Deploy a CPU-safe Agno package verifier and local framework-primitives demo on Phala Cloud.

## Metadata

- Template id: `agno`
- Display name: `agno-agi/agno`
- Category: Agent Frameworks & Orchestration
- Upstream repository: https://github.com/agno-agi/agno
- Upstream documentation: https://docs.agno.com
- Python package: `agno`
- Icon source: Agno logo referenced by the upstream README, `https://agno-public.s3.us-east-1.amazonaws.com/assets/logo-light.svg`
- Upstream author: Agno, via the `agno-agi/agno` GitHub repository

## Overview

Agno is an SDK for building, running, and managing agent platforms. The upstream docs describe AgentOS as a FastAPI runtime for production APIs, sessions, memory, tracing, scheduling, RBAC, and integrations. Real agent runs normally require a configured model provider such as OpenAI or Anthropic, and the AgentOS examples install provider-specific packages and set API keys.

This template keeps the default deployment credential-free and CPU-safe. It runs a small HTTP service on `ghcr.io/astral-sh/uv:python3.12-bookworm-slim`, installs the real `agno` package from PyPI at startup, imports Agno framework modules, creates real `Function`, `Toolkit`, `Agent`, and `Team` objects, and executes only deterministic local tool entrypoints. It does not run an LLM-backed agent loop, download model weights, launch a browser, call hosted model APIs, mount host paths, or require a GPU.

## Services

- `app`: Python HTTP service that installs Agno and exposes local smoke-test endpoints.

## Ports

- `8080`: Public HTTP endpoint for health, demo, and model-list checks.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `AGNO_VERSION` | No | `2.6.9` | Agno Python package version installed by the verifier service at container startup. |
| `AGNO_TELEMETRY` | No | `false` | Keeps Agno telemetry disabled by default for the verifier. Upstream documents this variable for opting out. |

## Deploy

1. Deploy the `agno` template on Phala Cloud.
2. Keep the default CPU resources for the verifier.
3. Optionally set `AGNO_VERSION` to another published compatible Agno package version.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads Python wheels from PyPI. The template intentionally installs the base `agno` package and avoids `agno[os]` plus provider SDKs so the smoke path runs without model credentials.

## Usage Endpoints

- `GET /healthz`: Returns `200` when Agno imports are available and the service is ready.
- `GET /demo`: Creates local Agno tool, toolkit, agent, and team objects, runs deterministic tool entrypoints, and returns the framework metadata plus tool results.
- `GET /v1/models`: Returns an OpenAI-style model list identifying the local verifier placeholder. It does not represent a hosted LLM.
- `GET /`: Returns basic service metadata and the endpoint list.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

## Smoke Verification

Use these commands to verify the template starts, imports Agno, and serves the deterministic HTTP endpoints.

Run locally from the parent worktree:

```bash
docker compose -f templates/prebuilt/agno/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/agno/docker-compose.yml down
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "demo": {
    "cpu_only": true,
    "credentials_required": false,
    "model_downloaded": false,
    "model_loaded": false,
    "provider_calls": false,
    "framework_primitives": {
      "team_mode": "coordinate"
    }
  }
}
```

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/agno/docker-compose.yml config >/dev/null
```

## Production Notes

- The verifier endpoints are unauthenticated. Add an authenticated reverse proxy or use AgentOS RBAC before handling private data.
- This default template does not install `agno[os]`, `openai`, `anthropic`, or other provider packages. For a production AgentOS app, install the required extras and provider SDKs, configure a database, and pass model provider keys through Phala environment variables.
- Keep real API keys, JWT verification keys, bot tokens, database passwords, and private credentials out of the compose file. Store them as Phala deployment environment variables.
- AgentOS can expose many API endpoints, streaming, sessions, memories, knowledge, traces, scheduler, interfaces, and RBAC. The local verifier only proves that the upstream package imports and local framework primitives work in a CPU-only container.
- The container does not request privileged mode, host networking, host IPC, host bind mounts, a Docker socket, GPU devices, or an `env_file`.
- Pin `AGNO_VERSION` for reproducible deployments.

## Cleanup

For a local test run from the parent worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/agno/docker-compose.yml down
```
