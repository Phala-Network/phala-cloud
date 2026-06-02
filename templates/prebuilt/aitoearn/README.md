# yikart/AiToEarn

Deploy a CPU-safe AiToEarn source verifier on Phala Cloud.

## Metadata

- Template id: `aitoearn`
- Display name: `yikart/AiToEarn`
- Category: AI Apps & Workflows
- Description: Let's use AI to Earn!
- Upstream repository: https://github.com/yikart/AiToEarn
- Upstream deployment docs inspected: `README_EN.md`, `DOCKER_DEPLOYMENT_EN.md`, upstream `docker-compose.yml`, backend/web/electron package manifests, and backend shared DTO/controller source files
- Default upstream source ref: `74e884f0e250b902097c355bf8fb55a9ed2c79a5`
- Icon source: upstream `project/aitoearn-electron/src/assets/logoAI.png` at commit `74e884f0e250b902097c355bf8fb55a9ed2c79a5`, saved in this templates repo as `templates/icons/aitoearn.png`
- Upstream author: `yikart`

## Overview

AiToEarn is an AI-powered content marketing and monetization platform for creators, brands, and businesses. The upstream project includes a Next.js web app, NestJS backend services, an AI service, an Electron application, MongoDB, Redis, and RustFS object storage. The upstream docs describe content creation, publishing, engagement, marketplace, Relay, MCP, OpenClaw, and Docker deployment paths.

The full upstream Docker deployment is a multi-service application. It expects MongoDB, Redis, RustFS, generated app secrets, optional Relay API credentials, optional LLM provider keys, and optional social-platform OAuth credentials. The upstream Compose file also mounts local source/config files such as `./project/...` and `./scripts/...`, which is not suitable for a Phala Cloud prebuilt template.

This template therefore runs a deterministic source verifier instead of the credentialed production stack. At startup it downloads the pinned upstream source tarball from GitHub, verifies required AiToEarn docs, Compose files, package manifests, shared DTO files, and backend source files, then exposes HTTP endpoints for smoke testing. It inspects the real upstream source artifact but does not start the full app, call providers, log into social platforms, run browser automation, download model weights, or require GPU.

## Services

- `app`: Python HTTP verifier service based on `python:3.12-slim-bookworm`.

The service uses the named Docker volume `aitoearn-cache` to cache the downloaded upstream source between restarts. It does not use host bind mounts, `env_file`, privileged mode, host networking, host IPC, real secrets, or an external build context.

## Ports

- `8080`: Public HTTP endpoint for health, source demo, and model-list style checks.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `AITOEARN_REF` | No | `74e884f0e250b902097c355bf8fb55a9ed2c79a5` | Git branch, tag, or commit downloaded from `yikart/AiToEarn` at startup. The default is the upstream `main` HEAD inspected for this template. |
| `PORT` | No | `8080` | HTTP port listened on inside the container and published by the Compose file. |

Production AiToEarn deployments can require values such as `RELAY_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, OAuth client IDs/secrets, SMTP credentials, SMS credentials, database passwords, `JWT_SECRET`, and `INTERNAL_TOKEN`. They are intentionally not required or consumed by this verifier. Add such values only when replacing the verifier with a full production AiToEarn deployment, and keep them in Phala Cloud environment variables or secret management rather than in the Compose file.

## Deploy

1. Deploy the `aitoearn` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `AITOEARN_REF` to a specific upstream tag, branch, or commit.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the upstream source tarball from GitHub. It does not install the upstream Node dependency graph because the default path is a source verifier, not a full AiToEarn production runtime.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the pinned upstream source has been downloaded and the required AiToEarn files are present.
- `GET /demo`: Returns deterministic source verification details, including upstream package metadata, supported channels parsed from the README, official Compose service names, production caveats, shared DTO/source primitive summaries, and sampled NestJS routes.
- `GET /v1/models`: Returns an OpenAI-style model list containing `aitoearn/no-llm-source-verifier`. This is a compatibility endpoint only; it does not host or call a model.
- `GET /upstream`: Returns the upstream repository, source ref, inspected docs, source checks, and caveats.
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
  "runtime_guards": {
    "credentials_required": false,
    "llm_provider_calls": false,
    "social_platform_calls": false,
    "browser_auth": false,
    "model_downloaded": false,
    "gpu_required": false
  },
  "upstream_caveats": {
    "official_compose_uses_host_source_files": true,
    "official_compose_default_passwords": true,
    "official_compose_placeholder_ai_keys": true,
    "social_oauth_documented": true
  }
}
```

## Smoke Verification

Use these commands to verify that the template starts cleanly and that the deterministic endpoints respond without provider credentials:

```bash
docker compose -f templates/prebuilt/aitoearn/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/aitoearn/docker-compose.yml down
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/aitoearn/docker-compose.yml config >/dev/null
```

## Production Notes

- The default template is a verifier, not the full AiToEarn product runtime.
- The upstream full Docker deployment publishes the web app through Nginx on port `8080` and runs internal services for web, server, AI, MongoDB, Redis, and RustFS.
- The upstream docs recommend 4 GB or more RAM for the complete Docker stack. This verifier is intended to start on small CPU-only Phala Cloud CVMs.
- For full content publishing, engagement, Relay, MCP, marketplace, or content generation workflows, configure the upstream application with stable secrets, database credentials, provider keys, Relay API key, and the required social-platform OAuth settings.
- Do not place real API keys, access tokens, passwords, private keys, OTPs, or social session credentials directly in the Compose file.
- A production Phala Cloud adaptation of the full upstream stack should avoid host bind mounts and local build contexts by using published images, named volumes, inline config, and deployment-time environment variables.
- Add authentication or private network controls before exposing a production AiToEarn backend that stores OAuth tokens, generated assets, user data, or provider credentials.

## Cleanup

For a local test run from the parent monorepo worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/aitoearn/docker-compose.yml down
```
