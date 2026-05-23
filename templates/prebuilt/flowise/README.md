# FlowiseAI/Flowise on Phala Cloud

Deploy Flowise on Phala Cloud using the official `flowiseai/flowise:latest` Docker image.

Flowise is a low-code visual builder for AI agents, chatflows, and LangChain/LlamaIndex-style LLM orchestration. This template runs the Flowise HTTP app as a self-contained CPU deployment with local SQLite-backed state and a persistent Docker volume. It does not bundle a model, download model weights, or require hosted LLM provider credentials at startup.

## Metadata

- Template id: `flowise`
- Display name: `FlowiseAI/Flowise`
- Category: LLM Application Platforms & Low-Code Builders
- Upstream repository: https://github.com/FlowiseAI/Flowise
- Upstream Docker image: `flowiseai/flowise:latest`
- Upstream Docker Compose reference: https://github.com/FlowiseAI/Flowise/blob/main/docker/docker-compose.yml
- Upstream license: Apache-2.0 for most source, with commercial-license portions documented in upstream `LICENSE.md`
- Template icon: `flowise.png`, copied from upstream `assets/FloWiseAI_primary.png`

## What This Template Runs

- `flowise`: the Flowise server and web UI, exposed on container and host port `3000`.

The default deployment uses Flowise's local file paths under `/root/.flowise` for the database, generated secret-key material, logs, and local blob storage. Flowise can start without OpenAI, Anthropic, Google, or other model-provider credentials; add those credentials later inside the Flowise UI when you create credentials and workflows.

## Ports

- `3000`: Public HTTP endpoint for the Flowise web app and API.

On Phala Cloud, open:

```bash
https://<your-app-domain>
```

For local Compose testing:

```bash
http://localhost:3000
```

## Environment Variables

No external LLM credentials are required for the container to boot.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `FLOWISE_LOG_LEVEL` | No | `info` | Flowise log level. |
| `DISABLE_FLOWISE_TELEMETRY` | No | `true` | Disables Flowise telemetry by default. |
| `SHOW_COMMUNITY_NODES` | No | `false` | Hides community nodes by default for a smaller, more conservative first deployment. |
| `FLOWISE_FILE_SIZE_LIMIT` | No | `50mb` | Maximum uploaded file size accepted by Flowise. |
| `SECURE_COOKIES` | No | `true` | Keeps auth cookies marked secure for the HTTPS Phala Cloud app endpoint. |
| `TRUST_PROXY` | No | `true` | Lets Flowise trust the Phala Cloud HTTPS reverse proxy. |

The compose file also sets these fixed local paths:

- `DATABASE_PATH=/root/.flowise`
- `SECRETKEY_STORAGE_TYPE=local`
- `SECRETKEY_PATH=/root/.flowise`
- `STORAGE_TYPE=local`
- `BLOB_STORAGE_PATH=/root/.flowise/storage`
- `LOG_PATH=/root/.flowise/logs`

`APP_URL` is derived from `DSTACK_APP_DOMAIN` when Phala Cloud injects it, falling back to `https://localhost` for static Compose validation.

## Persistent Data

The template creates one named Docker volume:

- `flowise_data`: mounted at `/root/.flowise`

This volume stores Flowise's local database, generated encryption/auth secret files, uploaded files, local blob storage, logs, and other app state. Keep the volume across redeploys. Replacing it can remove chatflows, credentials metadata, generated local secrets, and uploaded assets.

## Deploy On Phala Cloud

1. Select the `flowise` prebuilt template.
2. Keep the default resources for the first deployment: 2 vCPU, 4 GB memory, and 40 GB disk.
3. Optionally adjust non-secret settings such as `FLOWISE_FILE_SIZE_LIMIT` or `SHOW_COMMUNITY_NODES`.
4. Deploy the template.
5. Open `https://<your-app-domain>` and complete Flowise's first-run setup or sign in if the instance already has users.
6. Configure model-provider credentials from the Flowise credentials UI before running chatflows or agents that call external LLMs.

## Verification

Flowise exposes a lightweight ping endpoint that does not require LLM provider credentials:

```bash
curl -fsS https://<your-app-domain>/api/v1/ping
```

Expected response:

```text
pong
```

The container healthcheck probes the same endpoint inside the container:

```bash
curl -fsS http://127.0.0.1:3000/api/v1/ping
```

For local repository validation from the `sdks` directory:

```bash
docker compose -f templates/prebuilt/flowise/docker-compose.yml config >/dev/null
```

## Smoke-Test Expectations

A successful smoke test should confirm:

- The `flowiseai/flowise:latest` image starts on CPU without provider credentials.
- `GET /api/v1/ping` returns `pong`.
- The web UI loads at the generated Phala Cloud endpoint.
- The `flowise_data` named volume is present and mounted at `/root/.flowise`.

The default template does not execute chatflows, call external LLM APIs, run a worker queue, connect to Redis/Postgres/S3, request GPU devices, use host networking, use host bind mounts, use `env_file`, or build from an external context.

## Production Hardening

- Add authentication and create users before exposing sensitive workflows or credentials to a shared audience. Follow the current Flowise auth documentation for your deployed version.
- Keep `flowise_data` stable. The default local secret-key storage is intentionally inside the persistent volume.
- For larger or team deployments, consider moving from local SQLite/storage to managed Postgres and object storage using Flowise's documented `DATABASE_*` and storage environment variables.
- If you externalize auth or encryption secrets, define them as Phala Cloud environment variables or secrets and generate long random values. Do not hardcode secrets in Compose, README examples, or source files.
- Review CORS, iframe origins, OAuth callback domains, SMTP, and workspace-invite settings before enabling public integrations.
- Size CPU, memory, disk, database, object storage, and provider-rate limits together before running high-traffic agents, document ingestion, or custom tool workflows.

## Upstream Attribution

Flowise is developed by FlowiseAI:

- Repository: https://github.com/FlowiseAI/Flowise
- Documentation: https://docs.flowiseai.com/
- Docker image: https://hub.docker.com/r/flowiseai/flowise
- License file: https://github.com/FlowiseAI/Flowise/blob/main/LICENSE.md

This Phala Cloud template only packages a deployment configuration for the upstream Flowise application and preserves upstream FlowiseAI attribution in the template metadata.
