# weaviate/weaviate

## Overview

Weaviate is an open-source, cloud-native vector database for storing objects and vectors and querying them with vector search, keyword filtering, hybrid search, and GraphQL/REST APIs.

This Phala Cloud template runs a CPU-safe single-node Weaviate instance for smoke tests and small evaluation workloads. It uses the official Weaviate container image, persists data in a named Docker volume, exposes the HTTP API on port `8080`, and disables external vectorizer modules so the deployment does not download models or require provider credentials by default.

## Included Services

- `weaviate`: Weaviate server from `cr.weaviate.io/semitechnologies/weaviate:1.37.4`.
- `weaviate_data`: Named Docker volume mounted at `/var/lib/weaviate` for object and index persistence.

## Deployment Steps for Phala Cloud

1. In Phala Cloud, create a new deployment from the `weaviate` prebuilt template.
2. Select a small CPU profile for smoke testing. Increase memory, CPU, and disk before keeping production data or large vector indexes.
3. Deploy the template without adding model-provider credentials. The default configuration expects client applications to provide vectors directly.
4. Open the generated Phala Cloud app URL. The Weaviate HTTP API is served from the root of the app endpoint.

For local checks before deployment:

```bash
docker compose -f templates/prebuilt/weaviate/docker-compose.yml up -d
docker compose -f templates/prebuilt/weaviate/docker-compose.yml ps
```

## Environment Variables and Configuration

The template sets safe defaults in `docker-compose.yml`. These optional Phala Cloud variables can override them:

- `WEAVIATE_QUERY_DEFAULTS_LIMIT=25`: Default maximum result count for queries that do not set an explicit limit.
- `WEAVIATE_ANONYMOUS_ACCESS_ENABLED=true`: Keeps the smoke deployment simple. Do not expose production data with anonymous access.
- `WEAVIATE_AUTOSCHEMA_ENABLED=true`: Allows Weaviate to infer schema during evaluation imports.
- `WEAVIATE_LOG_LEVEL=info`: Uses normal operational logging.
- `WEAVIATE_DISABLE_TELEMETRY=true`: Disables upstream telemetry for the template default.

The template also pins these non-credential settings directly:

- `PERSISTENCE_DATA_PATH=/var/lib/weaviate`: Stores data in the named `weaviate_data` volume.
- `DEFAULT_VECTORIZER_MODULE=none`: Requires clients to provide vectors explicitly.
- `ENABLE_MODULES=`: Leaves optional inference, reranker, and backup modules disabled by default.
- `CLUSTER_HOSTNAME=node1`: Single-node cluster identity.

No API keys, tokens, private keys, or passwords are included. If you enable Weaviate API-key authentication, OIDC, backup modules, or provider-backed vectorization in a custom production variant, add your own Phala Cloud environment variables with placeholder values such as `WEAVIATE_API_KEY=<generate-a-long-random-key>` or `OPENAI_APIKEY=<optional-provider-key>`, and do not commit real credentials.

## Verification and Smoke Commands

Replace `<your-app-domain>` with the HTTPS domain assigned by Phala Cloud:

```bash
curl -fsS https://<your-app-domain>/v1/.well-known/ready
curl -fsS https://<your-app-domain>/v1/meta | jq .
curl -fsS https://<your-app-domain>/v1/schema | jq .
```

Expected results:

- `/v1/.well-known/ready` returns HTTP `200` when Weaviate is ready.
- `/v1/meta` returns version and module metadata. The default module list should be empty or contain no external inference providers.
- `/v1/schema` returns the current schema, initially empty for a fresh volume.

To smoke test direct-vector ingestion without any external model service:

```bash
curl -fsS -X POST https://<your-app-domain>/v1/schema \
  -H 'Content-Type: application/json' \
  -d '{
    "class": "Document",
    "vectorizer": "none",
    "properties": [
      { "name": "title", "dataType": ["text"] }
    ]
  }'

curl -fsS -X POST https://<your-app-domain>/v1/objects \
  -H 'Content-Type: application/json' \
  -d '{
    "class": "Document",
    "properties": { "title": "Phala Cloud confidential vector database smoke test" },
    "vector": [0.11, 0.22, 0.33, 0.44]
  }'

curl -fsS 'https://<your-app-domain>/v1/objects?class=Document&limit=1' | jq .
```

## Upstream Attribution

- Upstream project: [weaviate/weaviate](https://github.com/weaviate/weaviate)
- Upstream author: Weaviate
- Container image: `cr.weaviate.io/semitechnologies/weaviate`

## Icon Source

The local icon is saved as `templates/icons/weaviate.png`. It comes from the Weaviate logo image referenced by the upstream GitHub README: `https://weaviate.io/img/site/weaviate-logo-light.png`.

## Production Notes

- The default template is intentionally anonymous for Phala Cloud smoke testing. Enable authentication and authorization before storing private or production data.
- Keep `DEFAULT_VECTORIZER_MODULE=none` unless you intentionally add an inference module or external embedding provider. This avoids model downloads, GPU requirements, and provider credentials.
- Size CPU, memory, and disk for your object count, vector dimensions, index type, and query load. Production vector indexes can need substantially more than the smoke-test defaults.
- Back up the named volume or configure an upstream backup module in a custom deployment before relying on persisted data.
- For multi-node clustering, use a production Weaviate deployment plan with explicit raft, network, and resource settings rather than extending this single-node smoke template in place.
