# Langfuse on Phala Cloud

This Phala Cloud prebuilt template runs a CPU-safe Langfuse source verifier API
for smoke testing. It does not start the full Langfuse production web
application.

Langfuse is an open-source LLM engineering platform for observability, traces,
prompt management, evaluations, datasets, playground workflows, APIs, and
metrics. The upstream self-hosted stack is useful, but it is not a small
credential-free single-process deployment: the official Docker Compose file
starts Langfuse web and worker services plus PostgreSQL, ClickHouse, Redis, and
MinIO, and it marks multiple secret or credential values as values that must be
changed before real use.

This template therefore exposes a verifier service on port `8080`. At startup
it fetches selected pinned public files from the upstream Langfuse repository,
checks their SHA-256 digests, checks Langfuse-specific source markers, and
returns deterministic JSON endpoints suitable for Phala Cloud smoke testing. It
does not download model weights, call hosted LLM providers, start databases,
require GPU access, or require real secrets.

## Metadata

- Template id: `langfuse`
- Display name: `langfuse/langfuse`
- Category: LLM Observability, Evaluation & Testing
- Upstream repository: `https://github.com/langfuse/langfuse`
- Upstream author: `langfuse`
- Pinned upstream ref: `main`
- Pinned upstream commit: `ffedf2b8192b15f2e66c36ead3301720dc7416b0`
- Upstream commit inspected at: `2026-05-27T19:20:10Z`
- Upstream version marker: `v3.175.0`
- Upstream license: the root license describes MIT Expat terms for content
  outside the enterprise directories and separate terms for enterprise
  directories.
- Runtime image: `python:3.12-slim-bookworm`
- Icon source: upstream `web/public/icon.svg` from `langfuse/langfuse`, copied
  from
  `https://raw.githubusercontent.com/langfuse/langfuse/ffedf2b8192b15f2e66c36ead3301720dc7416b0/web/public/icon.svg`
- Icon SHA-256:
  `daeef880d58644fab4fd9ba5d292086c6d69756a39cff94d510f8ddc35312bf3`

## What This Template Runs

- `app`: a Python HTTP service exposed on port `8080`.

The verifier checks these pinned upstream files:

- `README.md`
- `package.json`
- `docker-compose.yml`
- `web/src/constants/VERSION.ts`
- `web/public/icon.svg`

For each file, it verifies the expected byte size, SHA-256 digest, and
Langfuse-specific markers. The checks cover the upstream README positioning for
LLM observability, prompt management, evaluations, ClickHouse attribution, and
OpenAPI support; package metadata such as `langfuse` version `3.175.0`, Node
`24`, and `pnpm@11.1.3`; the official self-hosted service shape; and the
upstream icon file.

## Why This Is A Verifier Demo

The official Langfuse Docker Compose file is a multi-service production stack.
It declares:

- `langfuse-worker`
- `langfuse-web`
- `postgres`
- `clickhouse`
- `redis`
- `minio`

It also includes credential or secret-related settings such as `DATABASE_URL`,
`SALT`, `ENCRYPTION_KEY`, `CLICKHOUSE_PASSWORD`, object-storage access keys,
`REDIS_AUTH`, `NEXTAUTH_SECRET`, `MINIO_ROOT_PASSWORD`, and
`POSTGRES_PASSWORD`.

Starting that stack with default placeholder values would not be an honest
Phala `tdx.small` smoke template. A real Langfuse deployment needs generated
secrets, persistent databases, object storage, authentication settings,
backups, upgrade planning, and resource sizing for trace ingestion and query
volume. This template proves pinned upstream facts without pretending to run
production Langfuse.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `langfuse` prebuilt template.
2. Keep the default small resources for this verifier demo.
3. Expose the HTTP service on port `8080`.
4. Deploy the CVM.
5. Open `/healthz` or `/demo` on the generated Phala Cloud endpoint.

The first startup fetches small public files from GitHub for verification. No
private credentials, model downloads, GPU devices, host mounts, host
networking, host IPC, privileged mode, external build context, `env_file`, or
Docker socket access are required.

## Environment Variables

No user-supplied credentials are required.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `APP_PORT` | `8080` | No | HTTP port used by the verifier service. The compose file publishes the same host and container port. |
| `LANGFUSE_VERIFY_TIMEOUT_SECONDS` | `15` | No | Timeout in seconds for each pinned public upstream file fetch. |

The compose file also sets non-secret verifier metadata:

- `LANGFUSE_UPSTREAM`: `https://github.com/langfuse/langfuse`
- `LANGFUSE_REF_NAME`: `main`
- `LANGFUSE_REF`: `ffedf2b8192b15f2e66c36ead3301720dc7416b0`
- `LANGFUSE_VERSION`: `v3.175.0`

Do not add API keys, database passwords, object-storage credentials, session
tokens, OAuth secrets, or model-provider credentials to this verifier. If you
convert the template into a real Langfuse deployment, define credential-like
values as required Phala Cloud environment variables or secrets instead of
hardcoding them in `docker-compose.yml`.

## Endpoints

- `GET /healthz`: readiness JSON for Phala Cloud smoke testing. It returns HTTP
  `200` only when the pinned Langfuse upstream file and marker checks pass.
- `GET /demo`: detailed verifier payload, upstream metadata, production caveats,
  and an explicit report of what is not running.
- `GET /v1/models`: OpenAI-compatible model-list shape with
  `langfuse/no-llm-verifier`. This is metadata only; no LLM is hosted or called.
- `GET /upstream`: returns the cached verifier result.
- `GET /upstream?refresh=1`: re-fetches the pinned public upstream files and
  updates the verifier result.
- `GET /`: same readiness payload as `/healthz`.

Example local checks:

```bash
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS 'http://localhost:8080/upstream?refresh=1'
```

Expected `/demo` fields include:

```json
{
  "template_mode": {
    "type": "cpu-safe Langfuse source verifier",
    "full_langfuse_started": false,
    "postgres_started": false,
    "clickhouse_started": false,
    "llm_provider_calls": false,
    "model_downloaded": false,
    "credentials_required": false,
    "safe_for_tdx_small_smoke": true
  }
}
```

## Local Testing

From the monorepo root:

```bash
docker compose -f templates/prebuilt/langfuse/docker-compose.yml config
docker compose -f templates/prebuilt/langfuse/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/langfuse/docker-compose.yml down
```

Template validation commands:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/langfuse/docker-compose.yml config
```

## Security Notes

- The verifier exposes unauthenticated health and metadata endpoints. This is
  acceptable for smoke testing, but not for private trace ingestion or
  production LLM observability workloads.
- The compose file contains no real credentials and no credential-like default
  values.
- The template does not use `env_file`, host bind mounts, external build
  contexts, privileged mode, host networking, host IPC, GPU devices, Docker
  socket access, or private registry credentials.
- The verifier fetches public source files from GitHub. If outbound access to
  GitHub is unavailable, `/healthz` returns a non-200 status with JSON explaining
  which verification failed.

## Moving To Production Langfuse

Use this template as a Phala Cloud smoke-safe verifier, not as the production
Langfuse deployment.

For a real Langfuse instance:

1. Start from the official upstream self-hosting documentation at
   `https://langfuse.com/self-hosting`.
2. Generate strong values for `SALT`, `ENCRYPTION_KEY`, `NEXTAUTH_SECRET`,
   database passwords, Redis auth, and object-storage credentials.
3. Decide whether PostgreSQL, ClickHouse, Redis, and object storage run inside
   the CVM, on managed services, or on separately operated infrastructure.
4. Configure persistent volumes, backups, restore testing, monitoring, and
   upgrade procedures.
5. Set authentication, email, URL, TLS, and network exposure settings for your
   users and ingestion clients.
6. Size CPU, memory, disk, and ClickHouse storage for trace volume, retention,
   evaluation workloads, and query concurrency.
7. Replace this verifier's endpoints with Langfuse's real readiness and
   application health checks once your production stack is defined.

## Upstream Attribution

Langfuse is developed by the `langfuse` project:
`https://github.com/langfuse/langfuse`.

This Phala Cloud template pins and verifies public upstream files from commit
`ffedf2b8192b15f2e66c36ead3301720dc7416b0`. The local icon file
`templates/icons/langfuse.svg` is copied from upstream
`web/public/icon.svg` at that same commit.
