# Arize Phoenix

Deploy Arize Phoenix on Phala Cloud using the official `arizephoenix/phoenix` container image.

## Metadata

- Template id: `phoenix`
- Display name: `Arize-ai/phoenix`
- Category: LLM Observability, Evaluation & Testing
- Deployable template repository: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/phoenix
- Upstream repository: https://github.com/Arize-ai/phoenix
- Upstream Docker image: https://hub.docker.com/r/arizephoenix/phoenix
- Upstream documentation: https://arize.com/docs/phoenix
- Icon source: `docs/favicon.png` from the upstream Phoenix repository

## Overview

Phoenix is an open-source AI observability and evaluation platform from Arize AI. It provides tracing, datasets, experiments, evaluations, prompt iteration, and debugging workflows for LLM applications.

This Phala Cloud prebuilt template runs Phoenix as a single CPU-safe container with SQLite-backed persistence. It starts without OpenAI, Anthropic, or other model provider credentials, so the default deployment can be verified by loading the UI or calling the built-in health endpoint.

## What This Template Runs

- `phoenix`: the official `arizephoenix/phoenix:latest` image.
- HTTP UI and API on container port `6006`.
- OTLP HTTP trace ingestion on `6006` at `/v1/traces`.
- OTLP gRPC trace ingestion on container port `4317`.
- A named Docker volume `phoenix_data` mounted at `/mnt/data`.
- `PHOENIX_WORKING_DIR=/mnt/data`, so Phoenix stores its SQLite database and local app state in the named volume.

The compose file does not use host bind mounts, `env_file`, build contexts, privileged mode, host networking, GPU devices, or provider credentials.

## Deploy On Phala Cloud

1. Open Phala Cloud and choose the `phoenix` prebuilt template.
2. Keep the default CPU resource profile for a first deployment.
3. Leave provider credential variables unset. Phoenix does not need them to start or pass the smoke check.
4. Deploy the CVM.
5. Open the generated Phala Cloud endpoint for port `6006`.

The deployable assets for this template live under the Phala prebuilt path listed in the metadata section. Upstream Phoenix source and documentation remain attributed to Arize AI.

## Endpoints

- `GET /`: Phoenix web UI.
- `GET /healthz`: Phoenix health endpoint. This is the primary smoke endpoint.
- `POST /v1/traces`: OTLP HTTP trace ingestion endpoint on the same public HTTP port.
- gRPC OTLP trace ingestion: port `4317`.

After deployment, replace `<your-phala-app-domain>` with the generated Phala Cloud hostname for port `6006`:

```bash
curl -fsS https://<your-phala-app-domain>/healthz
curl -fsSI https://<your-phala-app-domain>/
```

Expected result: `/healthz` returns HTTP `200`, and `/` returns an HTML response for the Phoenix UI.

## Local Smoke Verification

From the `sdks/` directory:

```bash
docker compose -f templates/prebuilt/phoenix/docker-compose.yml up -d
curl -fsS http://localhost:6006/healthz
curl -fsSI http://localhost:6006/
docker compose -f templates/prebuilt/phoenix/docker-compose.yml down
```

The first startup may take longer while Docker pulls the official Phoenix image.

## Persistence

Phoenix defaults to SQLite when no external database is configured. This template sets `PHOENIX_WORKING_DIR=/mnt/data` and mounts the named volume `phoenix_data` at that path, which persists traces, datasets, experiments, evaluations, and other local Phoenix state across container restarts.

Do not replace the named volume with a host bind mount in this template. For production deployments with larger teams or stricter database operations, review the upstream PostgreSQL deployment docs and provide database credentials through Phala Cloud environment settings rather than committing them to compose files.

## Optional Environment Variables

No environment variables are required for startup or smoke verification.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PHOENIX_TELEMETRY_ENABLED` | No | `false` | Controls Phoenix product telemetry. This template disables it by default. |
| `PHOENIX_ALLOW_EXTERNAL_RESOURCES` | No | `true` | Allows the Phoenix web UI to load external resources such as fonts. Set to `false` for air-gapped deployments. |

Phoenix can use provider credentials for workflows that call hosted models, such as some evaluation and playground flows. Add those credentials only as user-supplied runtime environment variables or through Phoenix settings; they are not needed for deployment health and are intentionally absent from this template.

Phoenix authentication is disabled by default upstream. If you enable upstream authentication for production, generate fresh signing and admin credentials in a secret manager or Phala Cloud environment settings, then rotate the default admin account after first login.

## Upstream Attribution

This template packages the official Docker image for `Arize-ai/phoenix`: https://github.com/Arize-ai/phoenix

The Docker deployment pattern, ports, `PHOENIX_WORKING_DIR` persistence setting, and `/healthz` smoke endpoint are based on the upstream Phoenix documentation and repository. The template icon is copied from `docs/favicon.png` in the upstream Phoenix repository.

## Cleanup

For a local test run from `sdks/`, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/phoenix/docker-compose.yml down
```
