# run-llama/llama_index on Phala Cloud

Deploy a CPU-safe LlamaIndex local RAG demo API on Phala Cloud.

## Metadata

- Template id: `llama-index`
- Category: RAG (Retrieval-Augmented Generation) Platforms & Engines
- Upstream repository: https://github.com/run-llama/llama_index
- Upstream project: LlamaIndex OSS by LlamaIndex / run-llama
- Python package: https://pypi.org/project/llama-index/
- Icon source: `llama-index.svg` is copied from the upstream repository asset `docs/src/content/docs/framework/_static/assets/LlamaSquareBlack.svg`

## What This Template Runs

LlamaIndex is a data framework for building LLM applications and retrieval-augmented generation systems. The full ecosystem can connect to hosted LLMs, embedding providers, vector databases, document parsers, and LlamaCloud services.

This template keeps the default deployment safe for a CPU-only `tdx.small` smoke test. It builds a small Python HTTP service, installs the pinned `llama-index==0.14.22` package into the image, imports real LlamaIndex modules, and exposes a deterministic in-memory RAG demo.

The running container does not download models, start a GPU workload, call OpenAI, call LlamaCloud, call LlamaParse, use hosted services, or require secrets by default. The `/demo` endpoint builds a local `VectorStoreIndex` from three in-memory documents and retrieves context with a deterministic local `BaseEmbedding` implementation.

## Service

- `app`: Python HTTP demo service exposed on container port `8080`.

## Port

- `8080`: Public HTTP endpoint for health, local RAG demo output, and an OpenAI-compatible model-list shape.

## Environment Variables

No credentials are required for the default demo.

- `LLAMA_INDEX_DEMO_TOP_K`: Optional number of contexts returned by `/demo`. Default: `2`. Values are clamped to the number of bundled demo documents.

If you modify this template for real hosted LLM or LlamaCloud usage, add the provider credentials as Phala Cloud environment variables or secrets. Do not hardcode API keys in `docker-compose.yml` or this README.

## Deploy

1. Deploy the `llama-index` template on Phala Cloud.
2. Keep the default CPU-only resources for the smoke test.
3. Optionally set `LLAMA_INDEX_DEMO_TOP_K`.
4. Open `https://<your-app-domain>/healthz` after the first build and startup complete.

The image build downloads the pinned LlamaIndex Python package and dependencies from PyPI. After the container starts, the demo endpoints use only local in-memory data and local deterministic embeddings.

## Endpoints

- `GET /healthz`: Returns `200` when the LlamaIndex package and core classes import successfully.
- `GET /demo`: Builds a local in-memory `VectorStoreIndex`, retrieves demo contexts, and returns a deterministic JSON result.
- `GET /demo?query=<text>&top_k=3`: Runs the same local retrieval demo with a custom query and context count.
- `GET /v1/models`: Returns an OpenAI-compatible model-list response describing the local demo runtime.
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
  "ok": true,
  "cpu_only": true,
  "demo": {
    "embed_model": "local KeywordEmbedding(BaseEmbedding)",
    "hosted_llm_called": false,
    "model_downloaded": false,
    "network_calls": false,
    "gpu_required": false
  }
}
```

## Local Verification

From the `sdks/` repository root:

```bash
docker compose -f templates/prebuilt/llama-index/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/llama-index/docker-compose.yml up -d --build
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/llama-index/docker-compose.yml down
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/llama-index/docker-compose.yml config >/dev/null
```

## Extending The Demo

For production RAG, replace the in-memory documents and deterministic demo embedding with your own ingestion, embedding, vector store, and LLM choices. Review each component for model size, disk use, memory use, CPU latency, GPU needs, external network calls, and credential requirements before deploying.

Common real LlamaIndex integrations may require variables such as `OPENAI_API_KEY`, `LLAMA_CLOUD_API_KEY`, vector database URLs, or provider-specific tokens. Mark those as optional or required in the template config only after the compose file actually uses them, and pass them through Phala Cloud secret handling.

## Security Notes

- The default demo exposes unauthenticated health and metadata endpoints.
- The template does not request privileged mode, host networking, host IPC, GPU devices, Docker socket access, host bind mounts, or external service credentials.
- Keep API keys and private data out of the compose file and README.
