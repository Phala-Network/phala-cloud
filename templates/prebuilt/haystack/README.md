# deepset-ai/haystack on Phala Cloud

Deploy a CPU-safe Haystack local pipeline demo API on Phala Cloud.

## Metadata

- Template id: `haystack`
- Category: RAG (Retrieval-Augmented Generation) framework
- Upstream repository: https://github.com/deepset-ai/haystack
- Python package: https://pypi.org/project/haystack-ai/
- Default package version: `haystack-ai==2.29.0`
- Icon source: `haystack.svg` is copied from upstream `docs-website/static/img/logo.svg` in `deepset-ai/haystack`, inspected at commit `b38b8ff5423d7bae7b374962f78e73b7a30a2219`

## What This Template Runs

Haystack is an open source framework for building retrieval-augmented generation systems, search applications, agents, and composable AI pipelines. Real Haystack applications can connect to model providers, local model runtimes, vector databases, document stores, web crawlers, tracing systems, and other integrations.

This template deliberately keeps the default deployment small and deterministic for a CPU-only `tdx.small` smoke test. It runs a minimal Python HTTP service on the public `python:3.12-slim-bookworm` image. At startup, the container installs the real `haystack-ai` package from PyPI, imports `Document`, `Pipeline`, and `component` from the `haystack` module, then serves a tiny local pipeline:

```text
LocalKeywordRetriever -> LocalAnswerBuilder
```

The demo pipeline uses three in-memory documents and deterministic keyword scoring. It does not download model weights, call OpenAI, call Anthropic, call hosted embedding services, start a vector database, use GPU devices, or require provider credentials by default.

## Services

- `app`: Python HTTP server that installs Haystack and exposes the local deterministic smoke-test API.

## Port

- `8080`: Public HTTP endpoint for health, demo, pipeline, and model-list checks.

## Environment Variables

No credentials are required for the default demo.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `HAYSTACK_PACKAGE_VERSION` | No | `2.29.0` | Pinned `haystack-ai` package version installed at container startup. |
| `HAYSTACK_DEMO_TOP_K` | No | `2` | Number of local demo contexts returned by `/demo` and `/pipeline`. Values are clamped to the bundled document count. |
| `HAYSTACK_TELEMETRY_ENABLED` | No | `false` | Keeps Haystack telemetry disabled for the default smoke demo. |

Provider credentials such as model API keys, embedding service keys, tracing tokens, database URLs, or object storage credentials are intentionally not part of this default template. Add them only if you replace the local demo with a real Haystack application that needs them, and pass them through your deployment secret mechanism rather than hardcoding values in `docker-compose.yml`.

## Deploy

1. Deploy the `haystack` template on Phala Cloud.
2. Keep the default CPU-only resources for the smoke demo.
3. Optionally set `HAYSTACK_PACKAGE_VERSION` or `HAYSTACK_DEMO_TOP_K`.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads Python wheels from PyPI. After the package is installed and the HTTP server starts, the demo endpoints use only local in-memory data and local Python components.

## Usage Endpoints

- `GET /healthz`: Returns `200` when Haystack imports successfully and a deterministic local pipeline smoke check passes.
- `GET /demo`: Runs the local Haystack pipeline with the default query and returns selected contexts.
- `GET /demo?q=<text>&top_k=3`: Runs the same local pipeline with a custom query and context count.
- `GET /pipeline`: Runs the same local pipeline and includes component and connection metadata.
- `GET /v1/models`: Returns an OpenAI-style model list describing the local deterministic pipeline surface. It does not imply that an inference model is hosted.
- `GET /`: Returns service metadata and available endpoints.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS "https://<your-app-domain>/demo?q=Haystack%20local%20pipeline"
curl -fsS https://<your-app-domain>/pipeline
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "pipeline": {
    "components": ["LocalKeywordRetriever", "LocalAnswerBuilder"],
    "connections": ["retriever.documents -> answer_builder.documents"],
    "credentials_required": false,
    "external_database": false,
    "external_provider_calls": false,
    "gpu_required": false,
    "model_downloaded": false
  }
}
```

## Local Verification

Run locally from the `sdks/` directory:

```bash
docker compose -f templates/prebuilt/haystack/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/haystack/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS "http://localhost:8080/demo?q=Haystack%20local%20pipeline"
curl -fsS http://localhost:8080/pipeline
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/haystack/docker-compose.yml down
```

Template validation commands from the `sdks/` directory:

```bash
python3 templates/validate.py
python3 -m json.tool templates/config.json >/dev/null
docker compose -f templates/prebuilt/haystack/docker-compose.yml config >/dev/null
```

## Production Caveats

Use this as a package and pipeline smoke test, not as a production Haystack server.

For a real Haystack deployment, replace the in-memory documents and deterministic keyword retriever with your production pipeline, document store, retriever, generator, routing, and observability choices. Review every component for CPU latency, memory use, disk use, model download behavior, provider network calls, database requirements, credential handling, and data retention before exposing private workloads.

The default endpoints are unauthenticated and contain only static demo data. Add authentication, TLS routing policy, request limits, audit logging, and secret management before adapting this template for private documents or user-facing RAG workflows.

## Security Notes

- The template does not use privileged mode, host networking, host IPC, GPU devices, Docker socket access, host bind mounts, `env_file`, external databases, or provider credentials.
- No API keys are baked into the compose file or README.
- The runtime demo is deterministic and local after startup package installation.
- If you add provider credentials later, keep them out of template metadata and compose defaults.

## Cleanup

For a local test run from `sdks/`, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/haystack/docker-compose.yml down
```
