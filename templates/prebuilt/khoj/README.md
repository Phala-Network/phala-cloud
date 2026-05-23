# khoj-ai/khoj on Phala Cloud

Deploy a CPU-safe Khoj source and package verifier on Phala Cloud.

## Metadata

- Template id: `khoj`
- Display name: `khoj-ai/khoj`
- Category: RAG (Retrieval-Augmented Generation) Platforms & Engines
- Upstream repository: https://github.com/khoj-ai/khoj
- Upstream project: Khoj by `khoj-ai`
- Pinned upstream release: `2.0.0-beta.28`
- Pinned upstream commit: `9258f57dceab19d52a1a0bdac54eb38576c29187`
- Release page: https://github.com/khoj-ai/khoj/releases/tag/2.0.0-beta.28
- PyPI package: https://pypi.org/project/khoj/2.0.0b28/
- Upstream license: AGPL-3.0-or-later
- Icon source: `khoj.png` is copied from the upstream repository file `src/interface/android/store_icon.png` at commit `9258f57dceab19d52a1a0bdac54eb38576c29187`

## What This Template Runs

Khoj is an open-source, self-hostable AI second brain for chat, document search, agents, automations, and RAG-style workflows. The upstream project can run with a web app, Postgres with pgvector, SearxNG, a Terrarium sandbox, optional local model servers, optional hosted model providers, and optional Khoj Cloud usage.

This Phala Cloud template intentionally does not start the full production Khoj stack. It runs one small Python `3.12-slim-bookworm` HTTP service on port `42110`, matching the upstream Khoj server port, and exposes smoke-testable JSON endpoints.

At startup the verifier checks pinned upstream facts:

- `README.md`: product positioning, self-hosting, docs, and Khoj Cloud links.
- `pyproject.toml`: package name, Python range, license, and heavyweight runtime dependencies such as Torch, sentence-transformers, Django, and pgvector.
- `docker-compose.yml`: official self-hosting services and placeholders including Postgres, the Khoj image, Terrarium, SearxNG, admin password, Django secret, model caches, and provider API key examples.
- PyPI package metadata for `khoj==2.0.0b28`.
- The running Python version against Khoj's declared `>=3.10,<3.13` package range.

The demo downloads no model weights, starts no database, starts no GPU workload, calls no external LLM provider, and requires no provider credentials by default.

## Why This Is A Demo

The official upstream `docker-compose.yml` is a multi-service deployment. It includes Postgres with pgvector, the Khoj server image, a Terrarium sandbox, SearxNG, optional computer/operator support, model cache volumes, and example provider credentials for OpenAI, Anthropic, Gemini, and web search APIs. The Python package metadata also includes heavyweight ML and application dependencies such as Torch, sentence-transformers, transformers, Django, pgvector, psycopg2, Whisper, and provider SDKs.

Those pieces are valid for a real Khoj deployment, but they are too heavy and too credential-sensitive for the scheduled `tdx.small` prebuilt-template smoke path. This template therefore verifies real Khoj source, package, and runtime facts without pretending to operate production Khoj chat or document ingestion.

## Service

- `app`: Python HTTP verifier exposed on container and host port `42110`.

## Environment Variables

No user-supplied credentials are required for the default demo.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `KHOJ_VERIFY_TIMEOUT_SECONDS` | No | `15` | Timeout in seconds for each public upstream GitHub or PyPI verification request. |
| `KHOJ_UPSTREAM` | No | `https://github.com/khoj-ai/khoj` | Non-secret verifier constant set in the compose file. |
| `KHOJ_RELEASE` | No | `2.0.0-beta.28` | Pinned upstream release tag used for source verification. |
| `KHOJ_COMMIT` | No | `9258f57dceab19d52a1a0bdac54eb38576c29187` | Pinned upstream release commit. |
| `KHOJ_RELEASE_PUBLISHED_AT` | No | `2026-03-26T03:36:04Z` | Release timestamp recorded from GitHub. |
| `KHOJ_PYPI_VERSION` | No | `2.0.0b28` | PyPI package version checked by the verifier. |

The variables above are not secrets. Do not add real API keys, admin passwords, database passwords, Django secret keys, OAuth credentials, or provider tokens directly to `docker-compose.yml` or this README.

For production Khoj, credential-like settings such as `KHOJ_ADMIN_PASSWORD`, `KHOJ_DJANGO_SECRET_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `SERPER_DEV_API_KEY`, `FIRECRAWL_API_KEY`, or database passwords should be provided through Phala Cloud environment variables or secrets with strong unique values.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `khoj` prebuilt template.
2. Keep the default small resources for the verifier demo.
3. Optionally set `KHOJ_VERIFY_TIMEOUT_SECONDS` if the public upstream verification requests need a different timeout.
4. Deploy the CVM and open the generated public endpoint for port `42110`.
5. Check `https://<your-app-domain>/healthz`, then `https://<your-app-domain>/demo`.

The first startup pulls only the Python base image and fetches small public metadata/source files from GitHub and PyPI. If outbound access is unavailable, the service still returns JSON and reports the verification failure in `/demo`.

## Endpoints

- `GET /healthz`: readiness JSON for Phala smoke testing. Returns HTTP `200` when the lightweight verifier service is running.
- `GET /demo`: pinned release metadata, source-file SHA256 checks, PyPI metadata checks, runtime compatibility, and explicit demo-vs-production flags.
- `GET /v1/models`: OpenAI-compatible model-list shape with a single `khoj-demo-verifier` entry. It is metadata only and does not represent an inference model.
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
    "mode": "cpu-safe Khoj source and package verifier",
    "full_khoj_server_started": false,
    "postgres_started": false,
    "external_llm_provider_called": false,
    "provider_credentials_required": false,
    "model_weights_downloaded": false,
    "gpu_required": false,
    "safe_for_tdx_small_smoke": true
  }
}
```

## Local Verification

From the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/khoj/docker-compose.yml config >/dev/null
```

Optional local smoke test:

```bash
docker compose -f templates/prebuilt/khoj/docker-compose.yml up -d
curl -fsS http://localhost:42110/healthz
curl -fsS http://localhost:42110/demo
curl -fsS http://localhost:42110/v1/models
docker compose -f templates/prebuilt/khoj/docker-compose.yml down
```

## Moving To Production Khoj

Use this template as a Phala smoke-safe upstream verifier, not as a production Khoj deployment.

For production self-hosting:

1. Start from the official Khoj repository and release-matched self-hosting docs at https://github.com/khoj-ai/khoj and https://docs.khoj.dev/get-started/setup.
2. Provide strong unique values for `KHOJ_ADMIN_PASSWORD`, `KHOJ_DJANGO_SECRET_KEY`, database credentials, and any selected provider credentials.
3. Size CPU, memory, disk, and startup time for the full stack, including Postgres with pgvector, model caches, document ingestion, OCR, embeddings, search, agents, and optional local model servers.
4. Decide whether you will use hosted providers, an OpenAI-compatible local model server, or Khoj Cloud.
5. Review whether Terrarium, operator/computer support, SearxNG, web search providers, and external sandbox providers are required for your deployment.
6. Add authentication and private network controls before exposing private documents, chat history, admin endpoints, or provider-backed chat features.

## Security Notes

- The demo exposes unauthenticated health and metadata endpoints. Do not upload private documents or use it as a real chat service.
- The compose file contains no real secrets and no credential-like placeholder values for the running demo.
- The demo does not use `env_file`, host bind mounts, external build contexts, privileged mode, host networking, host IPC, Docker socket access, GPU devices, database services, or model downloads.
- The verifier fetches public upstream files from GitHub and public package metadata from PyPI. Verification failures are reported in JSON rather than hiding the fact that the full Khoj server is not running.
