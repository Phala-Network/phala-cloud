# mem0ai/mem0

Deploy a CPU-safe mem0 package-load and deterministic memory API demo on Phala Cloud.

## Metadata

- Template id: `mem0`
- Category: AI Memory Systems
- Upstream repository: https://github.com/mem0ai/mem0
- Upstream documentation: https://docs.mem0.ai
- Self-hosted docs: https://docs.mem0.ai/open-source/overview
- Python package: https://pypi.org/project/mem0ai/
- Icon source: `docs/logo/favicon.png` from the upstream repository

## What This Template Runs

Mem0 is an AI memory layer for assistants and agents. The upstream project supports three deployment paths: a Python or Node library, a self-hosted server with dashboard and API keys, and the hosted Mem0 platform.

Real mem0 memory extraction and retrieval require an LLM and embedding provider. The upstream library defaults to OpenAI-backed LLM and embedding models, while the upstream self-hosted server adds Postgres/pgvector, dashboard auth, setup flow, and provider configuration.

This Phala prebuilt template intentionally runs a minimal HTTP demo instead of the full upstream server. At startup it installs the official `mem0ai` Python package, imports `mem0` and `Memory`, then serves deterministic JSON endpoints that can be smoke-tested without provider credentials, model downloads, GPU devices, vector databases, or hosted services.

## Services

- `app`: Python HTTP server exposed on container port `8080`.

## Ports

- `8080`: Public HTTP endpoint for health, demo search, and model-list checks.

## Environment Variables

No credentials are required for the default smoke test.

- `MEM0AI_VERSION`: Optional `mem0ai` Python package version installed at container startup. Default: `2.0.2`.

Production mem0 applications normally add provider settings outside this demo, such as `OPENAI_API_KEY` plus the LLM, embedder, vector-store, and history-store configuration described in the upstream docs. Do not add real API keys to this compose file.

## Deploy

1. Deploy the `mem0` template on Phala Cloud.
2. Keep the default CPU-only resources for the demo.
3. Optionally set `MEM0AI_VERSION` to another published PyPI version.
4. Open `https://<your-app-domain>/healthz` after the first startup completes.

The first startup downloads the official Python wheel from PyPI. No private models, paid credentials, GPU devices, host mounts, or privileged container features are required.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the official `mem0ai` package imported successfully.
- `GET /demo`: Returns package metadata and deterministic local search results from built-in demo memories.
- `GET /demo?q=<query>`: Runs the same deterministic demo search with a custom query string.
- `GET /v1/models`: Returns an OpenAI-compatible model-list response for API-client smoke checks.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS "https://<your-app-domain>/demo?q=provider"
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "mode": "deterministic-local-demo",
  "cpu_safe": true,
  "external_credentials_required": false,
  "real_mem0_operations_enabled": false
}
```

## Smoke Verification

Run locally from the repository root:

```bash
docker compose -f templates/prebuilt/mem0/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/mem0/docker-compose.yml down
```

Template validation commands:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/mem0/docker-compose.yml config >/dev/null
```

## Production Notes

- This demo does not call `Memory.add`, `Memory.search`, a hosted LLM, an embedding service, or a vector database.
- To run real mem0 workloads, adapt the application code to create `Memory` or `Memory.from_config` with your chosen LLM, embedder, vector store, and history store.
- The upstream self-hosted server is the better starting point for a full dashboard/API deployment, but it expects a larger stack with auth setup, Postgres/pgvector, provider configuration, and generated secrets.
- Keep provider API keys in Phala environment/secret settings or another secret manager. Do not hard-code them in compose assets.
- Review upstream provider docs before enabling external LLMs, embedding providers, telemetry, or persistent memory storage.

## Security Notes

- This demo exposes unauthenticated health and demo endpoints. Add authentication before exposing private memories or real provider-backed memory operations.
- The container does not request GPU access, privileged mode, host networking, host IPC, host bind mounts, Docker socket access, or `env_file`.
- Pin `MEM0AI_VERSION` for reproducible deployments.
