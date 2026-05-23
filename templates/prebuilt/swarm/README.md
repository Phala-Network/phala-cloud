# OpenAI Swarm

Deploy a CPU-safe OpenAI Swarm framework demo on Phala Cloud.

## Metadata

- Template id: `swarm`
- Category: AI agent framework/API
- Upstream repository: https://github.com/openai/swarm
- Upstream source pinned in the container: `openai/swarm` commit `6af0b4caf37dca4526dfd98e9fbd8ce36e7eeb22`
- Template asset repository: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/swarm
- Icon source: `assets/logo.png` from the upstream OpenAI Swarm repository at commit `6af0b4caf37dca4526dfd98e9fbd8ce36e7eeb22`

## Overview

Swarm is OpenAI's experimental, educational multi-agent orchestration framework. It demonstrates lightweight primitives such as `Agent`, Python tool functions, handoffs between agents, and stateless orchestration around the Chat Completions API. The upstream README now points production users toward the OpenAI Agents SDK, but Swarm remains useful as a compact framework/package smoke target.

This Phala Cloud template runs a minimal HTTP service that imports the real pinned `swarm` package, verifies core symbols such as `Agent`, `Swarm`, `Response`, and `Result`, and exposes deterministic local demo endpoints. The demo constructs Swarm agents, a tool-function schema, a handoff, and a context update without calling OpenAI or any other model provider.

The container installs the pinned upstream Swarm source with only the runtime dependency needed by the imported core API (`openai==1.51.2`). No model weights are downloaded, no GPU is requested, and no external credentials are required.

## Services

- `app`: Python stdlib HTTP API exposed on container port `8000`.

## Ports

- `8000`: Public HTTP endpoint for health, demo, and OpenAI-compatible smoke checks.

## Environment Variables

No user-supplied environment variables are required.

This template intentionally avoids `OPENAI_API_KEY` or provider configuration so it can start on Phala Cloud with no external credentials. If you adapt it to run real Swarm conversations, add provider keys as Phala Cloud secret environment variables rather than hard-coding them into Compose.

## Deploy On Phala Cloud

1. Deploy the `swarm` prebuilt template from Phala Cloud.
2. Keep the default resources for the smoke demo.
3. Wait for the first build and startup to complete. The image downloads the pinned Swarm source archive and Python dependencies during the Docker build.
4. Open `https://<your-app-domain>/healthz` to confirm the package import and core symbols.

The deployment does not need host bind mounts, privileged mode, GPU access, Docker socket access, model downloads, or API keys.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the real `swarm` package imports and the core symbols are available.
- `GET /demo`: Returns deterministic local data showing an agent, tool schema, tool result, handoff, and context update. It does not call an LLM.
- `GET /v1/models`: Returns a local OpenAI-compatible model-list descriptor for smoke tests.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/healthz` fields include:

```json
{
  "ok": true,
  "status": "ready",
  "core_symbols_ready": true,
  "package": {
    "distribution": "swarm",
    "upstream_commit": "6af0b4caf37dca4526dfd98e9fbd8ce36e7eeb22"
  }
}
```

Expected `/demo` fields include:

```json
{
  "demo": {
    "llm_called": false,
    "external_network_called": false,
    "handoff": {
      "from": "Triage Agent",
      "to": "Review Agent"
    }
  }
}
```

## Local Smoke Verification

Run from the repository root:

```bash
docker compose -f templates/prebuilt/swarm/docker-compose.yml up -d --build
curl -fsS http://localhost:8000/healthz
curl -fsS http://localhost:8000/demo
curl -fsS http://localhost:8000/v1/models
docker compose -f templates/prebuilt/swarm/docker-compose.yml down
```

Template validation commands:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/swarm/docker-compose.yml config >/dev/null
```

## Resource Notes

The default template target is small and CPU-only:

- `1` vCPU
- `2048` MB memory
- `10` GB disk

The running service is a tiny Python HTTP process. Most resource use happens during image build while pip downloads and installs the pinned package source and dependencies. Real Swarm applications that call hosted models usually require network access to the selected provider and API credentials, but they do not require GPU hardware unless your adapted application adds local model inference.

## Security Notes

- The default deployment exposes unauthenticated smoke-test endpoints only. Add an authenticated reverse proxy before exposing private data or real orchestration workflows.
- No API keys, tokens, private keys, connection strings, or provider credentials are included.
- The demo never sends requests to OpenAI or third-party model providers.
- The Compose file does not use `env_file`, host bind mounts, privileged mode, host networking, or external build contexts.
- Keep the upstream Swarm commit pinned when changing this template so future builds remain predictable.
