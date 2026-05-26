# chroma-core/chroma

Deploy the official Chroma vector database server on Phala Cloud with persistent local storage and a credential-free HTTP smoke endpoint.

## What This Deploys

This template runs one service:

- `chroma`: the official `ghcr.io/chroma-core/chroma:latest` server image, listening on container port `8000` and exposed publicly on port `8000`.

Chroma is an open-source vector database for AI applications, retrieval-augmented generation, embeddings, and semantic search. This template starts a real Chroma HTTP server. It does not download embedding models, call an LLM provider, require API keys, mount host paths, or use `env_file`.

The deployment is sized for a `tdx.small` smoke test with 1 vCPU, 2048 MB memory, and 20 GB disk. Use it to verify that Chroma starts, persists local data, and responds over HTTP before adapting it for a production workload.

## Deploy On Phala Cloud

1. Create a new Phala Cloud CVM from the `chroma` prebuilt template.
2. Keep the default resources for the initial smoke test.
3. Optionally adjust the environment variables below.
4. Expose public HTTP port `8000`.
5. Deploy the CVM and wait until Phala Cloud assigns an endpoint.
6. Use the assigned endpoint as `https://<your-app-domain>` in the verification commands.

No Chroma API key, OpenAI key, embedding provider key, GPU, model download, host bind mount, or external database is required for the default deployment.

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PERSIST_DIRECTORY` | No | `/data` | Directory where Chroma stores SQLite metadata and index data. Keep this as `/data` unless you also update the named volume mount. |
| `ALLOW_RESET` | No | `FALSE` | Enables Chroma's reset behavior when set to `TRUE`. Keep disabled for persistent deployments. |
| `CHROMA_SERVER_NOFILE` | No | `65536` | File descriptor limit requested by the official Chroma entrypoint. |
| `ANONYMIZED_TELEMETRY` | No | `FALSE` | Legacy Chroma telemetry flag. Current Chroma images do not require it, but the template sets it for older compatible tags if you pin one. |

`CHROMA_HOST_ADDR` and `CHROMA_HOST_PORT` are fixed to `0.0.0.0` and `8000` in the template so Phala Cloud can expose the HTTP service reliably.

## Usage And Verification

Replace `https://<your-app-domain>` with the public endpoint shown by Phala Cloud.

Check the Chroma heartbeat endpoint:

```bash
curl -fsS https://<your-app-domain>/api/v2/heartbeat
```

Check the server version:

```bash
curl -fsS https://<your-app-domain>/api/v2/version
```

List collections in the default local tenant/database:

```bash
curl -fsS "https://<your-app-domain>/api/v2/tenants/default_tenant/databases/default_database/collections?limit=10"
```

The collection list may be empty on a fresh deployment. The heartbeat endpoint remains the simplest repeatable readiness check. The container healthcheck uses the same heartbeat route as a best-effort startup signal and intentionally stays permissive so Phala Cloud endpoint probing remains the authoritative smoke check.

For local compose validation from the `sdks/` repository root:

```bash
docker compose -f templates/prebuilt/chroma/docker-compose.yml config
docker compose -f templates/prebuilt/chroma/docker-compose.yml up -d
curl -fsS http://127.0.0.1:8000/api/v2/heartbeat
docker compose -f templates/prebuilt/chroma/docker-compose.yml down --remove-orphans
```

## Persistence Notes

- Chroma data is stored in the Docker named volume `chroma_data`.
- The named volume is mounted at `/data`, which matches `PERSIST_DIRECTORY`.
- Do not change `PERSIST_DIRECTORY` without changing the volume mount to the same path, or Chroma may write data outside the persistent volume.
- The template intentionally avoids host bind mounts so it can run cleanly in Phala Cloud.
- Back up the named volume before upgrades, migration experiments, or destructive maintenance.

## Upstream Attribution

- Upstream repository: https://github.com/chroma-core/chroma
- Upstream author: `chroma-core`
- Official Docker image used by this template: `ghcr.io/chroma-core/chroma:latest`
- Icon source: `templates/icons/chroma.png` is derived from the upstream README wordmark at `docs/assets/chroma-wordmark-color.png`.

## Production Caveats

- The default template exposes Chroma without authentication so the smoke endpoints can be verified without credentials. Add an authenticated gateway, private network policy, or application-layer auth before storing private data.
- Pin a specific Chroma image tag for production instead of `latest`, then test migrations against a copy of the persistent volume before upgrading.
- Review Chroma's operational guidance for backup, restore, migration, authorization, TLS, observability, and scaling before handling important data.
- Size CPU, memory, and disk for your embedding dimensionality, collection count, query rate, and retention needs. The default `tdx.small` resources are conservative for smoke testing, not a capacity recommendation.
- Chroma stores vectors and metadata locally in this template. For multi-node, high-availability, or managed database requirements, adapt the deployment architecture before production use.
