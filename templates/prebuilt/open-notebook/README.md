# lfnovo/open-notebook

Deploy a CPU-safe Open Notebook source verifier on Phala Cloud.

## Overview

Open Notebook is an open source, self-hosted alternative to Google Notebook LM. It provides notebooks, sources, notes, transformations, chat, search, podcasts, a Next.js web UI, a FastAPI backend, and SurrealDB-backed persistence.

This Phala Cloud template intentionally runs a no-credential verifier instead of the full production web app. At startup it installs the real upstream Open Notebook source package from the `v1.9.0` GitHub tag, installs the small dependency set needed for local source utilities and their import-time helpers, then exposes deterministic HTTP endpoints for smoke testing.

The verifier builds a notebook-shaped JSON payload, runs Open Notebook content-type detection and chunking on a markdown sample, counts tokens, parses thinking content with the upstream text utility, extracts structured message text, and exercises the upstream `InvalidInputError` class. It does not connect to SurrealDB, call an AI provider, require browser auth, download model weights, or load an inference model.

## Metadata

- Template id: `open-notebook`
- Display name: `lfnovo/open-notebook`
- Category: AI Apps & Workflows
- Upstream repository: https://github.com/lfnovo/open-notebook
- Upstream Docker Compose docs: https://github.com/lfnovo/open-notebook/blob/main/docs/1-INSTALLATION/docker-compose.md
- Upstream environment reference: https://github.com/lfnovo/open-notebook/blob/main/docs/5-CONFIGURATION/environment-reference.md
- Source artifact used by default: `https://github.com/lfnovo/open-notebook/archive/refs/tags/v1.9.0.tar.gz`
- Icon source: `logo.png` from the upstream repository root
- Upstream author: Luis Novo / `lfnovo`

## What This Template Runs

- `app`: A `python:3.12-slim-bookworm` HTTP service listening on port `8080`.
- Startup command: installs `OPEN_NOTEBOOK_PACKAGE_URL` with `--no-deps`, installs the small utility dependency set (`cryptography`, `langchain-text-splitters`, `loguru`, `numpy`, `packaging`, `requests`, `tiktoken`, and `tomli`), then runs an inline Python server.
- Persistence: none. The verifier is stateless and does not write user notebooks or credentials.
- Credentials: none required.

The upstream project also publishes production images:

- `lfnovo/open_notebook:v1-latest` for the recommended multi-container deployment.
- `lfnovo/open_notebook:v1-latest-single` for the deprecated single-container deployment.

The recommended upstream production deployment uses a SurrealDB service, persistent data volumes, port `8502` for the web UI, port `5055` for the REST API, and a stable `OPEN_NOTEBOOK_ENCRYPTION_KEY` to encrypt saved provider credentials. AI provider credentials are configured later through the Open Notebook Settings UI.

## Deployment Steps

1. Deploy the `open-notebook` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `OPEN_NOTEBOOK_PACKAGE_URL` if you want to verify another upstream Git tag or source archive.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads Python wheels and the upstream source tarball. No model weights are downloaded.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `OPEN_NOTEBOOK_PACKAGE_URL` | No | `https://github.com/lfnovo/open-notebook/archive/refs/tags/v1.9.0.tar.gz` | Upstream source archive installed by the verifier at container startup. |
| `OPEN_NOTEBOOK_CHUNK_SIZE` | No | `120` | Token chunk size used by the upstream chunking utility. Open Notebook enforces a minimum of `100`. |
| `OPEN_NOTEBOOK_MIN_CHUNK_SIZE` | No | `0` | Minimum chunk size filter for the verifier's deterministic chunking sample. |

Production Open Notebook deployments need additional variables such as `OPEN_NOTEBOOK_ENCRYPTION_KEY`, `SURREAL_URL`, `SURREAL_USER`, `SURREAL_PASSWORD`, `SURREAL_NAMESPACE`, and `SURREAL_DATABASE`. Do not put real secrets in this template. Configure production secrets through Phala Cloud environment variables and keep the encryption key stable across redeploys.

## Exposed Endpoints

- `GET /healthz`: Imports Open Notebook, runs the deterministic local demo, and returns readiness.
- `GET /demo`: Runs the local source-utility smoke test and returns JSON details.
- `GET /v1/models`: Returns an OpenAI-style model list describing the local verifier endpoint. No model is loaded.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

## Smoke Verification

Run locally from the parent worktree:

```bash
docker compose -f templates/prebuilt/open-notebook/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/open-notebook/docker-compose.yml down
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "demo_type": "deterministic local Open Notebook source-utility smoke test",
  "credentials_required": false,
  "database_required_for_demo": false,
  "llm_provider_calls": false,
  "model_downloaded": false,
  "model_loaded": false,
  "validation": {
    "invalid_input_error_class_works": true
  }
}
```

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/open-notebook/docker-compose.yml config >/dev/null
```

If `python` is unavailable in your local shell, run the validation script with `python3`.

## Production Notes

- The default template is a verifier, not the full Open Notebook UI.
- Full Open Notebook production usage should follow the upstream Docker Compose deployment with a SurrealDB sidecar and persistent named volumes instead of host bind mounts on Phala Cloud.
- Set a long, stable `OPEN_NOTEBOOK_ENCRYPTION_KEY` for production. Losing or changing it makes stored provider credentials unreadable.
- Change default SurrealDB credentials in production.
- Configure AI providers in the Settings UI after deployment. Provider calls are intentionally absent from this verifier.
- Add access control before exposing a production Open Notebook instance publicly. The verifier endpoints are unauthenticated.
- Avoid adding Ollama or other local model services unless the selected Phala Cloud resource class has enough CPU, memory, and disk for the chosen model weights.

## Cleanup

For a local test run from the parent worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/open-notebook/docker-compose.yml down
```
