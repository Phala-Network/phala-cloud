# langchain-ai/langchain

Deploy a CPU-safe LangChain framework demo on Phala Cloud.

## Metadata

- Template id: `langchain`
- Category: Agent Frameworks & Orchestration
- Upstream repository: https://github.com/langchain-ai/langchain
- Upstream documentation: https://docs.langchain.com/oss/python/langchain/overview
- Python package: https://pypi.org/project/langchain/
- Icon source: `.github/images/logo-light.svg` from the upstream `langchain-ai/langchain` README/tree

## What This Template Runs

LangChain is the foundational Python/JS framework for LLM chains, agents, and RAG pipelines. This template uses the upstream Python package without configuring any external LLM provider.

The deployment runs a minimal HTTP API on the public `python:3.12-slim-bookworm` image. At startup it installs `langchain`, imports real LangChain components from `langchain_core`, and serves endpoints that exercise a deterministic local chain:

```text
PromptTemplate -> RunnableLambda -> StrOutputParser
```

The demo does not download model weights, call hosted model APIs, require GPU access, or use API keys. It is intended as a small framework smoke test that fits `tdx.small`.

## Services

- `app`: Python HTTP server on internal container port `8000`. It installs and exercises LangChain.
- `proxy`: Caddy reverse proxy on public HTTP port `18080`, forwarding requests to `app:8000`.

The `app` service does not publish a host port.

## Environment Variables

No credentials are required.

- `LANGCHAIN_VERSION`: Optional LangChain Python package version installed at container startup. Default: `0.3.27`.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `langchain` prebuilt template.
2. Keep the default CPU-only resources unless you are modifying the template for a heavier app.
3. Optionally set `LANGCHAIN_VERSION` to another published PyPI version.
4. Deploy the CVM and wait for the first startup to complete.
5. Open `https://<your-app-domain>/healthz`.

The first startup downloads the pinned Python package from PyPI. No private models, hosted credentials, host bind mounts, Docker socket access, privileged mode, host networking, or GPU devices are required.

## Usage

Health check:

```bash
curl -fsS https://<your-app-domain>/healthz
```

Run the deterministic LangChain chain:

```bash
curl -fsS "https://<your-app-domain>/demo?topic=RAG"
```

List the local demo model surface:

```bash
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "external_provider_calls": false,
  "model_downloaded": false,
  "chain": ["PromptTemplate", "RunnableLambda", "StrOutputParser"]
}
```

The `/v1/models` endpoint is a compatibility-style endpoint for smoke tests. It reports the local deterministic chain and does not expose a real inference model.

## Smoke Verification

Run locally from the repository root:

```bash
docker compose -f sdks/templates/prebuilt/langchain/docker-compose.yml config >/dev/null
docker compose -f sdks/templates/prebuilt/langchain/docker-compose.yml up -d
curl -fsS http://localhost:18080/healthz
curl -fsS "http://localhost:18080/demo?topic=agents"
curl -fsS http://localhost:18080/v1/models
docker compose -f sdks/templates/prebuilt/langchain/docker-compose.yml down
```

Template validation commands:

```bash
python sdks/templates/validate.py
git -C sdks diff --check origin/main...HEAD
docker compose -f sdks/templates/prebuilt/langchain/docker-compose.yml config >/dev/null
```

## Security Notes

- This demo exposes unauthenticated health and demo endpoints because it has no private data path.
- Do not add secrets directly to the compose file. Use Phala Cloud environment variables for credentials if you adapt this into a real app.
- The container does not request GPU access, privileged mode, host networking, host IPC, host bind mounts, or Docker socket access.
- Pin `LANGCHAIN_VERSION` for reproducible deployments.
