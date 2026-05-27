# Cline CLI on Phala Cloud

## Overview

Cline is an open source AI coding agent for IDEs and terminals. This Phala Cloud template deploys a CPU-safe HTTP verifier for the real npm `cline` package from `https://github.com/cline/cline`.

The default container installs `cline@3.0.13`, reads package metadata, imports the installed `@cline/sdk` entrypoint, and runs `cline --version`. It does not start an agent session, perform browser authentication, call Anthropic, OpenAI, OpenRouter, Gemini, or other model providers, download models, require a GPU, or require provider credentials.

This makes the deployment suitable as a deterministic package readiness demo for small CPU-only Phala CVMs. Real Cline agent usage still requires user-provided model/provider credentials and workspace configuration after deployment.

## Metadata

- Template id: `cline`
- Display name: `Cline CLI`
- Category: AI Agents & Developer Tools
- Upstream repository: https://github.com/cline/cline
- Upstream author: `cline`
- npm package: `cline@3.0.13`
- Package repository metadata: `git+https://github.com/cline/cline.git`, directory `sdk/apps/cli`
- Runtime: `node:22-bookworm-slim`
- Public HTTP port: `3000`
- Icon source: upstream `assets/icons/icon.png` from https://github.com/cline/cline, saved as `templates/icons/cline.png`

## What This Template Runs

- `app`: A Node.js HTTP service on port `3000`.
- Startup command: installs the pinned npm `cline` package globally, then starts `/opt/cline-demo/server.mjs`.
- Health check: calls `GET /healthz` on the local service.

The service uses Docker Compose configs for the inline verifier script. It does not use host bind mounts, `env_file`, privileged mode, host networking, host IPC, Docker socket mounts, external build contexts, GPUs, or real secrets.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `cline` prebuilt template.
2. Keep the default CPU-safe resources unless you are extending the template for real interactive agent work.
3. Leave provider API keys empty for the default verifier deployment.
4. Optionally pin `CLINE_PACKAGE_VERSION` to another published npm version that still maps to `github.com/cline/cline`.
5. Open `https://<your-app-domain>/healthz` after startup completes.

The first boot can take a few minutes because npm installs the pinned package and its dependencies. After startup, the default endpoints are local package, import, and CLI checks only.

## Usage Endpoints

The HTTP API is available on port `3000`.

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Endpoints:

- `GET /healthz`: Returns HTTP 200 when package metadata, the `@cline/sdk` import, and `cline --version` are ready. It reports that provider credentials are not required for health and that no provider API calls were performed.
- `GET /demo`: Runs a fresh deterministic verifier and returns safe demo mode details plus upstream npm package facts such as package name, installed version, repository metadata, license, and CLI version.
- `GET /v1/models`: Returns an OpenAI-style model list with one local verifier model id, `cline-cli/local-verifier`. This is metadata only; no LLM is hosted.
- `GET /`: Returns a compact endpoint list and current readiness status.

Expected `/healthz` fields include:

```json
{
  "status": "ok",
  "cpu_only": true,
  "credentials_required_for_health": false,
  "provider_network_calls_performed": false,
  "readiness": {
    "package_metadata_ready": true,
    "import_ready": true,
    "cli_ready": true,
    "version_ready": true
  }
}
```

## Environment Variables

No environment variable is required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `CLINE_PACKAGE_VERSION` | No | `3.0.13` | Published npm `cline` package version installed at container startup. Override only when testing another compatible release. |
| `PORT` | No | `3000` | HTTP port used inside the container and exposed by the compose file. |
| `ANTHROPIC_API_KEY` | No | unset | Optional provider key for future real Cline workflows. The default `/healthz`, `/demo`, and `/v1/models` endpoints do not use it or pass it to `cline --version`. |
| `OPENAI_API_KEY` | No | unset | Optional OpenAI-compatible provider key for future real Cline workflows. Not used by the default verifier endpoints. |
| `OPENAI_BASE_URL` | No | unset | Optional OpenAI-compatible base URL for future custom provider workflows. Not used by the default verifier endpoints. |

Keep real credentials in Phala Cloud deployment environment variables or another secret manager. Do not bake API keys into this compose file, README, images, or source control.

## Verification And Smoke Tests

Run from the monorepo worktree root:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/cline/docker-compose.yml config >/dev/null
```

Optional local smoke test:

```bash
docker compose -f templates/prebuilt/cline/docker-compose.yml up -d
curl -fsS http://localhost:3000/healthz
curl -fsS http://localhost:3000/demo
curl -fsS http://localhost:3000/v1/models
docker compose -f templates/prebuilt/cline/docker-compose.yml down
```

Expected smoke results:

- `GET /healthz` returns `200 OK`.
- `.readiness.package_metadata_ready`, `.readiness.import_ready`, `.readiness.cli_ready`, and `.readiness.version_ready` are `true`.
- `/demo` reports `credentials_required: false`, `provider_network_calls_performed: false`, and `model_downloaded: false`.
- `/v1/models` includes `cline-cli/local-verifier`.

The verifier was designed around local checks that work without model-provider credentials: installed package metadata, `@cline/sdk` import readiness, and `cline --version`.

## Production Caveats

This template is a readiness and packaging demo, not a hosted multi-user coding agent service. To run real Cline agent sessions, add a workspace, authentication and authorization controls, a provider configuration, and user-provided LLM/provider credentials after deployment.

Review upstream Cline documentation before enabling headless or interactive agent workflows. Cline can edit files, run shell commands, browse, and call configured model providers, so production deployments should define a clear workspace boundary, approval policy, logging policy, and secret handling model.

The default endpoints are unauthenticated status endpoints. Put a protected reverse proxy in front of the service before exposing private workflow information or operational controls.

## Upstream Attribution

- Upstream project: https://github.com/cline/cline
- Upstream README describes Cline as an open source coding agent for IDEs and terminals and documents CLI installation with `npm i -g cline`.
- npm package: `cline`
- License in npm package metadata: `Apache-2.0`
- Icon: copied from upstream `assets/icons/icon.png` and saved as `templates/icons/cline.png`.
