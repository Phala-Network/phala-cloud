# infiniflow/ragflow on Phala Cloud

Deploy a CPU-safe RAGFlow source and runtime verifier on Phala Cloud.

## Overview

RAGFlow is an open-source Retrieval-Augmented Generation engine from Infiniflow with deep document understanding, knowledge extraction, and agent-oriented RAG workflows. The upstream project is designed as a multi-service Docker deployment for production RAG applications.

This Phala Cloud template intentionally does not start the full production RAGFlow stack. Instead, it runs a small HTTP verifier on port `8000` that pins the upstream `infiniflow/ragflow` release `v0.25.5`, verifies selected upstream files by SHA256, checks expected RAGFlow source/runtime facts, and exposes smoke-testable JSON endpoints.

The demo downloads no model weights, starts no vector database, starts no MySQL or MinIO service, requires no GPU, and requires no provider credentials.

## Metadata

- Template id: `ragflow`
- Display name: `infiniflow/ragflow`
- Category: RAG (Retrieval-Augmented Generation) Platforms & Engines
- Upstream repository: https://github.com/infiniflow/ragflow
- Pinned upstream release: `v0.25.5`
- Pinned upstream commit: `90c76e73d072a2fba9ffdd8cdde694a9cb4a31af`
- Release page: https://github.com/infiniflow/ragflow/releases/tag/v0.25.5
- Upstream license: Apache-2.0
- Icon source: `ragflow.svg` is copied from the upstream release file `web/public/logo.svg` at https://raw.githubusercontent.com/infiniflow/ragflow/v0.25.5/web/public/logo.svg

## What This Template Runs

- `app`: a Python `3.13-slim-bookworm` HTTP service exposed on container and host port `8000`.

At startup the service launches a background verifier that fetches these pinned upstream files:

- `README.md`
- `pyproject.toml`
- `docker/docker-compose.yml`
- `docker/docker-compose-base.yml`

For each file it checks the expected SHA256 digest and specific markers, including the RAGFlow package version, Python version range, production Docker Compose services, and documented production resource requirements.

## Why This Is A Demo

The official RAGFlow self-hosting README for `v0.25.5` lists production prerequisites of at least 4 CPU cores, 16 GB RAM, 50 GB disk, Docker, Docker Compose, and `vm.max_map_count >= 262144`. The upstream Docker Compose stack also includes RAGFlow, MySQL, MinIO, Redis or Valkey, and a document engine such as Elasticsearch. Optional sandbox execution uses privileged mode and the Docker socket in the upstream base compose file.

Those requirements and host assumptions are not a safe default for a `tdx.small` smoke deployment. This template is therefore a verifier demo: it proves the pinned upstream release and runtime facts without pretending to operate production RAGFlow.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `ragflow` prebuilt template.
2. Keep the default small resources for the verifier demo.
3. Deploy the CVM and open the generated public endpoint for port `8000`.
4. Check `https://<your-app-domain>/healthz` and `https://<your-app-domain>/demo`.

The first startup only pulls the Python base image and fetches small text files from GitHub for verification. No private credentials, model downloads, GPU devices, host mounts, host networking, host IPC, privileged mode, or Docker socket access are required.

## Environment Variables

No user-supplied environment variables are required.

The compose file sets only non-secret verifier constants:

- `RAGFLOW_UPSTREAM`: upstream repository URL.
- `RAGFLOW_RELEASE`: pinned release tag, currently `v0.25.5`.
- `RAGFLOW_COMMIT`: pinned release commit.
- `RAGFLOW_RELEASE_PUBLISHED_AT`: upstream release timestamp.
- `VERIFY_TIMEOUT_SECONDS`: timeout for each small upstream file fetch.

Do not add API keys, database passwords, object storage credentials, model-provider credentials, or session tokens to this demo unless you are converting it into a real production deployment. If you do convert it, define credential-like variables as required Phala Cloud environment variables or secrets and avoid hardcoding values in `docker-compose.yml`.

## Endpoints

- `GET /healthz`: readiness JSON for Phala smoke testing. It returns HTTP `200` while reporting the background verifier status.
- `GET /demo`: verifier details, pinned release metadata, SHA256 results, runtime facts, and an explicit statement that production RAGFlow is not running.
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
    "mode": "cpu-safe RAGFlow source and runtime verifier",
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
docker compose -f templates/prebuilt/ragflow/docker-compose.yml config
```

Optional local smoke test:

```bash
docker compose -f templates/prebuilt/ragflow/docker-compose.yml up -d
curl -fsS http://localhost:8000/healthz
curl -fsS http://localhost:8000/demo
curl -fsS http://localhost:8000/v1/models
docker compose -f templates/prebuilt/ragflow/docker-compose.yml down
```

## Resource Expectations

The verifier demo is small and intended for `tdx.small`-class smoke testing. It runs one Python HTTP process, performs a few small HTTPS fetches, and does not keep a database or model runtime in memory.

Production RAGFlow is materially larger. Plan for at least the upstream minimum of 4 CPU cores, 16 GB RAM, and 50 GB disk before running the official full stack. Real ingestion, OCR, document parsing, embedding, reranking, and agent workloads can require more memory, disk, CPU, GPU, or external model-provider capacity depending on your data and model choices.

## Security Notes

- The demo exposes unauthenticated health and metadata endpoints. This is acceptable for smoke testing, but not for private document search or real RAG workloads.
- The compose file contains no real credentials and no credential-like environment variables.
- The demo does not use `env_file`, host bind mounts, external build contexts, privileged mode, host networking, host IPC, or Docker socket access.
- The verifier fetches public upstream files from GitHub. If outbound access is unavailable, endpoints still return non-5xx JSON and report the verification failure.
- Add authentication, TLS routing, secret management, and private network controls before exposing production RAGFlow APIs or document data.

## Moving To Production RAGFlow

Use this template as a Phala smoke-safe upstream verifier, not as the production RAGFlow deployment.

To deploy production RAGFlow:

1. Start from the official upstream repository and release-matched Docker files at https://github.com/infiniflow/ragflow.
2. Choose resources that meet or exceed the upstream self-hosting prerequisites.
3. Decide on a document engine such as Elasticsearch, Infinity, OpenSearch, OceanBase, or SeekDB.
4. Provide strong unique credentials for MySQL, MinIO, Redis or Valkey, and any selected document engine through Phala Cloud secrets or required environment variables.
5. Configure model providers, embedding services, OCR, reranking, and any Hugging Face or external API credentials explicitly.
6. Avoid enabling sandbox execution unless the deployment environment supports the required isolation model and you have reviewed the upstream privileged Docker socket assumptions.
7. Add authentication in front of public RAGFlow endpoints before uploading private documents.

After the production stack is running, use the upstream RAGFlow UI and APIs rather than this verifier's `/demo` endpoint.
