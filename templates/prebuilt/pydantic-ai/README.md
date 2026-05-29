# pydantic/pydantic-ai

Deploy a CPU-safe Pydantic AI deterministic agent demo on Phala Cloud.

## Metadata

- Template id: `pydantic-ai`
- Display name: `pydantic/pydantic-ai`
- Category: Agent Frameworks & Orchestration
- Upstream repository: https://github.com/pydantic/pydantic-ai
- Upstream documentation: https://ai.pydantic.dev/
- Python package: `pydantic-ai-slim`
- Icon source: `pydantic-ai.svg` is copied from the upstream repository asset `docs/img/pydantic-ai-light.svg`, also referenced by the upstream README
- Upstream author: Pydantic, via the `pydantic/pydantic-ai` GitHub repository

## Overview

Pydantic AI is a Python agent framework from the Pydantic team for building production-grade generative AI applications with typed dependencies, tools, structured outputs, model-provider integrations, evals, Logfire observability, MCP/A2A integrations, and durable execution options.

This template runs a small HTTP verifier on `python:3.12-slim-bookworm`. At startup it installs the official `pydantic-ai-slim` package, imports real Pydantic AI modules, disables non-test model requests, and exposes JSON endpoints for smoke testing.

The `/demo` endpoint constructs a real `Agent` with typed dependency injection, dynamic instructions, a function tool, `FunctionModel`, captured run messages, and structured Pydantic output. The model is deterministic local Python code, so the default deployment does not require provider credentials, call hosted LLMs, download model weights, request GPU access, use browser auth, mount host paths, or use privileged mode.

## Service

- `app`: Python HTTP demo service exposed on container port `8080`.

## Port

- `8080`: Public HTTP endpoint for health, local agent demo output, and an OpenAI-compatible model-list shape.

## Environment Variables

No credentials are required for the default demo.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PYDANTIC_AI_VERSION` | No | `1.103.0` | Pinned `pydantic-ai-slim` package version installed by the demo service at container startup. |

## Deploy

1. Deploy the `pydantic-ai` template on Phala Cloud.
2. Keep the default CPU-only resources for the smoke demo.
3. Optionally set `PYDANTIC_AI_VERSION` to another published compatible `pydantic-ai-slim` version.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads Python wheels from PyPI. After installation, the demo path is local and deterministic.

## Endpoints

- `GET /healthz`: Returns `200` when Pydantic AI imports are available and the service is ready.
- `GET /demo`: Runs the deterministic local Pydantic AI agent demo and returns structured output plus captured message metadata.
- `GET /demo?prompt=<text>`: Runs the same local demo with a custom user prompt.
- `GET /v1/models`: Returns an OpenAI-compatible model-list response describing the local deterministic smoke model.
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
  "remote_model_calls": false,
  "model_downloaded": false,
  "demo": {
    "model": "FunctionModel",
    "output": {
      "framework": "pydantic-ai",
      "deployment_target": "Phala Cloud tdx.small",
      "confidence": 90,
      "checks": [
        "typed agent",
        "dependency injection",
        "function tool",
        "structured output",
        "cpu-only phala template"
      ]
    }
  }
}
```

## Smoke Verification

Use these commands to verify the template locally without provider credentials:

Run locally from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/pydantic-ai/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/pydantic-ai/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/pydantic-ai/docker-compose.yml down
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/pydantic-ai/docker-compose.yml config >/dev/null
```

## Production Notes

- The default template is a verifier for the framework runtime, not a production LLM gateway.
- Real Pydantic AI applications typically configure providers such as OpenAI, Anthropic, Gemini, Bedrock, Groq, Mistral, or Ollama. Add only the provider extras and environment variables you actually use.
- Keep provider credentials in Phala Cloud environment variables or secrets. Do not hardcode API keys, tokens, private keys, OTPs, or passwords in `docker-compose.yml` or this README.
- If you switch from `pydantic-ai-slim` to the full `pydantic-ai` package, review dependency size, memory use, optional Logfire behavior, and provider packages before deploying on `tdx.small`.
- The demo endpoints are unauthenticated. Add an authenticated reverse proxy or application-layer auth before exposing private agent workflows.
- The compose file intentionally avoids host bind mounts, `env_file`, privileged mode, host networking, host IPC, Docker socket access, GPU devices, real secrets, browser authentication, hosted model calls, and model-weight downloads.

## Cleanup

For a local test run from the parent monorepo worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/pydantic-ai/docker-compose.yml down
```
