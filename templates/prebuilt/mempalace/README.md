# MemPalace/mempalace

Deploy a CPU-safe MemPalace local memory verifier on Phala Cloud.

## Metadata

- Template id: `mempalace`
- Display name: `MemPalace/mempalace`
- Category: AI Apps & Workflows
- Description: The best-benchmarked open-source AI memory system. And it's free.
- Upstream repository: https://github.com/MemPalace/mempalace
- Official docs: https://mempalaceofficial.com
- Python package: https://pypi.org/project/mempalace/
- Upstream author: `MemPalace`
- Icon source: `assets/mempalace_logo.png` from the upstream `MemPalace/mempalace` repository

## Overview

MemPalace is a local-first AI memory system for storing verbatim conversation and project history, then retrieving it through semantic search, structured memory rooms, a temporal knowledge graph, and MCP tools. The upstream project is primarily a CLI, Python package, and MCP stdio server rather than a long-running public HTTP app.

This Phala Cloud template runs a small HTTP verifier that installs the real upstream source archive from GitHub at startup. The default ref is the inspected upstream commit `9694e2cb572bbc15fb5f88e4a4c52125acb77fe3`.

The verifier uses real MemPalace local primitives:

- `SQLiteExactBackend` for local exact-vector drawer storage and retrieval.
- `KnowledgeGraph` for local SQLite entity relationship facts.
- `Dialect` for a deterministic AAAK dialect sample.

The default deployment does not call OpenAI, Anthropic, Hugging Face inference, Qdrant, Postgres, Chroma model embedding paths, browser auth, or hosted MemPalace services. It does not download embedding model weights. It uses a tiny deterministic keyword vectorizer only to exercise the upstream `sqlite_exact` backend without external credentials.

## Services

- `app`: Python HTTP server exposed on container port `8080`. It installs MemPalace from the upstream GitHub archive, seeds a small local demo palace under `/data`, and serves health/demo/model-list endpoints.

## Storage

- `mempalace-data`: Named Docker volume mounted at `/data`.
- The demo palace lives under `/data/mempalace-demo/palace`.
- The demo knowledge graph lives at `/data/mempalace-demo/knowledge_graph.sqlite3`.

## Ports

- `8080`: Public HTTP endpoint for readiness, deterministic memory retrieval, and model-list smoke checks.

## Environment Variables

No credentials are required for the default verifier.

- `MEMPALACE_REF`: Optional GitHub archive ref installed by the verifier. Default: `9694e2cb572bbc15fb5f88e4a4c52125acb77fe3`.
- `MEMPALACE_DEMO_TOP_K`: Optional default number of memory hits returned by `/demo`. Default: `2`. Values are clamped to the bundled demo document count.
- `MEMPALACE_DATA_DIR`: Internal data root for the named volume. Default: `/data`.

Production MemPalace deployments may use other settings, such as `MEMPALACE_BACKEND`, `MEMPALACE_QDRANT_URL`, `MEMPALACE_QDRANT_API_KEY`, `MEMPALACE_PGVECTOR_DSN`, `MEMPALACE_PGVECTOR_NAMESPACE`, `MEMPALACE_EMBEDDING_MODEL`, or `MEMPALACE_EMBEDDING_DEVICE`, depending on the backend and embedding path you choose. Add only the variables your production compose file actually uses, and keep real secrets in Phala Cloud environment or secret settings.

## Deploy

1. Deploy the `mempalace` template on Phala Cloud.
2. Keep the default CPU-only resource profile for the verifier.
3. Optionally set `MEMPALACE_REF` to another trusted upstream commit or release archive ref.
4. Optionally set `MEMPALACE_DEMO_TOP_K`.
5. Open `https://<your-app-domain>/healthz` after the first startup completes.

The first startup downloads the upstream MemPalace source archive and Python dependencies. The running verifier then uses only local deterministic demo data and local SQLite files.

## Endpoints

- `GET /healthz`: Returns `200` when MemPalace imports and the local backend, knowledge graph, and dialect demo initialize successfully.
- `GET /demo`: Runs deterministic local memory retrieval against the seeded MemPalace `sqlite_exact` collection.
- `GET /demo?q=<query>&top_k=3`: Runs the same local demo with a custom query and hit count.
- `GET /v1/models`: Returns an OpenAI-compatible model-list response for generic API-client smoke checks.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS "https://<your-app-domain>/demo?q=verbatim%20local%20memory&top_k=2"
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "mode": "deterministic-local-mempalace-demo",
  "cpu_safe": true,
  "credentials_required": false,
  "external_model_called": false,
  "model_downloaded": false
}
```

## Smoke Verification

Use these commands to verify the compose file and deterministic HTTP demo.

Run locally from the `sdks/` repository root:

```bash
docker compose -f templates/prebuilt/mempalace/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/mempalace/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/mempalace/docker-compose.yml down
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/mempalace/docker-compose.yml config >/dev/null
```

## Production Notes

- The upstream Docker image pattern is designed for MCP over stdio and one-off CLI commands, with persistent state under `/data`. This template adds HTTP endpoints only for Phala Cloud smoke testing and discovery.
- The default verifier does not run the upstream MCP stdio server. To use MemPalace with an MCP client, adapt the upstream Docker or CLI flow and connect the MCP client to `mempalace-mcp`.
- Real mining/search with the default Chroma path may cache an embedding model under the user's cache directory. Size depends on the chosen embedding model.
- External backends such as Qdrant and pgvector are explicit opt-in paths. If you configure them, verbatim memory text and metadata may be sent to those services.
- This verifier exposes unauthenticated JSON endpoints. Add authentication before exposing private memories, MCP write tools, or production retrieval APIs.
- Pin `MEMPALACE_REF` to a trusted commit or release for reproducible deployments.
- The compose file uses no host bind mounts, `env_file`, privileged mode, host networking, host IPC, Docker socket access, GPU devices, Compose secrets, or real credentials.

## Official Source Note

The upstream README warns that MemPalace has only three official distribution sources: the GitHub repository, the PyPI package, and the docs at `mempalaceofficial.com`. Avoid similarly named third-party domains when extending this template.
