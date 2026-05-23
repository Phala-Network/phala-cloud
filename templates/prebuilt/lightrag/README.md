# HKUDS/LightRAG on Phala Cloud

Deploy a CPU-safe LightRAG package/runtime verifier and deterministic local RAG-style demo API on Phala Cloud.

## Metadata

- Template id: `lightrag`
- Display name: `HKUDS/LightRAG`
- Category: RAG (Retrieval-Augmented Generation) Platforms & Engines
- Template repository: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/lightrag
- Upstream repository: https://github.com/HKUDS/LightRAG
- Upstream project: LightRAG by HKUDS
- Python package: `lightrag-hku==1.4.16` from https://pypi.org/project/lightrag-hku/
- Public base image: `python:3.11-slim-bookworm`
- Icon source: `lightrag.png` is copied from the upstream repository asset `assets/logo.png` at https://raw.githubusercontent.com/HKUDS/LightRAG/main/assets/logo.png. GitHub API reported blob SHA `1d2d3a429174e82ee30db7d535368400818d7856`.

## What This Template Runs

LightRAG is HKUDS's simple and fast retrieval-augmented generation framework. The upstream project includes a core Python package and a server/Web UI path for document indexing, graph exploration, and RAG querying.

The full LightRAG server and indexing workflow usually require user documents, an LLM model function, an embedding model, provider configuration, optional storage backends, and sometimes hosted services. This Phala Cloud template deliberately keeps the default deployment CPU-only and credential-free.

This template builds a small Python HTTP service that:

- Installs and imports the real `lightrag-hku==1.4.16` package.
- Verifies core symbols from the installed package: `LightRAG`, `QueryParam`, `EmbeddingFunc`, `compute_mdhash_id`, and `cosine_similarity`.
- Constructs a real `LightRAG` object with a local deterministic `EmbeddingFunc` and calls `initialize_storages()` against tmpfs-backed local storage.
- Serves a deterministic local retrieval demo over bundled text snippets.
- Makes no OpenAI, Azure OpenAI, Gemini, Ollama, model download, external database, GPU, or hosted LLM call by default.

The `/demo` endpoint is an honest verifier and local retrieval smoke test. It is not the full upstream LightRAG API server or Web UI.

## Service

- `app`: Python HTTP demo service exposed on container port `8080`.

The image is built from the public `python:3.11-slim-bookworm` base image using an inline Dockerfile. The container runs as a non-root user after package installation. `/tmp` is mounted as tmpfs and used for the temporary LightRAG runtime storage files.

## Port

- `8080`: Public HTTP endpoint for health, demo retrieval, and OpenAI-compatible model-list metadata.

## Environment Variables

No credentials are required for the default demo.

- `LIGHTRAG_PACKAGE_VERSION`: Optional build-time package version installed by the inline image build. Default: `1.4.16`. Changing it requires rebuilding the image.
- `LIGHTRAG_DEMO_TOP_K`: Optional number of local demo contexts returned by `/demo`. Default: `2`. Values are clamped to the bundled demo document count.

Provider variables such as `OPENAI_API_KEY`, Azure OpenAI endpoint values, Ollama server URLs, Gemini API keys, vector database URLs, and storage credentials are intentionally not wired into this demo. Add them only when you extend the template to run a real LightRAG server or indexing/query workflow.

## Deploy

1. Deploy the `lightrag` template on Phala Cloud.
2. Keep the default CPU-only resources for the smoke test.
3. Optionally set `LIGHTRAG_DEMO_TOP_K`.
4. Open `https://<your-app-domain>/healthz` after the first image build and startup complete.

The first deployment builds the image and installs the pinned `lightrag-hku` package from PyPI. No private data, model weights, GPU devices, host bind mounts, privileged mode, Docker socket, host networking, external database, or provider credentials are required.

## Endpoints

- `GET /healthz`: Returns `200` when the LightRAG package imports, the verifier symbols are available, and local `LightRAG.initialize_storages()` completes.
- `GET /demo`: Runs the deterministic local retrieval demo with the default query.
- `GET /demo?q=provider%20credentials&top_k=3`: Runs the same local retrieval demo with a custom query and context count.
- `GET /v1/models`: Returns an OpenAI-compatible model-list response describing the local verifier runtime.
- `GET /`: Same readiness payload as `/healthz`.

Examples:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS "https://<your-app-domain>/demo?q=How%20does%20LightRAG%20avoid%20provider%20credentials"
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "demo": {
    "credentials_used": false,
    "external_calls": false,
    "gpu_required": false,
    "model_downloaded": false,
    "query_param": {
      "class": "lightrag.lightrag.QueryParam",
      "mode": "naive"
    }
  }
}
```

## Local Verification

From the `sdks/` repository root:

```bash
docker compose -f templates/prebuilt/lightrag/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/lightrag/docker-compose.yml up -d --build
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS "http://127.0.0.1:8080/demo?q=LightRAG%20provider%20credentials"
curl -fsS http://127.0.0.1:8080/v1/models
docker compose -f templates/prebuilt/lightrag/docker-compose.yml down --remove-orphans
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/lightrag/docker-compose.yml config >/dev/null
```

## Extending For Real LightRAG

Use this template as a package/runtime smoke test, not as a production LightRAG deployment.

For a real LightRAG workflow:

1. Decide whether to run the upstream LightRAG Server/API/Web UI or embed LightRAG Core in your own app.
2. Add persistent storage for input documents, working directories, generated graph/vector files, caches, and selected external storage backends.
3. Configure an LLM provider and embedding provider that match your latency, privacy, language, cost, and data-retention requirements.
4. Store provider credentials as Phala Cloud environment variables or secrets. Do not hardcode API keys in `docker-compose.yml` or this README.
5. Review upstream LightRAG documentation for server configuration, storage backends, multimodal parsing, API authentication, and supported model integrations before exposing production data.

## Limitations

- The default demo does not run the upstream LightRAG Server, Web UI, document upload API, or production indexing pipeline.
- The bundled retrieval corpus is tiny and static. It exists only to prove a deterministic local RAG-style path.
- The local embedding is a simple keyword-count vector, not a semantic embedding model.
- The local LLM function is a deterministic placeholder and is not used to generate natural-language answers.
- All LightRAG runtime files are written under tmpfs-backed `/tmp/lightrag-runtime`, so they disappear when the container restarts.
- The demo endpoints are unauthenticated. Add authentication or an authenticated reverse proxy before adapting this template for private data.

## Security Notes

- The container does not request privileged mode, host networking, host IPC, GPU devices, Docker socket access, host bind mounts, external databases, or real secrets.
- The service runs as a non-root user and uses tmpfs for transient runtime files.
- The demo does not consume provider credentials even if they are present in the surrounding environment.
- Review upstream LightRAG documentation, provider terms, data retention, model costs, and storage behavior before adapting this into a real RAG service.

## Cleanup

Local cleanup:

```bash
docker compose -f templates/prebuilt/lightrag/docker-compose.yml down --remove-orphans
docker image rm phala-lightrag-demo:1.4.16
```

On Phala Cloud, stop or delete the deployment when the demo is no longer needed. Remove any provider credentials you added while experimenting with real LightRAG workflows.
