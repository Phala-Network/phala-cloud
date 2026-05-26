# letta-ai/letta

Deploy a CPU-safe Letta SDK memory demo API on Phala Cloud.

## Metadata

- Template id: `letta`
- Display name: `letta-ai/letta`
- Category: AI Agents, Data & Storage, Developer Tools
- Upstream repository: https://github.com/letta-ai/letta
- Upstream documentation: https://docs.letta.com/
- Python package: https://pypi.org/project/letta-client/
- Icon source: `letta.png` is copied from the upstream repository asset `assets/Letta-logo-RGB_OffBlackonTransparent_cropped_small.png`
- Upstream author: Letta Team, via the `letta-ai/letta` GitHub repository

## What This Template Runs

Letta, formerly MemGPT, is an open source platform for stateful agents with long-term memory. The full Letta server can run agents backed by a database, Redis, model providers, tools, and hosted or self-hosted inference endpoints.

This template keeps the default deployment small enough for a CPU-only `tdx.small` smoke test. It runs a minimal Python HTTP API on `python:3.12-slim-bookworm`, installs the real `letta-client` SDK package at startup, imports the SDK, instantiates a local-mode `Letta` client object, and materializes SDK-shaped memory blocks with `CreateBlockParam` and `BlockResponse`.

The `/demo` endpoint performs deterministic local retrieval over three in-memory Letta-style blocks. It does not call a hosted Letta API, call an LLM provider, download model weights, start Postgres or Redis, require a GPU, request elevated container permissions, use host networking, mount host paths, or read environment-file settings.

## Service

- `app`: Python HTTP demo service exposed on container port `8080`.

## Port

- `8080`: Public HTTP endpoint for health, local memory demo output, and a compatibility-style model list.

## Environment Variables

No credentials are required for the default demo.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `LETTA_CLIENT_VERSION` | No | `1.12.0` | Pinned `letta-client` package version installed at container startup. |
| `LETTA_API_BASE_URL` | No | `http://127.0.0.1:8283` | Optional local Letta API base URL used only to instantiate the SDK client. The default demo does not call it. |

If you adapt this into a real hosted or self-hosted Letta deployment, add provider credentials and service credentials through Phala Cloud environment handling. Do not hardcode tokens, passwords, private keys, API credentials, or database URLs in the compose file or README.

## Deploy

1. Deploy the `letta` template on Phala Cloud.
2. Keep the default CPU-only resources for the smoke demo.
3. Optionally set `LETTA_CLIENT_VERSION` to another published compatible `letta-client` version.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the pinned Python package from PyPI. After startup, the health and demo endpoints use only local in-memory data and the installed SDK types.

## Endpoints

- `GET /healthz`: Returns `200` when `letta-client` imports successfully and the service is ready.
- `GET /demo`: Builds local SDK-shaped memory blocks, selects the most relevant block for the default query, and returns deterministic JSON.
- `GET /demo?query=<text>`: Runs the same local memory-block demo with a custom query.
- `GET /v1/models`: Returns an OpenAI-compatible list shape identifying the local SDK verifier. It is not a real inference model.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "demo": {
    "hosted_llm_called": false,
    "hosted_letta_called": false,
    "model_downloaded": false,
    "database_required": false,
    "gpu_required": false
  }
}
```

## Smoke Verification

Run locally from the `sdks/` directory:

```bash
docker compose -f templates/prebuilt/letta/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/letta/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/letta/docker-compose.yml down
```

Template validation commands from the `sdks/` directory:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/letta/docker-compose.yml config >/dev/null
```

## Production Caveats

- This template is a verifier/demo API, not the full Letta production server.
- The upstream Letta server image starts server infrastructure such as Postgres, Redis, database migrations, and telemetry components. Use that path when you are ready to operate a real Letta API with persistent state, authentication, model-provider configuration, and backup/upgrade procedures.
- Real Letta agents need an LLM and embedding configuration. Review model size, memory use, latency, external network calls, and credential handling before adding those pieces to a confidential VM deployment.
- The default demo endpoints are unauthenticated and contain only static local data. Add an authenticated reverse proxy or application auth before exposing private memory or agent workflows.
- Pin `LETTA_CLIENT_VERSION` for reproducible deployments.

## Security Notes

- The default compose file does not include real tokens, API keys, passwords, private keys, OTPs, connection strings, or hosted service credentials.
- The container does not request GPU access, elevated container permissions, host networking, host IPC, host bind mounts, Docker socket access, or environment-file loading.
- Keep private memory data and credentials out of the template files. Use Phala Cloud environment variables or secret handling when extending the deployment.
