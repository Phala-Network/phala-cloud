# lancedb/lancedb

This Phala Cloud prebuilt template runs a CPU-safe HTTP demo of the real `lancedb` Python package. LanceDB is primarily an embedded/serverless vector database library and cloud product, not a production standalone server, so this template exposes a small demo API that imports LanceDB, creates a local database in a named volume, inserts fixed sample rows, and performs deterministic vector search.

The default deployment does not use external LLM providers, API keys, model downloads, GPUs, host bind mounts, or an `env_file`.

## Metadata

- Template id: `lancedb`
- Upstream repository: `https://github.com/lancedb/lancedb`
- Upstream author: `lancedb`
- Python package: `lancedb==0.30.2`
- Public port: `8000`
- Icon source: `templates/icons/lancedb.png` copied from the upstream repository path `docs/src/assets/logo.png`

## Services

- `app`: Python 3.12 HTTP service using the `ghcr.io/astral-sh/uv:python3.12-bookworm-slim` image. At startup it installs `lancedb`, imports the package, creates `/data/lancedb`, seeds a `documents` table with fixed text/vector rows, and serves JSON on port `8000`.

## Deploy

On Phala Cloud:

1. Create a CVM from the `lancedb` prebuilt template.
2. Keep the default CPU-only resources for the demo.
3. Expose HTTP port `8000`.
4. Wait for the container health check to pass, then use the assigned endpoint as `https://<your-app-domain>`.

For local compose testing from the repository root:

```bash
docker compose -f templates/prebuilt/lancedb/docker-compose.yml config
docker compose -f templates/prebuilt/lancedb/docker-compose.yml up -d
```

The first start downloads the pinned `lancedb` wheel and its Python dependencies from PyPI. It does not download embedding models or call model/provider APIs.

## Usage

The API is available on port `8000`.

```bash
curl -fsS http://localhost:8000/healthz | jq
curl -fsS http://localhost:8000/demo | jq
curl -fsS http://localhost:8000/demo?top_k=2 | jq '.results'
curl -fsS http://localhost:8000/v1/models | jq
```

With a Phala Cloud endpoint:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo?top_k=2
curl -fsS https://<your-app-domain>/v1/models
```

Endpoints:

- `GET /healthz`: Returns `200 OK` only after the real `lancedb` package imports, the local database is created, the sample table is seeded, and a startup vector search ranks the expected row first.
- `GET /demo`: Runs a deterministic vector search against the local LanceDB table. Optional query parameter: `top_k`, clamped from `1` to `4`.
- `GET /v1/models`: Returns an OpenAI-shaped model list for compatibility checks. It is metadata only; the template does not host or call an LLM.
- `GET /`: Returns service metadata and endpoint names.

Expected `/demo` behavior:

```json
{
  "ok": true,
  "query": {
    "vector": [0.94, 0.18, 0.08, 0.02],
    "top_k": 3
  },
  "results": [
    {
      "id": 1,
      "topic": "vector-search"
    }
  ]
}
```

The actual response includes additional fields such as package metadata, database path, text, vectors, and LanceDB distance values.

## Verification

Run these checks after deployment:

```bash
curl -i http://localhost:8000/healthz
curl -fsS http://localhost:8000/demo?top_k=2 | jq '.ok, .results[0].id, .results[0].topic'
curl -fsS http://localhost:8000/v1/models | jq '.data[0].id'
```

Expected results:

- `/healthz` returns `200 OK`.
- `/demo` returns `"ok": true`.
- The first result has `id` `1` and topic `vector-search`.
- `/v1/models` includes `lancedb/deterministic-vector-search-demo`.

Template validation commands from the repository root:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/lancedb/docker-compose.yml config >/dev/null
```

## Storage Volume

The template creates a named Docker volume:

| Volume | Mount path | Contents |
| --- | --- | --- |
| `lancedb_data` | `/data/lancedb` | Local LanceDB database files for the seeded `documents` table. |

The demo re-seeds the table on every container start with the same rows so verification stays deterministic. When adapting this template for an application, keep the named volume for local LanceDB persistence and remove the startup overwrite logic.

To remove local demo data:

```bash
docker compose -f templates/prebuilt/lancedb/docker-compose.yml down -v
```

## Environment Variables

No credentials are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `LANCEDB_VERSION` | No | `0.30.2` | Pinned `lancedb` Python package version installed at container startup. |

Internal runtime values are fixed by the compose file: `APP_PORT=8000` and `LANCEDB_DATA_DIR=/data/lancedb`.

## Security Notes

- The demo API is unauthenticated. Add an authenticated reverse proxy before exposing private data or adapting it for production workloads.
- The template does not use privileged mode, host networking, host IPC, Docker socket mounts, host bind mounts, GPU settings, `env_file`, or baked-in secrets.
- The `/v1/models` endpoint is only a compatibility-shaped metadata endpoint. LanceDB is the vector database component; no LLM is loaded or called.
- This is a CPU-safe demo of the real LanceDB package, not a managed LanceDB Cloud replacement or a production standalone vector database service.
