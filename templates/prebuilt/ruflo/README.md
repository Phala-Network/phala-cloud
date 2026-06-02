# ruvnet/ruflo

Deploy a CPU-safe Ruflo CLI and MCP verifier on Phala Cloud.

## Metadata

- Template id: `ruflo`
- Display name: `ruvnet/ruflo`
- Category: AI Agents & Developer Tools
- Upstream repository: https://github.com/ruvnet/ruflo
- Upstream package: https://www.npmjs.com/package/ruflo
- Upstream Docker/runtime docs: https://github.com/ruvnet/ruflo/blob/main/ruflo/docs/DOCKER.md
- Icon source: upstream `ruflo/src/nginx/static/icon.svg`
- Upstream author: RuvNet / `ruvnet`

## Overview

Ruflo is an agent orchestration platform for Claude Code. The upstream README describes two main surfaces: a Claude Code plugin path and a full CLI install path through `npx ruflo@latest init`. It also documents a self-hostable RuFlo web UI under `ruflo/src/ruvocal/` with an MCP bridge and MongoDB.

This Phala Cloud template intentionally does not start the full chat UI by default because the upstream self-hosted UI is designed to proxy real model providers and expects provider API keys such as OpenAI, Google Gemini, or OpenRouter for production chat. Instead, the template runs a no-credential HTTP verifier that installs the real `ruflo` npm package, executes safe local CLI/MCP checks, and exposes JSON endpoints for smoke testing.

The `/demo` endpoint runs these local checks:

- `ruflo --version`
- `ruflo mcp tools --format json`
- `ruflo mcp exec -t swarm_init` with a two-slot mesh swarm in an ephemeral workspace
- `ruflo agent list --format json`

No external LLM provider, API key, browser authentication, model download, GPU, privileged mode, host networking, Docker socket, `env_file`, or host bind mount is used.

## Services

- `app`: Node.js HTTP server that installs the real Ruflo npm package into a named volume and exposes verifier endpoints.

## Ports

- `8080`: Public HTTP endpoint for readiness, demo, and model-list checks.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `RUFLO_VERSION` | No | `3.10.24` | Ruflo npm package version installed by the verifier service at container startup. |

The compose file also sets internal npm and runtime variables such as `RUFLO_INSTALL_DIR`, `NPM_CONFIG_OMIT=optional`, and `NO_COLOR=1` so the verifier starts quickly and avoids optional native/model-provider paths.

## Deploy

1. Deploy the `ruflo` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `RUFLO_VERSION` to another published Ruflo package version.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads JavaScript packages from npm into the named `ruflo-npm` volume. Restarts reuse that volume when the requested version has not changed.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the `ruflo` package is installed and the CLI responds to `ruflo --version`.
- `GET /demo`: Runs the local Ruflo CLI/MCP verifier and returns a compact transcript.
- `GET /v1/models`: Returns an OpenAI-style model list containing the local verifier endpoint. It is not an LLM model list.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

## Smoke Verification

Run locally from the parent monorepo worktree:

These commands verify the compose file, HTTP readiness endpoint, deterministic Ruflo demo endpoint, and OpenAI-style model-list endpoint.

```bash
docker compose -f templates/prebuilt/ruflo/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/ruflo/docker-compose.yml down
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "credentials_required": false,
  "cpu_only": true,
  "model_downloaded": false,
  "remote_calls": false,
  "demo": {
    "mcp_tools": {
      "sample_tools": ["agent_spawn", "agent_list", "swarm_init"]
    },
    "swarm": {
      "success": true,
      "topology": "mesh",
      "maxAgents": 2,
      "persisted": true
    },
    "agents": {
      "agents": [],
      "total": 0
    }
  }
}
```

The exact MCP tool count, generated swarm id, and timestamps can change with Ruflo package releases.

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/ruflo/docker-compose.yml config >/dev/null
```

## Production Notes

- This template is a verifier, not a production Ruflo chat deployment. It proves the real Ruflo package and local MCP primitives can run in a CPU-only Phala Cloud container without credentials.
- For production Ruflo CLI usage, follow the upstream full install path with `npx ruflo@latest init` or `npm install -g ruflo@latest`, then register the MCP server with Claude Code as documented upstream.
- For the upstream self-hosted web UI, use the upstream `ruflo/src/ruvocal/` and Docker documentation. That path needs production provider credentials such as `OPENAI_API_KEY`, `GOOGLE_API_KEY`, or `OPENROUTER_API_KEY`, plus normal public-origin, persistence, and authentication hardening.
- The verifier endpoints are unauthenticated. Add an authenticated reverse proxy before exposing private operational checks.
- Do not put secrets in the compose file. The default template clears common provider key variables before running the demo commands.
- Pin `RUFLO_VERSION` for reproducible deployments.

## Cleanup

For a local test run from the parent monorepo worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/ruflo/docker-compose.yml down
```
