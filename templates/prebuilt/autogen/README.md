# microsoft/autogen

Deploy a CPU-safe AutoGen package and agent-runtime smoke demo on Phala Cloud.

## Metadata

- Template id: `autogen`
- Display name: `microsoft/autogen`
- Category: Agent Frameworks & Orchestration
- Upstream repository: https://github.com/microsoft/autogen
- Upstream documentation: https://microsoft.github.io/autogen/
- Python packages: `autogen-core`, `autogen-agentchat`
- Icon source: AutoGen logo referenced by the upstream README, `https://microsoft.github.io/autogen/0.2/img/ag.svg`
- Upstream author: Microsoft, via the `microsoft/autogen` GitHub repository

## What This Template Runs

AutoGen is Microsoft's framework for building multi-agent AI applications. The upstream README currently points new users toward Microsoft Agent Framework for new projects, while AutoGen remains available for existing users and community-managed maintenance.

This template runs a minimal HTTP service on `python:3.11-slim-bookworm`. At startup it installs the real AutoGen Python packages, imports `autogen-core` and `autogen-agentchat`, then exposes JSON endpoints for smoke testing.

The `/demo` endpoint creates a deterministic local two-agent AutoGen Core runtime with `SingleThreadedAgentRuntime`, sends a task to a planner agent, sends the plan to a responder agent, and returns the transcript. It also imports `TextMessage` from AgentChat. No external LLM provider, API key, model download, GPU, privileged mode, host networking, Docker socket, `env_file`, or host bind mount is used.

## Services

- `app`: Python HTTP server that installs AutoGen packages and exposes the smoke-test API.

## Ports

- `8080`: Public HTTP endpoint for health, demo, and model-list checks.

## Environment Variables

No credentials are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `AUTOGEN_VERSION` | No | `0.7.5` | Version used for both `autogen-core` and `autogen-agentchat` at container startup. |

## Deploy

1. Deploy the `autogen` template on Phala Cloud.
2. Keep the default CPU-only resources for the smoke demo.
3. Optionally set `AUTOGEN_VERSION` to another published compatible AutoGen package version.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads Python wheels from PyPI. The template intentionally does not install `autogen-ext[openai]` or call any model provider because the required smoke path must run without credentials.

## Usage Endpoints

- `GET /healthz`: Returns `200` when AutoGen imports are available and the service is ready.
- `GET /demo`: Runs the deterministic two-agent AutoGen Core message exchange and returns the transcript.
- `GET /v1/models`: Returns a small OpenAI-style model list identifying the local deterministic smoke endpoint.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

## Smoke Verification

Run locally from the `sdks/` directory:

```bash
docker compose -f templates/prebuilt/autogen/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/autogen/docker-compose.yml down
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "model_downloaded": false,
  "model_loaded": false,
  "remote_calls": false,
  "demo": {
    "agents": ["planner", "responder"],
    "final": "AutoGen local agents completed: inspect -> respond"
  }
}
```

Template validation commands from the `sdks/` directory:

```bash
python templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/autogen/docker-compose.yml config >/dev/null
```

## Security Notes

- The demo endpoints are unauthenticated. Add an authenticated reverse proxy before adapting this template for private workflows.
- Do not put secrets in the compose file. This template does not need API keys or provider credentials.
- The container does not request GPU access, privileged mode, host networking, host bind mounts, Docker socket access, or an `env_file`.
- The runtime smoke path is deterministic and local. It does not download model weights or make remote model calls.
- Pin `AUTOGEN_VERSION` for reproducible deployments.

## Cleanup

For a local test run from `sdks/`, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/autogen/docker-compose.yml down
```
