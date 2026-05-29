# ComposioHQ/composio

Deploy a CPU-safe Composio Python package verifier on Phala Cloud.

## Overview

Composio is a toolkit platform for connecting AI agents and applications to external tools, integrations, auth flows, and hosted tool execution. This prebuilt template does not run the hosted Composio platform. It runs a minimal local HTTP verifier that installs the real PyPI package `composio==0.13.1`, imports it as `composio`, verifies package metadata and key exports, then constructs and executes a deterministic local `CustomTool` with a Pydantic input model.

The verifier intentionally does not call hosted Composio APIs, external model providers, or integration providers. It also does not instantiate `Composio()` without credentials. Instead, the `/demo` response reports that hosted `Composio()` client calls require credentials and verifies that policy by inspecting the installed package's constructor and `ApiKeyNotProvidedError` export.

## Metadata

- Template id: `composio`
- Display name: `ComposioHQ/composio`
- Category: AI Agents / Developer Tools / Automation
- Upstream repository: https://github.com/ComposioHQ/composio
- Upstream documentation: https://docs.composio.dev/
- Python package: https://pypi.org/project/composio/0.13.1/
- Icon source: upstream default branch `next`, `docs/public/Composio Logo.svg`
- Upstream author: ComposioHQ, via the `ComposioHQ/composio` GitHub repository
- Phala prebuilt source: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/composio

## What This Template Runs

The compose file starts one public service:

- `app`: Python 3.12 container based on `ghcr.io/astral-sh/uv:python3.12-bookworm-slim`. On startup it installs `composio==$COMPOSIO_VERSION` from PyPI, then serves a local JSON API on port `8080`.

The local verifier checks:

- The installed PyPI distribution is importable as `composio`.
- The package exposes `Composio`, `CustomTool`, and `ApiKeyNotProvidedError`.
- A local `CustomTool` can be constructed with a Pydantic input model.
- The local `CustomTool` can validate deterministic input and execute a local Python function.
- Hosted Composio client calls require credentials, while the default verifier path makes no hosted calls.

## What This Template Does Not Run

The default deployment does not require or use:

- Composio API keys or hosted Composio sessions
- External provider credentials
- Hosted model calls
- Model downloads or local model weights
- GPU access
- Host bind mounts
- Docker socket access
- Privileged mode or host networking
- `env_file`
- External Docker build context

The only network access needed by the default startup path is downloading the pinned Python package and dependencies from PyPI.

## Endpoints

- `GET /healthz`: Returns `200` with `status: "ok"` only when the real package import and local `CustomTool` smoke test both pass.
- `GET /demo`: Returns deterministic local tool execution evidence, including `credentials_required_for_hosted_calls: true`, `remote_calls: false`, and `cpu_only: true`.
- `GET /v1/models`: Returns an OpenAI-style compatibility list with one local demo id, `composio/local-tool-demo`.
- `GET /upstream`: Cites the upstream repository, documentation, PyPI package, icon source, and Phala template path.
- `GET /`: Same readiness payload as `/healthz`.

Example endpoint checks:

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
  "credentials_required_for_hosted_calls": true,
  "remote_calls": false,
  "cpu_only": true,
  "model_downloaded": false,
  "custom_tool_smoke": {
    "ok": true,
    "tool": {
      "slug": "local_tool_demo",
      "input_model": "LocalToolInput"
    },
    "output": {
      "normalized": "phala cloud composio customtool smoke",
      "remote_calls": false
    }
  }
}
```

Expected `/v1/models` shape:

```json
{
  "object": "list",
  "data": [
    {
      "id": "composio/local-tool-demo",
      "object": "model",
      "owned_by": "ComposioHQ"
    }
  ]
}
```

## Environment Variables

No credentials are required for the bundled smoke demo.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `COMPOSIO_VERSION` | No | `0.13.1` | Version of the real `composio` PyPI package installed at container startup. |

If you adapt this template for hosted Composio integrations, provide credentials through Phala Cloud secrets or environment variables and add authentication to your public endpoint. Do not hard-code real tokens in the compose file, README, or application code.

## Deploy

1. Deploy the `composio` prebuilt template on Phala Cloud.
2. Keep the default CPU-only resource profile for the local verifier: 1 vCPU, 1024 MB memory, and 10 GB disk.
3. Optionally set `COMPOSIO_VERSION` to another published package version after reviewing upstream changes.
4. After startup completes, open `https://<your-app-domain>/healthz`.

## Local Smoke Commands

Run from the `sdks/` directory:

```bash
python3 templates/validate.py
docker compose -f templates/prebuilt/composio/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/composio/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/upstream
docker compose -f templates/prebuilt/composio/docker-compose.yml down
```

The first local startup downloads Python wheels from PyPI.

## Production Caveats

- The demo API is unauthenticated. Add an authenticated reverse proxy or application-level auth before exposing private workflows.
- The bundled verifier is intentionally local and deterministic. It proves package import and `CustomTool` execution, not hosted Composio account connectivity.
- Real Composio integrations may require hosted Composio credentials, third-party provider credentials, webhooks, and outbound network policy review.
- The compose file does not mount host paths, use `env_file`, request privileged mode, use host networking, mount the Docker socket, or define credentials.
- Pin `COMPOSIO_VERSION` for reproducible deployments, and review upstream release notes before changing it.

## Upstream Attribution

Composio is developed by ComposioHQ in the `ComposioHQ/composio` repository: https://github.com/ComposioHQ/composio.

The icon saved as `templates/icons/composio.svg` is the upstream Composio logo from the `next` branch at `docs/public/Composio Logo.svg`.
