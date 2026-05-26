# facebookresearch/faiss

Deploy a CPU-safe FAISS vector-search demo API on Phala Cloud.

## Metadata

- Template id: `faiss`
- Display name: `facebookresearch/faiss`
- Category: vector search / developer tooling
- Template repository: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/faiss
- Upstream repository: https://github.com/facebookresearch/faiss
- Upstream project: FAISS by Meta/Facebook Research
- Python package: `faiss-cpu==1.14.2` from https://pypi.org/project/faiss-cpu/
- Public base image: `python:3.12-slim-bookworm`
- Icon source: GitHub organization avatar fallback, `https://avatars.githubusercontent.com/u/16943930?s=256&v=4`. The upstream README and repository tree did not provide a dedicated FAISS logo, icon, or favicon.

## What This Template Runs

FAISS is Meta/Facebook Research's library for efficient similarity search and clustering of dense vectors. It is commonly used as a building block inside retrieval, recommendation, deduplication, and vector-search systems.

FAISS is a library, not a standalone production vector database service. This Phala Cloud template therefore runs a minimal HTTP demo API that installs and imports the real `faiss-cpu` Python package, builds tiny deterministic in-memory CPU indexes, and exposes JSON endpoints for health checks and smoke tests.

The default deployment does not download models, run GPU code, connect to an external database, ingest private data, or require provider credentials.

## Services

- `app`: Python stdlib HTTP API built from `python:3.12-slim-bookworm`, with inline server code mounted from the Compose `configs` section at `/app/server.py`.

The service listens on `0.0.0.0:8000` and runs as a non-root user after the image build installs `faiss-cpu`.

## Ports

- `8000`: Public HTTP endpoint for `/healthz`, `/demo`, and `/v1/models`.

## Environment Variables

No user-supplied environment variables or secrets are required for the default demo.

If you adapt this template into a real vector-search service, store any API keys, database URLs, or ingestion credentials as Phala Cloud environment variables or secrets. Do not hard-code them in `docker-compose.yml` or this README.

## Deploy On Phala Cloud

1. Deploy the `faiss` prebuilt template from Phala Cloud.
2. Keep the default `tdx.small`-friendly resources for the demo.
3. Wait for the image build and first startup to finish. The build installs the pinned `faiss-cpu` package from PyPI.
4. Open `https://<your-app-domain>/healthz` to confirm FAISS imported and a CPU index search passed.

The deployment does not need host bind mounts, privileged mode, Docker socket access, host networking, GPU devices, model downloads, external databases, or credentials.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the real `faiss` module imports, package metadata is available, and a small CPU `IndexFlatL2` build/search check passes.
- `GET /demo`: Builds a deterministic in-memory FAISS index from bundled vectors and returns nearest-neighbor search results. Optional query parameter: `k=1..5`.
- `GET /v1/models`: Returns a small OpenAI-compatible-ish model list describing the local FAISS demo index.
- `GET /`: Same readiness payload as `/healthz`.

Examples:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS "https://<your-app-domain>/demo?k=5"
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/healthz` fields include:

```json
{
  "ok": true,
  "status": "ready",
  "cpu_only": true,
  "index_check": {
    "pass": true,
    "index_type": "IndexFlatL2",
    "ntotal": 3
  },
  "package": {
    "distribution": "faiss-cpu"
  }
}
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "demo": {
    "index": {
      "type": "IndexFlatL2",
      "metric": "squared_l2"
    },
    "model_downloaded": false,
    "credentials_used": false,
    "results": [
      {
        "rank": 1,
        "id": "vec-faiss"
      }
    ]
  }
}
```

Expected `/v1/models` shape:

```json
{
  "object": "list",
  "data": [
    {
      "id": "faiss-cpu-demo-index",
      "object": "model",
      "owned_by": "Meta/Facebook Research FAISS"
    }
  ]
}
```

## Smoke Verification

Run locally from the `sdks` repository root:

```bash
docker compose -f templates/prebuilt/faiss/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/faiss/docker-compose.yml up -d --build
curl -fsS http://127.0.0.1:8000/healthz
curl -fsS http://127.0.0.1:8000/demo
curl -fsS http://127.0.0.1:8000/v1/models
docker compose -f templates/prebuilt/faiss/docker-compose.yml down --remove-orphans
```

Template validation commands from the parent worktree used by this repository:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/faiss/docker-compose.yml config >/dev/null
```

## Resource Notes

The default template target is conservative for `tdx.small`:

- `1` vCPU
- `1024` MB memory
- `10` GB disk

The running service is a tiny Python HTTP process. Most resource use happens during image build while pip installs `faiss-cpu`. The demo index contains only five vectors and is rebuilt in memory per request.

## Extending For Production

Use this template as a FAISS package/runtime smoke test, not as a production vector database.

For a real vector-search service:

1. Replace the bundled deterministic vectors with an authenticated ingestion path for documents, embeddings, and metadata.
2. Add persistent storage for serialized FAISS indexes, source records, and metadata. For example, write and read indexes with `faiss.write_index` and `faiss.read_index`.
3. Choose an index type that fits your workload, such as `IndexFlatL2` for exact search, inner-product indexes for normalized embedding similarity, or IVF/HNSW/PQ variants for larger approximate search.
4. Store metadata in a durable database or object store and keep FAISS row IDs aligned with that metadata.
5. Add authentication, request limits, backups, observability, and explicit rebuild/compaction procedures before exposing private data.
6. Review CPU, memory, and disk requirements with realistic embedding dimensions and corpus size before moving beyond the bundled demo.

Do not put real API keys, private documents, database credentials, or generated secrets in this template directory.

## Security Notes

- The default demo exposes unauthenticated smoke-test endpoints only.
- No API keys, tokens, private keys, database URLs, provider credentials, or model files are included.
- The container does not request GPU access, privileged mode, host networking, host bind mounts, external databases, or Docker socket access.
- The service process runs as a non-root user after build-time package installation.

## Cleanup

For local Docker Compose testing:

```bash
docker compose -f templates/prebuilt/faiss/docker-compose.yml down --remove-orphans
docker image rm phala-faiss-demo:1.14.2
```
