# qdrant/qdrant

## Overview

Qdrant is an open-source vector search engine and vector database for storing embedding vectors, payload metadata, and similarity-search indexes behind a REST API.

This Phala Cloud prebuilt template runs the official `qdrant/qdrant` container image as a CPU-safe, credential-free single-node service. It persists data in a named Docker volume, exposes the HTTP REST API on port `6333`, avoids GPU settings and model downloads, and does not require provider credentials for the default smoke path.

## Included Services

- `qdrant`: Official `qdrant/qdrant:latest` server image.
- `qdrant_storage`: Named Docker volume mounted at `/qdrant/storage` for collections, indexes, snapshots, and local runtime state.

The template exposes public HTTP port `6333`. Qdrant's gRPC port `6334` is not published by default so the Phala smoke path stays focused on the REST API. Add it in a fork only when a trusted client needs gRPC access and you have added the right network and authentication controls.

## Phala Cloud Deployment

1. Create a new Phala Cloud CVM from the `qdrant` prebuilt template.
2. Keep the default CPU-only resources for the first smoke test.
3. Leave all environment variables at their defaults unless you need to tune logging, CORS, or telemetry.
4. Expose HTTP port `6333`.
5. Deploy the CVM and wait for Phala Cloud to assign an HTTPS endpoint.
6. Use that endpoint as `https://<your-app-domain>` in the verification commands below.

No Qdrant API key, model provider key, embedding service, GPU, host bind mount, `env_file`, privileged mode, or external database is required for the default deployment.

For local compose testing from this checkout root:

```bash
docker compose -f templates/prebuilt/qdrant/docker-compose.yml config
docker compose -f templates/prebuilt/qdrant/docker-compose.yml up -d
curl -fsS http://127.0.0.1:6333/readyz
docker compose -f templates/prebuilt/qdrant/docker-compose.yml down --remove-orphans
```

## Environment Variables and Configuration

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `QDRANT_LOG_LEVEL` | No | `INFO` | Qdrant server log level passed to `QDRANT__LOG_LEVEL`. |
| `QDRANT_ENABLE_CORS` | No | `true` | Enables CORS headers on the REST API. Keep enabled for browser-based smoke clients; restrict it in a production fork if needed. |
| `QDRANT_TELEMETRY_DISABLED` | No | `true` | Disables upstream usage telemetry for the default Phala Cloud template. |

The compose file fixes these non-credential settings:

- `QDRANT__STORAGE__STORAGE_PATH=/qdrant/storage`
- `QDRANT__SERVICE__HTTP_PORT=6333`
- Named volume `qdrant_storage:/qdrant/storage`

This template intentionally does not define `QDRANT__SERVICE__API_KEY` or `QDRANT__SERVICE__READ_ONLY_API_KEY`. If you fork the template for production and enable API-key authentication, add required Phala Cloud variables with placeholder descriptions and never commit real keys.

## Verification and Smoke Commands

Replace `https://<your-app-domain>` with the public endpoint assigned by Phala Cloud.

Readiness check:

```bash
curl -fsS https://<your-app-domain>/readyz
```

List collections:

```bash
curl -fsS https://<your-app-domain>/collections
```

Create a tiny direct-vector collection:

```bash
curl -fsS -X PUT https://<your-app-domain>/collections/phala_smoke \
  -H 'Content-Type: application/json' \
  -d '{
    "vectors": {
      "size": 4,
      "distance": "Cosine"
    }
  }'
```

Upsert two points without calling any embedding model:

```bash
curl -fsS -X PUT 'https://<your-app-domain>/collections/phala_smoke/points?wait=true' \
  -H 'Content-Type: application/json' \
  -d '{
    "points": [
      {
        "id": 1,
        "vector": [0.10, 0.20, 0.30, 0.40],
        "payload": {
          "text": "Phala Cloud Qdrant smoke test"
        }
      },
      {
        "id": 2,
        "vector": [0.40, 0.30, 0.20, 0.10],
        "payload": {
          "text": "Second deterministic vector"
        }
      }
    ]
  }'
```

Query the collection:

```bash
curl -fsS -X POST https://<your-app-domain>/collections/phala_smoke/points/query \
  -H 'Content-Type: application/json' \
  -d '{
    "query": [0.10, 0.20, 0.30, 0.40],
    "limit": 1,
    "with_payload": true
  }'
```

Expected results:

- `/readyz` returns HTTP `200` when Qdrant is ready.
- `/collections` returns JSON with a `collections` list, initially empty on a fresh volume.
- The collection create and point upsert requests return success JSON.
- The query returns the `phala_smoke` point nearest to the query vector and includes its payload.

Optional cleanup:

```bash
curl -fsS -X DELETE https://<your-app-domain>/collections/phala_smoke
```

## Upstream Attribution

- Upstream repository: https://github.com/qdrant/qdrant
- Upstream author: `qdrant`
- Official container image: `qdrant/qdrant`
- Project documentation: https://qdrant.tech/documentation/

## Icon Source

The local icon is saved as `templates/icons/qdrant.svg`. It is copied from the upstream Qdrant repository asset at `docs/logo.svg`, which is referenced by the upstream README: https://github.com/qdrant/qdrant/blob/master/docs/logo.svg

## Production Notes

- The default template is intentionally unauthenticated so Phala Cloud can smoke the HTTP API without credentials. Do not store private or production data on a publicly reachable anonymous Qdrant endpoint.
- For production, enable Qdrant API-key authentication or place Qdrant behind an authenticated gateway/private network policy before exposing data.
- Pin a specific `qdrant/qdrant` image tag or digest before production upgrades, then test migrations against a copy of the persistent volume.
- Back up the named volume and review Qdrant snapshot/restore guidance before relying on persisted collections.
- Size CPU, memory, and disk for vector dimensionality, collection count, payload size, index type, and query rate. The default resources are intended for smoke tests and small evaluation workloads.
- Keep gRPC port `6334` unpublished unless a trusted client explicitly needs it.
- Review Qdrant security, telemetry, backup, TLS, and scaling guidance before handling important data.
