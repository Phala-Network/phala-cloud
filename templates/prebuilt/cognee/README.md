# Cognee on Phala Cloud

Deploy a CPU-safe Cognee package-load and deterministic memory-graph HTTP demo on Phala Cloud.

## Metadata

- Template id: `cognee`
- Category: AI Memory Systems
- Upstream repository: https://github.com/topoteretes/cognee
- Upstream documentation: https://docs.cognee.ai/
- Upstream author: `topoteretes`
- Python package: `cognee==1.1.0`
- Python runtime: `python:3.12` from `ghcr.io/astral-sh/uv:python3.12-bookworm-slim`
- Icon source: upstream `assets/cognee-logo-transparent.png` from `topoteretes/cognee`, referenced by the upstream README and downloaded from the `main` branch at commit `5fedeec90fffe2b7d9d9aa626dfee32d859d91e0`

## What This Template Proves

Cognee is a memory control plane for AI agents that combines document ingestion, knowledge graphs, vector search, and cognitive memory APIs. Real Cognee `remember` and `recall` workflows need configured LLM and embedding providers, and production deployments may add external graph, vector, relational, or cache services.

This Phala Cloud prebuilt template intentionally runs a minimal HTTP demo instead of the full upstream development stack. At startup it installs the official `cognee` Python package, imports it, verifies expected API symbols, and serves deterministic JSON endpoints with a tiny local memory graph. The default path does not call LLM providers, does not download models, does not request GPU devices, does not require external databases, and does not need provider credentials.

## Services

- `app`: internal Python HTTP service. It installs `cognee`, imports the package, checks package metadata and API symbols, and serves JSON on port `8000`.
- `proxy`: public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

The template uses a named Docker volume, `cognee-data`, for Cognee logs and local runtime directories under `/data`.

## Deploy

1. Deploy the `cognee` prebuilt template on Phala Cloud.
2. Keep the default CPU-only resources for the smoke demo.
3. Optionally set `COGNEE_PACKAGE_VERSION` to another compatible published Cognee release.
4. Open the public endpoint on port `8080` after the first startup finishes.

The first start can take several minutes because the app downloads the official Cognee wheel and Python dependencies from PyPI. No private model weights, provider credentials, GPU devices, host mounts, or privileged container features are required.

Local compose check from this template directory:

```bash
docker compose config
docker compose up -d
```

## Ports and Endpoints

- Public port `8080`: Caddy proxy for the demo HTTP API.
- Internal port `8000`: Python app service, only reachable inside the Compose network.

Endpoints:

- `GET /healthz`: returns HTTP 200 when the official `cognee` package import and symbol checks pass.
- `GET /demo`: returns package metadata, a deterministic local memory-graph response, and a note that no provider calls are performed.
- `GET /demo?q=<query>`: filters the deterministic memory graph with a simple local token scorer.
- `GET /v1/models`: returns an OpenAI-shaped model-list response containing `cognee/no-llm-demo` for API-client smoke checks. It is metadata only; the default template does not host or call a model.
- `GET /`: same readiness payload as `/healthz`.

## Verification

Run these checks after deployment:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS "https://<your-app-domain>/demo?q=provider"
curl -fsS https://<your-app-domain>/v1/models
```

Expected fields from `/demo` include:

```json
{
  "ok": true,
  "mode": "deterministic-local-memory-graph",
  "cpu_safe": true,
  "external_credentials_required": false,
  "llm_provider_calls": false,
  "model_downloads": false,
  "real_cognee_operations_enabled": false
}
```

Local smoke commands from the repository root:

```bash
docker compose -f templates/prebuilt/cognee/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/cognee/docker-compose.yml down
```

Template validation commands:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/cognee/docker-compose.yml config >/dev/null
```

## Environment Variables

No credentials are required for the default smoke test.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `COGNEE_PACKAGE_VERSION` | `1.1.0` | No | Published Cognee Python package version installed at container startup. |
| `COGNEE_DEMO_TOP_K` | `2` | No | Number of deterministic memory-graph matches returned by `GET /demo`. |
| `APP_PORT` | `8000` | No | Internal app port. Caddy proxies to this port; only `8080:80` is exposed publicly. |
| `LOG_LEVEL` | `WARNING` | No | Log level passed to Cognee during import. |
| `OTEL_SDK_DISABLED` | `true` | No | Keeps OpenTelemetry SDK activity disabled in the default demo environment. |

Production Cognee applications normally add provider, embedding, database, graph, vector-store, cache, and storage settings according to the upstream documentation. Keep provider tokens and database credentials in Phala Cloud environment or secret settings, not in compose assets.

## Production Notes

- This demo does not call `cognee.remember`, `cognee.recall`, ingestion pipelines, embedding providers, hosted LLM APIs, or external graph/vector databases.
- The upstream `docker-compose.yml` is a development-oriented stack that uses local bind mounts, build contexts, optional profile services, and provider configuration. This template avoids those features so it can start deterministically as a small Phala Cloud prebuilt demo.
- To run real Cognee memory workloads, replace the deterministic demo handler with an application that configures Cognee's LLM, embedding, graph, vector, and database providers explicitly.
- Add authentication before exposing private memories, user data, ingestion endpoints, or real provider-backed Cognee operations.
- Pin `COGNEE_PACKAGE_VERSION` for reproducible deployments and test upgrades in a staging CVM before changing production memory workflows.

## Security Notes

- Only Caddy publishes a host port: `8080:80`.
- The app service is internal and uses `expose`, not `ports`.
- The template uses a named volume only; it does not use host bind mounts.
- The template does not use `env_file`, privileged mode, host networking, host IPC, Docker socket mounts, GPU devices, external build contexts, or embedded credentials.
