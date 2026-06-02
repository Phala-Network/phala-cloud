# Dograh on Phala Cloud

This template runs a CPU-safe Dograh SDK verifier behind a public Caddy proxy. The app installs the real `dograh-sdk` Python package, imports it, builds a deterministic local Dograh voice workflow, serializes it to the SDK's React Flow-compatible JSON shape, and exposes JSON endpoints for smoke testing.

The default deployment does not start the full Dograh voice platform, does not place telephony calls, does not call LLM/STT/TTS providers, does not download model weights, and does not require provider credentials. Upstream Dograh's full self-hosted Docker stack is a multi-service deployment for PostgreSQL, Redis, MinIO, API, UI, optional nginx, and optional coturn; the upstream remote deployment guide calls for at least 8 GB RAM and 4 vCPUs, so this prebuilt template uses a small deterministic verifier by default.

## Metadata

- Template id: `dograh`
- Category: AI Apps & Workflows
- Upstream repo: `https://github.com/dograh-hq/dograh`
- Upstream author: `dograh-hq`
- Package: `dograh-sdk==0.1.6`
- Python runtime: `python:3.12` from the `ghcr.io/astral-sh/uv:python3.12-bookworm-slim` image
- Icon source: upstream `docs/logo/light.svg` from `dograh-hq/dograh`, inspected at commit `8f10bcade32079af126e4e9d83061cd30936fcad`

## Services

- `app`: internal Python HTTP service. At startup it installs `dograh-sdk`, imports the package, builds a local three-node Dograh workflow with SDK `Workflow.add()`, `Workflow.edge()`, `Workflow.to_json()`, and `Workflow.from_json()`, then serves JSON on port `8000`.
- `proxy`: public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

## Deploy

From this template directory:

```bash
docker compose config
docker compose up -d
```

On Phala Cloud, deploy the prebuilt template and open the public endpoint on port `8080`.

The first start can take a few minutes because the app installs the pinned Dograh SDK wheel and dependencies inside the container. The template does not require a persistent volume.

## Usage

The public HTTP API is available through Caddy on port `8080`.

```bash
curl -fsS http://localhost:8080/healthz | jq
curl -fsS http://localhost:8080/demo | jq
curl -fsS http://localhost:8080/v1/models | jq
```

Endpoints:

- `/healthz`: returns HTTP 200 only when the real `dograh-sdk` package imports successfully and the local workflow builder demo round-trips through `Workflow.from_json()`.
- `/demo`: returns package metadata, the local node-spec catalog version, a three-node workflow payload, edge labels, and flags confirming that no credentials, provider calls, model downloads, or telephony calls are used.
- `/v1/models`: returns an OpenAI-shaped model list containing a `dograh-sdk/local-workflow-demo` placeholder. It is metadata only; the default template does not host a model.

## Verification

Run these smoke checks after deployment:

```bash
docker compose ps
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo | jq '.demo.roundtrip_ok, .demo.credentials_required, .demo.provider_calls'
curl -fsS http://localhost:8080/demo | jq '.demo.node_types, .demo.edge_labels'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
```

These commands verify that the real Dograh SDK imports, the local workflow demo round-trips successfully, and the template stays credential-free by default.

Expected results:

- `GET /healthz` returns `200 OK`.
- `.demo.roundtrip_ok` is `true`.
- `.demo.credentials_required` and `.demo.provider_calls` are `false`.
- `.demo.node_types` includes `startCall`, `agentNode`, and `endCall`.
- `/v1/models` includes `dograh-sdk/local-workflow-demo`.

## Environment Variables

The default template requires no credentials.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `DOGRAH_SDK_VERSION` | `0.1.6` | No | Pinned Dograh Python SDK package version installed at container startup. Override only when testing another compatible SDK release. |
| `DOGRAH_DEMO_TITLE` | `Phala Cloud Dograh SDK demo` | No | Title returned by the `/demo` endpoint. |

Dograh API credentials such as `DOGRAH_API_KEY` and live backend URLs such as `DOGRAH_API_URL` are intentionally not required and are not consumed by the default verifier. Add them only if you replace this local verifier with an application that talks to a hosted or self-hosted Dograh backend.

## Production Notes

- Upstream Dograh is an open source voice AI platform with a visual workflow builder, SDKs, MCP integration, telephony integrations, and bring-your-own LLM/STT/TTS provider configuration.
- For a production Dograh platform deployment, follow the upstream Docker guide and size the CVM for the full multi-service stack. The upstream remote deployment docs recommend at least 8 GB RAM and 4 vCPUs and require public HTTPS for browser microphone access.
- The upstream compose file publishes PostgreSQL, Redis, MinIO, the API, the UI, and optional remote networking services. This template deliberately avoids that stack by default so it can act as a deterministic CPU-safe verifier on small Phala Cloud resources.
- The SDK's live workflow operations normally require a Dograh backend plus a `DOGRAH_API_KEY`; outbound calls and production voice agents also require configured telephony and inference providers.

## Security Notes

- Only Caddy publishes a host port: `8080:80`.
- The app service is internal and uses `expose`, not `ports`.
- The template does not use privileged mode, host networking, host IPC, Docker socket mounts, host bind mounts, or external credentials.
- No API keys, tokens, private keys, OTPs, passwords, or generated secrets are baked into the compose file.

## Cleanup

```bash
docker compose down
```

No named volumes are created by this template.
