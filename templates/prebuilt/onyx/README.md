# onyx-dot-app/onyx on Phala Cloud

Deploy a CPU-safe Onyx upstream verifier and smoke API on Phala Cloud.

## Metadata

- Template id: `onyx`
- Display name: `onyx-dot-app/onyx`
- Category: RAG (Retrieval-Augmented Generation) Platforms & Engines
- Upstream repository: https://github.com/onyx-dot-app/onyx
- Pinned upstream release: `v3.3.7`
- Pinned upstream commit: `f45a0c99a2e9b594d391e1827f49d76fa27f8b88`
- Release page: https://github.com/onyx-dot-app/onyx/releases/tag/v3.3.7
- Upstream release published: `2026-05-20T21:13:17Z`
- Upstream license: MIT
- Icon source: `onyx.jpg` is copied from the logo image referenced by the upstream README: https://github.com/onyx-dot-app/onyx/blob/logo/OnyxLogoCropped.jpg?raw=true
- Upstream author: `onyx-dot-app`

## What This Template Runs

Onyx is an open source AI platform and knowledge assistant for LLM applications. The upstream README describes support for RAG, web search, code execution, file creation, deep research, custom agents, actions, MCP, and 50+ indexing based connectors.

This Phala Cloud template intentionally does not start the full production Onyx stack. It runs a small Python HTTP service on port `8000` that verifies pinned upstream Onyx release artifacts and serves JSON smoke endpoints:

- `README.md`
- `pyproject.toml`
- `deployment/docker_compose/docker-compose.yml`
- `deployment/docker_compose/docker-compose.onyx-lite.yml`
- `deployment/docker_compose/env.template`

The verifier checks SHA256 digests and release markers for the upstream project, package metadata, standard Docker Compose stack, Lite overlay, and environment template.

## Why This Is A Demo

The official Onyx Docker Compose stack is a multi-service application. The pinned release includes API and web servers, background workers, PostgreSQL, Redis, MinIO, vector/search services, OpenSearch, and model servers. The upstream compose also uses `.env` files, repository-relative build contexts, host-gateway mappings, and persistent model cache volumes.

Onyx Lite reduces the stack, but its own upstream comments state that connectors and RAG search are disabled in Lite mode. That makes Lite a poor fit for an honest RAG-platform prebuilt template, while the standard stack is too large and assumption-heavy for a no-secret `tdx.small` smoke deployment.

This template is therefore a verifier/demo: it proves the pinned upstream release and deployment facts without pretending to operate production Onyx. It downloads no model weights, starts no external database, starts no vector index, uses no GPU, and requires no provider credentials.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `onyx` prebuilt template.
2. Keep the default small resources for the verifier demo.
3. Deploy the CVM and open the generated public endpoint for port `8000`.
4. Check `https://<your-app-domain>/healthz`.
5. Open `https://<your-app-domain>/demo` for the upstream verification report.

The first startup only pulls the Python base image and fetches small public text files from GitHub for verification. The service keeps `/healthz` available even if GitHub is temporarily unreachable, and `/demo` reports any verification error in JSON.

## Configuration

No user-supplied environment variables or secrets are required.

The compose file sets only non-secret verifier constants:

| Variable | Default | Description |
| --- | --- | --- |
| `ONYX_UPSTREAM` | `https://github.com/onyx-dot-app/onyx` | Upstream repository URL shown in API responses. |
| `ONYX_RELEASE` | `v3.3.7` | Pinned upstream release tag used for raw file verification. |
| `ONYX_COMMIT` | `f45a0c99a2e9b594d391e1827f49d76fa27f8b88` | Commit resolved by the pinned release tag. |
| `ONYX_RELEASE_PUBLISHED_AT` | `2026-05-20T21:13:17Z` | Release publication timestamp from GitHub. |
| `VERIFY_TIMEOUT_SECONDS` | `15` | Timeout for each small upstream file fetch. |

Do not add API keys, OAuth secrets, database passwords, object storage credentials, session tokens, or private document data to this demo. If you convert this into a production Onyx deployment, define those credential-like values as Phala Cloud secrets or required environment variables and avoid hardcoding values in `docker-compose.yml`.

## Usage

- `GET /healthz`: Readiness JSON for Phala smoke testing. Returns HTTP `200` while reporting the background verifier status.
- `GET /demo`: Verifier details, pinned release metadata, SHA256 results, deployment observations, and an explicit statement that production Onyx is not running.
- `GET /v1/models`: OpenAI-compatible model-list shape that identifies the local verifier endpoint. It does not indicate a real hosted LLM.
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
  "demo": {
    "mode": "cpu-safe Onyx upstream verifier",
    "full_stack_started": false,
    "rag_index_started": false,
    "llm_provider_called": false,
    "model_weights_downloaded": false,
    "provider_credentials_required": false,
    "safe_for_tdx_small_smoke": true
  }
}
```

## Local Verification

From the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/onyx/docker-compose.yml config >/dev/null
```

Optional local smoke test:

```bash
docker compose -f templates/prebuilt/onyx/docker-compose.yml up -d
curl -fsS http://localhost:8000/healthz
curl -fsS http://localhost:8000/demo
curl -fsS http://localhost:8000/v1/models
docker compose -f templates/prebuilt/onyx/docker-compose.yml down
```

## Resource Expectations

The verifier demo is designed for `tdx.small`-class smoke testing. It runs one Python HTTP process and performs a few small HTTPS fetches from GitHub.

Production Onyx is materially larger. Plan capacity for the standard upstream services before deploying real document ingestion, vector search, background indexing, file storage, code execution, web search, model calls, and multi-user workflows.

## Security Notes

- The demo exposes unauthenticated health and metadata endpoints. Add authentication before adapting it for private workflows.
- The compose file contains no real credentials and no credential-like user inputs.
- The template does not use `env_file`, host bind mounts, external build contexts, privileged mode, host networking, host IPC, GPU devices, Docker socket access, or external databases.
- The verifier fetches public upstream files from GitHub. If outbound access is unavailable, endpoints still return JSON and report the verification failure.
- Do not upload private documents or configure production LLM providers in this verifier container.

## Moving To Production Onyx

Use this template as a Phala smoke-safe upstream verifier, not as the production Onyx deployment.

To deploy production Onyx:

1. Start from the official upstream repository and deployment files at https://github.com/onyx-dot-app/onyx.
2. Choose resources that match the standard or Lite deployment you actually need.
3. Decide whether you need full RAG connectors and indexing. The upstream Lite overlay disables connector and RAG search services.
4. Provide strong unique secrets for auth, database, object storage, OAuth, model providers, bots, and integrations through Phala Cloud secret handling.
5. Review the upstream compose or Helm settings for `.env`, build contexts, host assumptions, model caches, persistent volumes, and optional code execution features before exposing the service publicly.
6. Add authentication, TLS routing, backup/restore, monitoring, and data retention controls before uploading private documents.
