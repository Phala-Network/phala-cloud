# colbymchenry/codegraph

Deploy a CPU-safe CodeGraph verifier on Phala Cloud.

## Overview

CodeGraph is a local code-intelligence and knowledge-graph tool for AI coding agents. It indexes a project into a `.codegraph/` SQLite database, then exposes fast symbol search, call graph, context-building, impact analysis, and MCP tools for Claude Code, Codex, Gemini, Cursor, OpenCode, AntiGravity, Kiro, and Hermes Agent.

This template does not run a hosted LLM, browser auth flow, IDE extension, or training stack. It installs the real `@colbymchenry/codegraph` npm package, creates a small bundled TypeScript project, runs `codegraph init -i`, and serves deterministic HTTP endpoints that exercise the CodeGraph CLI locally.

No external model provider, API key, GPU, model weight download, privileged mode, host networking, host bind mount, Docker socket, or `env_file` is used.

## Metadata

- Template id: `codegraph`
- Display name: `colbymchenry/codegraph`
- Category: AI Apps & Workflows
- Description: Pre-indexed code knowledge graph for Claude Code, Codex, Gemini, Cursor, OpenCode, AntiGravity, Kiro, and Hermes Agent — fewer tokens, fewer tool calls, 100% local
- Upstream repository: https://github.com/colbymchenry/codegraph
- Upstream documentation: https://colbymchenry.github.io/codegraph/
- npm package: https://www.npmjs.com/package/@colbymchenry/codegraph
- Icon source: upstream `site/public/favicon.svg` from https://github.com/colbymchenry/codegraph/blob/main/site/public/favicon.svg
- Upstream author: Colby McHenry / `colbymchenry`

## What This Template Runs

- `app`: A `node:24-bookworm-slim` HTTP service.
- On startup, the service installs `@colbymchenry/codegraph` with npm.
- The service writes a tiny TypeScript checkout sample under `/workspace/codegraph-demo`.
- The service runs `codegraph init -i` to build the local `.codegraph/` index.
- Runtime checks use `codegraph status --json`, `codegraph files --json`, `codegraph query --json`, `codegraph callers --json`, `codegraph callees --json`, `codegraph impact --json`, and `codegraph context`.

The default project is intentionally small so it starts on a CPU-only `tdx.small` deployment and verifies CodeGraph without credentials or external agent tooling.

## Ports

- `8080`: Public HTTP endpoint for health, demo, and model-list checks.

## Environment Variables

No credentials are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `CODEGRAPH_PACKAGE_VERSION` | No | `0.9.7` | Pinned `@colbymchenry/codegraph` npm package version installed by the demo service at container startup. |
| `CODEGRAPH_DEMO_QUERY` | No | `cart checkout flow` | Task string passed to `codegraph context` by the `/demo` endpoint. |

## Deploy

1. Deploy the `codegraph` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `CODEGRAPH_PACKAGE_VERSION` to another published package version.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the npm package from the npm registry. The service then builds the local demo index and starts the HTTP wrapper.

## Usage Endpoints

- `GET /healthz`: Returns `200` when CodeGraph installed, indexed the local sample, and the wrapper is ready.
- `GET /demo`: Runs deterministic local CodeGraph checks against the bundled sample project and returns JSON with index status, files, symbol search, callers, callees, impact analysis, and a context preview.
- `GET /v1/models`: Returns an OpenAI-style metadata list for compatibility checks. This is not an LLM model endpoint.
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
  "cpuOnly": true,
  "remoteModelCalls": false,
  "modelDownloaded": false,
  "symbolSearch": {
    "search": "Cart"
  },
  "contextPreview": {
    "containsCheckoutSummary": true
  }
}
```

## Smoke Verification

Run locally from the parent worktree to verify the template:

```bash
docker compose -f templates/prebuilt/codegraph/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/codegraph/docker-compose.yml down
```

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/codegraph/docker-compose.yml config >/dev/null
```

## Production Notes

- The HTTP server in this template is a verifier, not the upstream MCP transport. CodeGraph's agent integration is the stdio MCP server launched with `codegraph serve --mcp`.
- The template does not configure Claude Code, Codex, Gemini, Cursor, OpenCode, AntiGravity, Kiro, or Hermes Agent. For production agent use, follow the upstream installer or MCP configuration docs.
- To index a real private repository on Phala Cloud, adapt the image or startup command to fetch or include the repository inside the container. Do not rely on host bind mounts.
- Add repository credentials only through Phala environment configuration, keep them as placeholders in template metadata, and avoid writing secrets into compose files or READMEs.
- Pin `CODEGRAPH_PACKAGE_VERSION` for reproducible deployments.
- The demo endpoints are unauthenticated. Add an authenticated reverse proxy before exposing private code intelligence APIs.

## Cleanup

For a local test run from the parent worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/codegraph/docker-compose.yml down
```
