# microsoft/graphrag

Deploy a CPU-safe GraphRAG package/runtime demo on Phala Cloud.

## Metadata

- Template id: `graphrag`
- Display name: `microsoft/graphrag`
- Category: RAG (Retrieval-Augmented Generation) Platforms & Engines
- Template repository: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/graphrag
- Upstream repository: https://github.com/microsoft/graphrag
- Upstream owner: Microsoft
- Upstream license: MIT
- Python package: `graphrag==3.0.9` from https://pypi.org/project/graphrag/
- Public base image: `python:3.12-slim-bookworm`
- Icon source: GitHub organization avatar fallback, `https://avatars.githubusercontent.com/u/6154722?v=4`. The upstream README and repository tree did not provide a dedicated GraphRAG logo, icon, or favicon.

## What This Template Runs

GraphRAG is Microsoft's graph-based retrieval-augmented generation project for extracting structured graph context from unstructured text and using that graph for retrieval workflows.

The full upstream indexing and query flows normally require input documents, model configuration, and provider credentials for OpenAI, Azure OpenAI, or another supported LLM provider. This Phala template intentionally does not run those paid or data-dependent workflows by default.

Instead, the template builds a small HTTP service that installs and imports the real `graphrag` Python package, then exposes deterministic JSON endpoints:

- It verifies the package can be installed and imported in a CPU-only container.
- It runs a local graph/RAG-like demo over a tiny bundled corpus.
- It makes no Azure, OpenAI, external database, model download, GPU, or outbound LLM calls.
- It is sized for a `tdx.small` style deployment.

## Services

- `app`: Python HTTP server, built from `python:3.12-slim-bookworm`, with inline app code mounted from the Compose `configs` section at `/app/server.py`.

The container runs as a non-root user after the package is installed during image build. `/tmp` is backed by tmpfs for transient scratch data.

## Ports

- `8080`: Public HTTP endpoint for health, demo, and model metadata checks.

## Environment Variables

No credentials are required for this demo.

- `GRAPHRAG_PACKAGE_VERSION`: Optional build-time package version for the inline image build. Default: `3.0.9`. Changing it requires rebuilding the image.
- `GRAPHRAG_DEMO_TITLE`: Optional label returned by `/healthz` and `/demo`. Default: `GraphRAG CPU demo`.

Provider credentials such as `GRAPHRAG_API_KEY`, Azure OpenAI endpoint details, Azure deployment names, and Azure Storage connection strings are intentionally not wired into this demo service. Add them only when extending the template for real indexing/query workflows.

## Deploy

1. Deploy the `graphrag` template on Phala Cloud.
2. Keep the default CPU-only resources for the demo.
3. Do not add provider credentials unless you are modifying the template to run real GraphRAG indexing or querying.
4. Open `https://<your-app-domain>/healthz` after the image build and first startup complete.

The first deployment builds the image and installs the pinned `graphrag` package from PyPI. No private data, model weights, GPU devices, host bind mounts, privileged mode, Docker socket, host networking, or external database are required.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the `graphrag` package imported successfully.
- `GET /demo`: Runs the deterministic local graph retrieval demo with the default query.
- `GET /demo?q=graph%20retrieval`: Runs the same deterministic demo with a custom query string.
- `GET /v1/models`: Returns OpenAI-style model metadata for the local demo endpoint.
- `GET /`: Same readiness payload as `/healthz`.

Examples:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS "https://<your-app-domain>/demo?q=How%20does%20GraphRAG%20use%20graphs"
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "external_calls": false,
  "credentials_used": false,
  "demo": {
    "selected_document": {
      "id": "doc-graph"
    },
    "deterministic_answer": "The bundled demo ranks local documents, expands the GraphRAG node through knowledge-graph relationships, and returns connected context without calling an LLM provider."
  }
}
```

## Smoke Verification

Run locally from the repository root:

```bash
docker compose -f sdks/templates/prebuilt/graphrag/docker-compose.yml config >/dev/null
docker compose -f sdks/templates/prebuilt/graphrag/docker-compose.yml up -d --build
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS "http://127.0.0.1:8080/demo?q=graph%20retrieval"
curl -fsS http://127.0.0.1:8080/v1/models
docker compose -f sdks/templates/prebuilt/graphrag/docker-compose.yml down --remove-orphans
```

Template validation commands:

```bash
python sdks/templates/validate.py
git -C sdks diff --check origin/main...HEAD
docker compose -f sdks/templates/prebuilt/graphrag/docker-compose.yml config >/dev/null
```

## Extending For Real GraphRAG

Use this template as a package/runtime smoke test, not as a production GraphRAG pipeline.

For a real GraphRAG workflow:

1. Add persistent storage for the project root, input documents, generated artifacts, and vector or graph outputs.
2. Initialize a project with the upstream CLI, for example `python -m graphrag init --root /data/project`.
3. Provide a `settings.yml` or `settings.json` that defines chat and embedding models.
4. Store provider credentials as Phala Cloud environment variables or secrets. Upstream examples commonly reference `GRAPHRAG_API_KEY` in config token replacement, and Azure deployments may also need API base URL, API version, deployment name, and storage configuration.
5. Run indexing and query commands explicitly, after reviewing provider cost, rate limits, data handling, and output storage requirements.

Do not put real API keys, Azure connection strings, private documents, or generated secrets in this template directory.

## Security Notes

- The demo exposes unauthenticated JSON endpoints. Add authentication or an authenticated reverse proxy before exposing private data, indexing workflows, or provider-backed query endpoints.
- The container does not request GPU access, privileged mode, host networking, host bind mounts, external databases, or Docker socket access.
- The service process runs as a non-root user, and `/tmp` is backed by tmpfs for transient scratch data.
- The demo does not consume provider credentials even if they are present in the surrounding environment.
- Review upstream GraphRAG documentation, provider terms, data retention, and model cost before adapting this into a real RAG service.

## Cleanup

Local cleanup:

```bash
docker compose -f sdks/templates/prebuilt/graphrag/docker-compose.yml down --remove-orphans
docker image rm phala-graphrag-demo:3.0.9
```

On Phala Cloud, stop or delete the deployment when the demo is no longer needed. Remove any provider credentials you added while experimenting with real GraphRAG workflows.
