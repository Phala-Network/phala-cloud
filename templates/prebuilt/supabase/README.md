# supabase/supabase

This Phala Cloud template runs a CPU-safe Supabase-style data service:

- `db`: Postgres 17 with the `pgvector` extension, seeded with a small document table and deterministic vectors.
- `rest`: PostgREST, one of the upstream Supabase stack components, exposing the seeded Postgres schema as a REST API.
- `proxy`: Caddy on public port `8080`, exposing `/healthz` and `/rest/v1/*` for Phala Cloud HTTP endpoints.

It does not run the full upstream self-hosted Supabase stack. Supabase's Docker deployment includes Studio, Kong, Auth, Realtime, Storage, imgproxy, postgres-meta, Edge Runtime, Logflare, Vector, Supavisor, and Postgres, and the upstream docs list higher resource requirements for the complete stack. This template intentionally keeps the smoke deployment small enough for a `tdx.small` style CPU-only demo while still demonstrating the AI-relevant Postgres plus pgvector path.

## Upstream Attribution

- Upstream repository: [supabase/supabase](https://github.com/supabase/supabase)
- Upstream self-hosted Docker docs: [Self-Hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
- Supabase describes itself as a Postgres development platform with auto-generated APIs and an AI/vector toolkit. This template uses the same Postgres/PostgREST/pgvector pattern, not the hosted Supabase Cloud service.
- Icon source: `templates/icons/supabase.png` is copied from the upstream Supabase tree at `apps/docs/public/favicon/favicon-196x196.png`.

## Deploy On Phala Cloud

1. Open Phala Cloud and create a new CVM from the `supabase` prebuilt template.
2. Keep the default resources unless you plan to retain more data. The template is sized for a small demo, not the complete Supabase platform.
3. Set environment variables if you want to override the demo defaults.
4. Expose the template's HTTP service on port `8080`, then deploy the CVM and wait until the endpoint is assigned.
5. Use the assigned Phala endpoint as `https://<your-app-domain>` in the commands below.

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `POSTGRES_PASSWORD` | No | `change-this-demo-password` | Demo Postgres password used by Postgres and PostgREST. Replace it with a long random value before retaining data. Avoid whitespace because PostgREST receives it in a libpq connection string. |
| `POSTGRES_DB` | No | `supabase_demo` | Database initialized with the pgvector extension, demo table, and vector search function. |

No model provider credentials, API keys, GPUs, or model downloads are required.

## HTTP Endpoints

- `GET /healthz`: Proxies to PostgREST's OpenAPI root. It should return a non-5xx response when the database and REST layer are ready.
- `GET /rest/v1/documents?select=id,title,content,metadata`: Lists the seeded demo documents through the Supabase-style REST path.
- `POST /rest/v1/rpc/match_documents`: Runs the `match_documents(query_embedding text, match_count integer)` SQL function and orders rows with pgvector cosine distance.

## Verify

Replace `https://<your-app-domain>` with the endpoint shown by Phala Cloud.

```bash
curl -i https://<your-app-domain>/healthz
```

List the seeded documents:

```bash
curl -sS "https://<your-app-domain>/rest/v1/documents?select=id,title,content,metadata"
```

Run the pgvector similarity demo:

```bash
curl -sS \
  -X POST "https://<your-app-domain>/rest/v1/rpc/match_documents" \
  -H "Content-Type: application/json" \
  -d '{"query_embedding":"[0.95,0.12,0.05]","match_count":2}'
```

The vector RPC should return JSON rows where the confidential Postgres seed document is ranked highly for the sample embedding. A different embedding such as `[0.05,0.15,0.98]` should rank the pgvector document higher.

For local compose debugging:

```bash
docker compose -f docker-compose.yml config
docker compose -f docker-compose.yml up -d
curl -sS http://localhost:8080/rest/v1/documents?select=id,title
docker compose -f docker-compose.yml down
```

## Production Caveats

- This is a smokeable pgvector/PostgREST demo, not a complete Supabase replacement. It omits Auth, Studio, Realtime, Storage, Edge Functions, Kong, Supavisor, Logflare, and the other services from the upstream Docker stack.
- The demo REST API is anonymous and read-only for the seeded `documents` table and vector RPC. Add authentication, API gateway policy, and row-level security before exposing real data.
- Replace `POSTGRES_PASSWORD` before storing anything persistent. The default is a placeholder, not a production secret.
- Add backups, migrations, monitoring, TLS/domain policy, and a clear upgrade plan before using this with important data.
- Scale CPU, memory, disk, and Postgres settings for your workload. The default resources are chosen for a small Phala Cloud demo.
