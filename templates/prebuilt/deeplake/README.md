# activeloopai/deeplake on Phala Cloud

Deploy a CPU-safe Deep Lake package demo on Phala Cloud. The template installs the real `deeplake` Python package, writes a tiny deterministic local dataset to a named Docker volume, and exposes JSON endpoints for package, dataset, and vector-search smoke testing.

This is not a hosted production Deep Lake SaaS credential wrapper. The default service does not connect to Activeloop Cloud, external object storage, external databases, hosted LLM providers, model downloads, GPU devices, or API-key based services.

## Metadata

- Template id: `deeplake`
- Display name: `activeloopai/deeplake`
- Category: Vector Databases & Search Infrastructure / AI data lake / vector database library
- Upstream repository: https://github.com/activeloopai/deeplake
- Upstream documentation: https://docs.deeplake.ai/
- Python package: `deeplake==4.6.2`
- Upstream author: `activeloopai`
- Icon source: `https://i.postimg.cc/rsjcWc3S/deeplake-logo.png`, the Deep Lake logo image referenced by the upstream `activeloopai/deeplake` README on the `main` branch, inspected via README blob `4e694f1f72ba0fe9630db401153b5a98346a416f`

## What This Template Runs

The compose file starts two services:

- `app`: internal Python HTTP service on port `8000`. At startup it uses `uv pip install` to install the pinned `deeplake` package, imports `deeplake`, and serves the demo API.
- `proxy`: public Caddy reverse proxy that exposes `8080:80` and forwards requests to the internal app.

The `/demo` endpoint creates a fresh tiny Deep Lake dataset under the named Docker volume mounted at `/data/deeplake`. It adds `Text` and `Embedding` columns, appends four deterministic rows, commits the dataset, builds indexes, and runs a TQL `cosine_similarity` query against deterministic local embeddings. Resource use is intentionally small enough for a `tdx.small` style CPU-only deployment.

The template does not use privileged mode, host networking, host bind mounts, `env_file`, external build contexts, Docker socket mounts, GPU reservations, or real secrets.

## Deploy

Deploy the `deeplake` prebuilt template on Phala Cloud and keep the default CPU resources for the smoke demo. The first startup downloads the pinned Deep Lake wheel and small Python dependencies from PyPI.

Open the public HTTP endpoint on port `8080` after startup:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

For local Docker Compose testing from the repository root:

```bash
docker compose -f templates/prebuilt/deeplake/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS "http://localhost:8080/demo?query=Deep%20Lake%20vector%20search&top_k=2"
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/deeplake/docker-compose.yml down
```

Use `down -v` only when you also want to remove the local named volume and its tiny demo dataset:

```bash
docker compose -f templates/prebuilt/deeplake/docker-compose.yml down -v
```

## Usage

The public API is available through Caddy on port `8080`.

Endpoints:

- `GET /healthz`: returns `200 OK` when the real `deeplake` package imports and expected symbols are available.
- `GET /demo`: creates the tiny local Deep Lake dataset, builds indexes, runs deterministic TQL vector search, and returns the ranked hits.
- `GET /demo?query=<text>&top_k=<n>`: overrides the default query and result count. `top_k` is clamped between `1` and the four seeded documents.
- `GET /v1/models`: returns an OpenAI-shaped model list describing the local smoke endpoint. It is metadata only; the default template does not host an LLM model.
- `GET /`: returns service metadata and the endpoint list.

Example `/demo` response fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "hosted_saas_wrapper": false,
  "remote_model_calls": false,
  "model_downloaded": false,
  "demo": {
    "dataset_length": 4,
    "columns": ["id", "text", "embedding"],
    "vector_size": 8,
    "deeplake_operations": [
      "deeplake.create(local_path)",
      "Dataset.add_column(Text, Embedding)",
      "Dataset.append(seed_rows)",
      "Dataset.commit()",
      "Dataset.build_indexes()",
      "Dataset.query(TQL cosine_similarity)"
    ]
  }
}
```

## Environment Variables

No credentials are required.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `DEEPLAKE_VERSION` | `4.6.2` | No | Pinned Deep Lake Python package version installed at container startup. Override only when testing another compatible release. |
| `DEEPLAKE_DATA_ROOT` | `/data/deeplake` | No | Internal path for the named-volume backed demo dataset. The compose file mounts the `deeplake-data` volume here. |
| `DEEPLAKE_DEMO_TOP_K` | `2` | No | Default number of vector-search hits returned by `/demo` when the request does not include `top_k`. |

Provider credentials such as Activeloop tokens, cloud storage keys, OpenAI keys, or other model API keys are intentionally not required and are not consumed by this template.

## Verification

Run the required template checks from the repository root:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/deeplake/docker-compose.yml config >/dev/null
```

Smoke-test a running deployment:

```bash
curl -i http://localhost:8080/healthz
curl -fsS "http://localhost:8080/demo?query=local%20Deep%20Lake%20vector%20search" | jq '.ok, .demo.hits[0].id, .demo.deeplake_operations'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `/demo` returns `"ok": true`.
- `/demo` includes `deeplake.create(local_path)`, `Dataset.add_column(Text, Embedding)`, and `Dataset.query(TQL cosine_similarity)` in `deeplake_operations`.
- `/v1/models` includes `deeplake-local-vector-demo`.

## Security Notes

- The demo endpoints are unauthenticated. Put an authenticated proxy or application layer in front of the service before adapting it for private data.
- No real secrets are present in the compose file, README, or default environment.
- The default dataset contains only four synthetic rows and is recreated by `/demo`.
- Only the Caddy proxy publishes a host port. The app service is internal and uses `expose`, not `ports`.
- The named Docker volume is used only for the local Deep Lake smoke dataset.
- This CPU-safe demo is meant to prove that the real Deep Lake library can run on Phala Cloud; production Deep Lake workloads should add their own application code, authentication, storage policy, and resource sizing.

## Cleanup

For a local test run from the repository root:

```bash
docker compose -f templates/prebuilt/deeplake/docker-compose.yml down
```

Remove the tiny named-volume dataset as well:

```bash
docker compose -f templates/prebuilt/deeplake/docker-compose.yml down -v
```
