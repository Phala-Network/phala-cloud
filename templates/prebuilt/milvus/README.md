# Milvus

Milvus is an open-source vector database for storing, indexing, and searching embedding vectors for AI applications such as RAG, semantic search, recommendation, and multimodal retrieval.

This Phala Cloud template adapts the official Milvus standalone Docker Compose pattern for a single-file prebuilt deployment. It uses the public `milvusdb/milvus:v2.6.17` image with internal etcd and MinIO services, named Docker volumes, and CPU-only defaults suitable for a small confidential VM.

## Upstream

- Upstream repository: `https://github.com/milvus-io/milvus`
- Project website: `https://milvus.io/`
- License: Apache 2.0
- Icon: sourced from the upstream Milvus repository at `internal/http/webui/assets/milvus-logo-CDzTGerQ.svg`

## Services

- `standalone`: Milvus standalone server.
- `etcd`: Metadata store used by Milvus.
- `minio`: Internal object storage used by Milvus.

The etcd and MinIO services are only available on the internal Compose network. This template does not expose the MinIO API or console.

## Ports

- `19530`: Milvus gRPC/client port. Use this from SDKs such as PyMilvus.
- `9091`: Milvus HTTP port. The `/healthz` endpoint is useful for smoke tests and monitoring.

## Environment Variables

No user-supplied environment variables are required for the default deployment.

The bundled MinIO service uses the public `minioadmin` default credentials internally because the official Milvus standalone pattern expects a local object store. MinIO is not exposed by this template. If you fork this template and expose MinIO, replace those values and protect the service before deployment.

## Deploy on Phala Cloud

1. Open Phala Cloud and create a new app from the prebuilt templates.
2. Select `Milvus`.
3. Keep the default resource size unless you already know your dataset needs more CPU, memory, or disk.
4. Deploy the app.
5. After the services become healthy, use the Phala Cloud endpoint for port `9091` to check health and the endpoint for port `19530` from your Milvus client.

## Verify

HTTP health check:

```bash
curl -f http://localhost:9091/healthz
```

On Phala Cloud, replace `localhost:9091` with the public endpoint mapped to port `9091`:

```bash
curl -f https://<your-9091-endpoint>/healthz
```

Client smoke test with PyMilvus:

```bash
pip install -U pymilvus
python - <<'PY'
from pymilvus import MilvusClient

client = MilvusClient(uri="http://localhost:19530")
print(client.list_collections())
PY
```

For a Phala Cloud deployment, replace `http://localhost:19530` with the endpoint for the exposed Milvus client port.

## Data Persistence

This template uses named Docker volumes only:

- `milvus-data`: Milvus local data, write-ahead data, and runtime state.
- `etcd-data`: Milvus metadata stored by etcd.
- `minio-data`: Object storage data used by Milvus.

Do not delete these volumes unless you intentionally want to remove the database. Back up all three volumes together so Milvus metadata and object storage stay consistent.

## Production Caveats

- This is a standalone Milvus deployment, not a high-availability or distributed Milvus cluster.
- The default deployment does not enable Milvus authentication, TLS, or RBAC. Do not expose it to untrusted clients without adding network controls or enabling Milvus security features in a forked template.
- The template is CPU-only and does not request GPUs or privileged container mode.
- `tdx.small`-class resources are intended for startup, evaluation, and light workloads. Increase CPU, memory, and disk before loading large collections or building memory-heavy indexes.
- Pin image digests, configure backups, add observability, and review Milvus upgrade notes before treating this as production infrastructure.
