# IronClaw on Phala Cloud

IronClaw is an AI agent runtime from NEAR AI. This template runs the official `nearaidev/ironclaw:latest` image with its HTTP gateway enabled, Postgres/pgvector for production storage, and persistent IronClaw state in a Docker volume. The image tag intentionally tracks upstream IronClaw `latest`/rolling template behavior; fork or pin the image digest if you need a fixed release.

The Phala template does not mount `/var/run/docker.sock`. IronClaw's Docker sandbox integration is disabled by default so the gateway can run conservatively inside a hosted confidential VM.

## Services

- `ironclaw`: IronClaw runtime and gateway.
- `postgres`: Postgres 16 with pgvector for IronClaw data.

## Ports

- `3000`: IronClaw HTTP gateway.

## Required environment variables

```bash
GATEWAY_AUTH_TOKEN=replace-with-a-long-random-token
SECRETS_MASTER_KEY=replace-with-64-hex-chars
POSTGRES_PASSWORD=replace-with-a-long-url-safe-random-password
```

Use a long random token when exposing the gateway outside localhost. Generate `SECRETS_MASTER_KEY` with a command such as `openssl rand -hex 32`; keep it stable across redeploys so encrypted secrets remain readable. `POSTGRES_PASSWORD` is embedded in `DATABASE_URL`, so avoid URL-reserved characters unless they are encoded.

## Optional environment variables

```bash
GATEWAY_ENABLED=true
GATEWAY_HOST=0.0.0.0
GATEWAY_PORT=3000
IRONCLAW_IN_DOCKER=true
DATABASE_SSLMODE=disable
POSTGRES_DB=ironclaw
POSTGRES_USER=ironclaw
ONBOARD_COMPLETED=true
SANDBOX_ENABLED=false
LLM_BACKEND=nearai
NEARAI_API_KEY=
NEARAI_SESSION_TOKEN=
NEARAI_AUTH_URL=
NEARAI_MODEL=Qwen/Qwen3.5-122B-A10B
NEARAI_BASE_URL=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=
TZ=UTC
```

IronClaw defaults to NEAR AI. `NEARAI_API_KEY` is optional; set it when using NEAR AI API-key auth. For upstream NEAR AI hosted/session-token mode, set `NEARAI_SESSION_TOKEN` and, when needed by your auth flow, `NEARAI_AUTH_URL`. Leave `NEARAI_BASE_URL` empty unless you are intentionally overriding the upstream endpoint selection; IronClaw chooses the appropriate NEAR AI endpoint based on the configured auth mode.

`IRONCLAW_IN_DOCKER` defaults to `true` because this template runs the upstream image in Docker Compose.

## Persistent data

The template creates these volumes:

- `ironclaw_data`: `/home/ironclaw/.ironclaw`
- `postgres_data`: `/var/lib/postgresql/data`

This template is Postgres-only because Postgres/pgvector is recommended for production IronClaw deployments. IronClaw also supports libSQL for zero-config/local deployments, but using libSQL on Phala requires editing or forking this compose file, or creating a separate libSQL-focused template.

## Deploy

```bash
docker compose config
docker compose up -d
```

## Optional HTTP webhook

IronClaw can also expose an HTTP webhook listener on port `8080`. This template leaves it disabled and does not publish port `8080` by default. To enable it, add the upstream webhook environment variables and a `8080:8080` port mapping to the `ironclaw` service, then redeploy with a dedicated webhook secret.
