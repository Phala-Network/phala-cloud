# labring/FastGPT on Phala Cloud

Deploy a CPU-safe FastGPT source and deployment verifier on Phala Cloud.

## Overview

FastGPT is an AI Agent and knowledge-base platform from labring with data processing, model invocation, visual workflow orchestration, knowledge-base retrieval, and OpenAPI capabilities.

This Phala Cloud template intentionally does not start the full production FastGPT stack. Instead, it runs a small HTTP verifier on port `8000` that pins the upstream `labring/FastGPT` release `v4.14.22`, verifies selected upstream files by SHA256, checks expected FastGPT source and deployment facts, and exposes smoke-testable JSON endpoints.

The demo downloads no model weights, starts no database, starts no object storage, requires no GPU, and requires no provider credentials.

## Metadata

- Template id: `fastgpt`
- Display name: `labring/FastGPT`
- Category: RAG (Retrieval-Augmented Generation) Platforms & Engines
- Upstream repository: https://github.com/labring/FastGPT
- Pinned upstream release: `v4.14.22`
- Pinned upstream commit: `71354ffadaa8d255a2d55af3abaad798311f35a2`
- Release page: https://github.com/labring/FastGPT/releases/tag/v4.14.22
- Upstream license: FastGPT Open Source License, based on Apache-2.0 with additional conditions
- Icon source: `fastgpt.svg` is copied from the upstream file `.github/imgs/logo.svg` at https://raw.githubusercontent.com/labring/FastGPT/v4.14.22/.github/imgs/logo.svg

## What This Template Runs

- `app`: a Python `3.13-slim-bookworm` HTTP service exposed on container and host port `8000`.

At startup the service launches a background verifier that fetches these pinned upstream files:

- `README_en.md`
- `package.json`
- `projects/app/package.json`
- `deploy/docker/global/docker-compose.pg.yml`
- `LICENSE`
- `.github/imgs/logo.svg`

For each file it checks the expected SHA256 digest and specific markers, including the FastGPT app package, Node and pnpm runtime requirements, knowledge-base and workflow capabilities, official Docker deployment services, sandbox Docker socket assumptions, and the upstream logo source.

## Why This Is A Demo

The official FastGPT Docker deployment is a multi-service production stack. The pinned upstream `docker-compose.pg.yml` includes FastGPT, MongoDB, Redis, PostgreSQL with pgvector, MinIO, FastGPT plugin and code-sandbox services, OpenSandbox, a volume manager, AI Proxy, and an AI Proxy PostgreSQL service.

That upstream stack also includes fixed example credentials, a local `config.json` host bind mount, and Docker socket mounts for sandbox-related components. Those defaults are not suitable for a generic Phala Cloud prebuilt template or a `tdx.small` smoke deployment, and model usage still requires real provider configuration after deployment.

This template is therefore a verifier demo: it proves the pinned upstream release and deployment facts without pretending to operate production FastGPT.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `fastgpt` prebuilt template.
2. Keep the default small resources for the verifier demo.
3. Deploy the CVM and open the generated public endpoint for port `8000`.
4. Check `https://<your-app-domain>/healthz` and `https://<your-app-domain>/demo`.

The first startup only pulls the Python base image and fetches small public files from GitHub for verification. No private credentials, model downloads, GPU devices, host mounts, host networking, host IPC, privileged mode, or Docker socket access are required.

## Environment Variables

No user-supplied environment variables are required.

The compose file sets only non-secret verifier constants:

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `FASTGPT_UPSTREAM` | No | `https://github.com/labring/FastGPT` | Upstream repository used in metadata responses. |
| `FASTGPT_RELEASE` | No | `v4.14.22` | Pinned upstream release tag used for raw file verification. |
| `FASTGPT_COMMIT` | No | `71354ffadaa8d255a2d55af3abaad798311f35a2` | Commit targeted by the pinned release tag. |
| `FASTGPT_RELEASE_PUBLISHED_AT` | No | `2026-05-22T14:38:53Z` | Release publication timestamp from GitHub. |
| `VERIFY_TIMEOUT_SECONDS` | No | `15` | Timeout for each small upstream file fetch. |

Do not add API keys, database passwords, object storage credentials, model-provider credentials, session tokens, or signing secrets to this demo unless you are converting it into a real production deployment. If you do convert it, define credential-like values as required Phala Cloud environment variables or secrets and avoid hardcoding them in `docker-compose.yml`.

## Usage

Use this deployment as a smoke-safe FastGPT upstream verifier. Open `/healthz` to confirm the service is live, `/demo` to inspect the pinned upstream verification result, and `/v1/models` when a platform expects an OpenAI-compatible model-list endpoint.

The template does not provide the FastGPT web UI, document ingestion, chat completions, workflow execution, or knowledge-base search. Those features require the official production stack plus real database, object storage, model-provider, and secret configuration.

## Endpoints

- `GET /healthz`: readiness JSON for Phala smoke testing. It returns HTTP `200` while reporting the background verifier status.
- `GET /demo`: verifier details, pinned release metadata, SHA256 results, runtime facts, and an explicit statement that production FastGPT is not running.
- `GET /v1/models`: OpenAI-compatible model-list shape with an empty `data` array because no model provider or inference server is running.
- `GET /`: same readiness payload as `/healthz`.

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
    "mode": "cpu-safe FastGPT source and deployment verifier",
    "full_stack_started": false,
    "model_weights_downloaded": false,
    "gpu_required": false,
    "provider_credentials_required": false,
    "safe_for_tdx_small_smoke": true
  }
}
```

## Verification Commands

From the monorepo root:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/fastgpt/docker-compose.yml config
```

Optional local smoke test:

```bash
docker compose -f templates/prebuilt/fastgpt/docker-compose.yml up -d
curl -fsS http://localhost:8000/healthz
curl -fsS http://localhost:8000/demo
curl -fsS http://localhost:8000/v1/models
docker compose -f templates/prebuilt/fastgpt/docker-compose.yml down
```

## Resource Expectations

The verifier demo is small and intended for `tdx.small`-class smoke testing. It runs one Python HTTP process, performs a few small HTTPS fetches, and does not keep a database, object store, vector database, sandbox, AI Proxy, or model runtime in memory.

Production FastGPT is materially larger. Plan resources around the official deployment stack, expected document ingestion load, storage size, embedding and reranking strategy, provider/model latency, and any sandbox usage. Real deployments should replace all example credentials with unique secrets before first use.

## Security Notes

- The demo exposes unauthenticated health and metadata endpoints. This is acceptable for smoke testing, but not for private document search, workflow execution, or real RAG workloads.
- The compose file contains no real credentials and no credential-like environment variable values.
- The demo does not use `env_file`, host bind mounts, external build contexts, privileged mode, host networking, host IPC, or Docker socket access.
- The verifier fetches public upstream files from GitHub. If outbound access is unavailable, endpoints still return non-5xx JSON and report the verification failure.
- Add authentication, TLS routing, secret management, private network controls, and provider-specific rate controls before exposing production FastGPT APIs or document data.

## Moving To Production FastGPT

Use this template as a Phala smoke-safe upstream verifier, not as the production FastGPT deployment.

To deploy production FastGPT:

1. Start from the official upstream repository and release-matched Docker files at https://github.com/labring/FastGPT.
2. Replace every example credential, token, connection string, and signing key with unique Phala Cloud secrets or required environment variables before first startup.
3. Remove or adapt host bind mounts and Docker socket assumptions for the target environment.
4. Configure external model providers, embedding models, reranking models, AI Proxy settings, and object storage explicitly.
5. Size CPU, memory, disk, and database resources for document ingestion, vector search, workflow execution, and concurrent users.
6. Review sandbox behavior before enabling code or agent sandbox features in a public deployment.
7. Add authentication and access controls before uploading private documents.

After the production stack is running, use the upstream FastGPT UI and APIs rather than this verifier's `/demo` endpoint.
