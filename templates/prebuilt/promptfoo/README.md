# promptfoo/promptfoo

Deploy a CPU-safe promptfoo verifier on Phala Cloud.

## Overview

promptfoo is an open source CLI and library for evaluating prompts, agents, RAG systems, and LLM applications. This template provides a minimal HTTP service that installs the real `promptfoo` npm package at startup, verifies the installed package and CLI, and exposes a deterministic local smoke test.

The demo does not require provider credentials, does not download model weights, and does not request GPU access.

## Metadata

- Template id: `promptfoo`
- Display name: `promptfoo/promptfoo`
- Category: AI Evaluation & Red Teaming
- Upstream repository: https://github.com/promptfoo/promptfoo
- Upstream documentation: https://www.promptfoo.dev/docs/
- NPM package: https://www.npmjs.com/package/promptfoo
- Icon source: GitHub organization avatar fallback, `https://github.com/promptfoo.png`
- Upstream author: promptfoo, via the `promptfoo/promptfoo` GitHub repository

## What This Template Runs

The template runs one `node:22-bookworm-slim` service. At container startup it installs `promptfoo@$PROMPTFOO_VERSION` globally with npm, then starts a small Node HTTP server from the inline compose config.

Startup verification runs both:

- `npm list -g --depth=0 promptfoo --json`
- `promptfoo --version`

The `/demo` endpoint creates a temporary directory, writes an `assertions.yaml` file with deterministic `contains` assertions for `Phala Cloud` and `deterministic`, writes an `outputs.json` file with one matching local output, and runs:

```bash
promptfoo eval --assertions assertions.yaml --model-outputs outputs.json --no-cache --no-write --no-progress-bar --no-table --output result.json
```

The service parses `result.json` stats when promptfoo writes them, reports command output, and removes the temporary directory after each run. The demo path is local-only: no external LLM provider, API key, model download, GPU, privileged mode, host networking, Docker socket, `env_file`, or host bind mount is used.

## Services

- `app`: Node HTTP server that installs promptfoo and exposes readiness, demo, model-list, and upstream metadata endpoints.

## Ports

- `${PORT:-3000}`: Public HTTP endpoint for health, demo, and metadata checks.

## Environment Variables

No credentials are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PROMPTFOO_VERSION` | No | `0.121.12` | promptfoo npm package version installed globally at container startup. |
| `PORT` | No | `3000` | HTTP port exposed by the demo service. |

The compose file also sets promptfoo and npm non-interactive defaults such as `PROMPTFOO_DISABLE_TELEMETRY=true`, `PROMPTFOO_DISABLE_UPDATE=true`, `PROMPTFOO_DISABLE_SHARING=true`, `PROMPTFOO_DISABLE_SHARE_EMAIL_REQUEST=true`, `CI=true`, `NODE_ENV=production`, `NPM_CONFIG_UPDATE_NOTIFIER=false`, and `NPM_CONFIG_FUND=false`.

## Deploy

1. Deploy the `promptfoo` template on Phala Cloud.
2. Keep the default CPU-only resources for the smoke demo.
3. Optionally set `PROMPTFOO_VERSION` to another published promptfoo npm version.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the promptfoo package from npm. The template intentionally avoids provider examples and red-team scans that need API keys or remote model access.

## Endpoints

- `GET /healthz`: Returns `200` only when both startup checks pass.
- `GET /demo`: Runs the deterministic local promptfoo standalone assertion smoke test and returns JSON.
- `GET /v1/models`: Returns an OpenAI-compatible metadata-only model list with `promptfoo/local-eval-verifier`.
- `GET /upstream`: Returns upstream repository, package, documentation, and demo-scope links.
- `GET /`: Returns endpoint metadata and startup status.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
curl -fsS https://<your-app-domain>/upstream
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "demo": {
    "provider_credentials_required": false,
    "provider_credentials_used": false,
    "model_downloads": false,
    "gpu_required": false,
    "cpu_only": true,
    "network_model_calls": false,
    "local_eval": {
      "mode": "standalone assertions"
    }
  }
}
```

## Verification Commands

Run locally from the repository root:

```bash
python -m json.tool templates/config.json >/tmp/promptfoo-config-json-ok
docker compose -f templates/prebuilt/promptfoo/docker-compose.yml config >/tmp/promptfoo-compose-config.out
git diff --stat origin/main...HEAD
```

Optional local smoke run from the repository root:

```bash
docker compose -f templates/prebuilt/promptfoo/docker-compose.yml up -d
curl -fsS http://localhost:3000/healthz
curl -fsS http://localhost:3000/demo
curl -fsS http://localhost:3000/v1/models
docker compose -f templates/prebuilt/promptfoo/docker-compose.yml down
```

## Production Caveats

- This is a smoke-test template, not a production promptfoo results service.
- The demo does not persist eval results. `--no-write` is used and temporary files are removed after each request.
- Real promptfoo evals usually compare prompts and providers. Add provider credentials only through the deployment environment when adapting the template for private workloads.
- Pin `PROMPTFOO_VERSION` for reproducible deployments.
- Add persistent storage if you later run promptfoo modes that need durable configuration, datasets, or reports.

## Security Notes

- The demo endpoints are unauthenticated. Add an authenticated reverse proxy before exposing private eval workflows.
- Do not put real API keys, access tokens, or provider credentials in the compose file or README examples.
- The container does not request GPU access, privileged mode, host networking, host bind mounts, Docker socket access, or an `env_file`.
- The bundled smoke path is deterministic and local. It does not download model weights or call external model providers.
- Review promptfoo provider and red-team settings carefully before enabling scans against internal systems.

## Cleanup

For a local test run from the repository root, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/promptfoo/docker-compose.yml down
```
