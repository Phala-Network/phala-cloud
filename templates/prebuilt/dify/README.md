# langgenius/dify

Deploy a CPU-safe Dify source and runtime verifier on Phala Cloud.

## Metadata

- Template id: `dify`
- Display name: `langgenius/dify`
- Category: LLM Application Platforms & Low-Code Builders
- Upstream repository: https://github.com/langgenius/dify
- Upstream documentation: https://docs.dify.ai
- Pinned upstream release: `1.14.2`
- Pinned upstream commit: `7f392b6950c2e6fd1b5b7f746badb3b4581d705d`
- Release page: https://github.com/langgenius/dify/releases/tag/1.14.2
- Release published: `2026-05-19T05:34:25Z`
- Upstream author: LangGenius, via the `langgenius/dify` GitHub repository
- Icon source: `dify.svg` is copied from the upstream release file `packages/iconify-collections/assets/public/common/dify.svg` at https://raw.githubusercontent.com/langgenius/dify/1.14.2/packages/iconify-collections/assets/public/common/dify.svg

## What This Template Runs

Dify is an open-source LLM app development platform for AI workflows, RAG pipelines, agents, model management, observability, and app APIs. The official self-hosted deployment is a production Docker Compose stack with API, worker, web, database, Redis, vector store, sandbox, plugin daemon, SSRF proxy, and nginx services.

This Phala Cloud template intentionally does not start that full stack. It runs one small Python `3.12-slim-bookworm` HTTP service on port `8000`. At startup, the service verifies pinned upstream Dify files from release `1.14.2` by SHA256 and checks Dify-specific source/runtime markers.

Verified upstream files:

- `README.md`
- `api/pyproject.toml`
- `web/package.json`
- `docker/docker-compose.yaml`
- `docker/.env.example`

The `/demo` response proves Dify-specific facts such as the upstream Dify description, workflow/RAG/agent features, API package version, Python runtime requirement, web package version, official Docker images, and the production compose services. It does not download model weights, call model providers, start external databases, require GPU access, use privileged mode, use host bind mounts, or store credentials.

## Why This Is A Demo

Dify's upstream README for `1.14.2` lists minimum self-hosting resources of at least 2 CPU cores and 4 GiB RAM before customization. The official Docker Compose file is also large and generated from templates. It uses environment-file references, local storage mounts under `docker/volumes`, and multiple services including API, worker, web, PostgreSQL, Redis, Weaviate or another vector store, sandbox, plugin daemon, SSRF proxy, and nginx.

That is a real production platform, not a conservative `tdx.small` smoke deployment. This template is therefore a source/runtime verifier: it proves the pinned Dify release and deployment shape without pretending to operate a production Dify dashboard.

## Services

- `app`: Python HTTP server that fetches and verifies pinned public Dify source files.

## Ports

- `8000`: Public HTTP endpoint for health, demo, and OpenAI-style model-list checks.

## Environment Variables

No user-supplied environment variables are required.

The compose file sets only non-secret verifier constants:

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DIFY_UPSTREAM` | No | `https://github.com/langgenius/dify` | Upstream repository verified by the demo. |
| `DIFY_RELEASE` | No | `1.14.2` | Pinned upstream release tag. If you change this, update all file hashes and README metadata. |
| `DIFY_COMMIT` | No | `7f392b6950c2e6fd1b5b7f746badb3b4581d705d` | Peeled Git tag commit for the pinned release. |
| `DIFY_RELEASE_PUBLISHED_AT` | No | `2026-05-19T05:34:25Z` | Release timestamp used in verifier responses. |
| `VERIFY_TIMEOUT_SECONDS` | No | `15` | Timeout for each small upstream file fetch. |
| `PORT` | No | `8000` | HTTP listen port inside the container. |

Do not put provider keys, database passwords, session tokens, or other real secrets in this template. A production Dify deployment should pass those values through Phala Cloud secret/environment management and should replace upstream example defaults before accepting real users or data.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `dify` prebuilt template.
2. Keep the default small CPU-only resources for the verifier demo.
3. Deploy the CVM and expose public HTTP port `8000`.
4. Open `https://<your-app-domain>/healthz` after the container starts.

The first startup pulls the Python base image and fetches a few small public files from GitHub. No model provider credentials, model downloads, GPU devices, privileged mode, host networking, Docker socket, external build context, host bind mounts, or external database are required.

## Endpoints

- `GET /healthz`: Readiness JSON for Phala smoke testing. It returns HTTP `200` while reporting verifier status.
- `GET /demo`: Full Dify verifier result with pinned release metadata, SHA256 checks, runtime facts, production-stack notes, and an explicit statement that full Dify is not running.
- `GET /v1/models`: OpenAI-compatible model-list shape identifying the local verifier endpoint. No LLM is loaded.
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
    "mode": "cpu-safe Dify source and runtime verifier",
    "pinned_release": "1.14.2",
    "full_stack_started": false,
    "model_weights_downloaded": false,
    "model_loaded": false,
    "provider_credentials_required": false,
    "remote_model_calls": false,
    "gpu_required": false,
    "safe_for_tdx_small_smoke": true
  }
}
```

## Smoke Verification

Run locally from the monorepo root:

```bash
docker compose -f templates/prebuilt/dify/docker-compose.yml up -d
curl -fsS http://localhost:8000/healthz
curl -fsS http://localhost:8000/demo
curl -fsS http://localhost:8000/v1/models
docker compose -f templates/prebuilt/dify/docker-compose.yml down
```

Template validation commands from the monorepo root:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/dify/docker-compose.yml config >/dev/null
```

## Security Notes

- The demo endpoints are unauthenticated and should be used for smoke testing only.
- The compose file contains no real credentials and no credential-like environment values.
- The template does not use Compose environment-file references, host bind mounts, external build contexts, privileged mode, host networking, host IPC, Docker socket access, or GPU devices.
- The verifier fetches public upstream files from GitHub. If outbound access is unavailable, endpoints still return JSON and report the verification failure.
- Do not adapt this verifier into a production app by adding secrets to `docker-compose.yml`.

## Moving To Production Dify

Use this template as a Phala smoke-safe upstream verifier, not as the production Dify deployment.

To deploy production Dify:

1. Start from the official upstream repository and release-matched Docker files at https://github.com/langgenius/dify.
2. Review the self-hosting guide at https://docs.dify.ai/getting-started/install-self-hosted.
3. Allocate resources for the full stack and workload, not just this verifier.
4. Replace upstream example credentials and generate strong values for application, database, Redis, vector store, sandbox, plugin daemon, and provider settings.
5. Configure model providers, embedding services, rerankers, observability backends, and storage explicitly.
6. Add authentication, backups, TLS routing, private network controls, and data retention policies before storing user prompts, files, knowledge bases, or production logs.
7. Avoid enabling code execution or plugin workflows until the sandbox, SSRF proxy, network rules, and secret handling have been reviewed for the target deployment.

After the production stack is running, use the upstream Dify UI and APIs rather than this verifier's `/demo` endpoint.

## Cleanup

For a local test run from the monorepo root, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/dify/docker-compose.yml down
```
