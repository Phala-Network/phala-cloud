# supermemoryai/supermemory

Deploy a CPU-safe Supermemory SDK and tools verifier on Phala Cloud.
Use the smoke endpoints to verify the SDK imports and deterministic demo behavior before adapting it for production.

## Metadata

- Template id: `supermemory`
- Display name: `supermemoryai/supermemory`
- Category: AI Apps & Workflows
- Description: Memory engine and app that is extremely fast, scalable. The Memory API for the AI era.
- Upstream repository: https://github.com/supermemoryai/supermemory
- Upstream documentation: https://supermemory.ai/docs
- Upstream quickstart: https://supermemory.ai/docs/quickstart
- TypeScript SDK package: `supermemory`
- Framework tools package: `@supermemory/tools`
- Upstream author: `supermemoryai`
- Icon source: `apps/docs/images/supermemory.svg` from the upstream `supermemoryai/supermemory` repository at commit `2b60568a21e8c1f9c1fdb867050a51973e38143c`

## What This Template Runs

Supermemory is a hosted memory and context layer for AI applications, with an app, MCP support, plugins, SDKs, connectors, user profiles, hybrid search, and document processing. The upstream quickstart documents `npm install supermemory` or `pip install supermemory` and requires `SUPERMEMORY_API_KEY` for real API calls.

The upstream self-hosting documentation is enterprise-only and requires an enterprise deployment package, Cloudflare Workers, Postgres with pgvector, OpenAI, Resend, and other service credentials. Because there is no public no-secret full server image suitable for a small CPU-only Phala template, this template runs the closest honest verifier:

- Installs the real `supermemory` TypeScript SDK from npm at container startup.
- Installs the real `@supermemory/tools` package published from the upstream monorepo.
- Imports both packages, constructs a `Supermemory` client with a non-secret local placeholder key, inspects SDK resources, creates AI SDK tool wrappers, and exercises the SDK `toFile` helper.
- Uses a mock `fetch` that blocks outbound API requests before network I/O, proving request construction without calling `api.supermemory.ai`.

The default verifier does not require Supermemory credentials, does not call Supermemory's hosted API, does not call any LLM or embedding provider, does not use browser authentication, does not download model weights, does not require a GPU, and does not connect to an external database.

## Services

- `app`: Node.js HTTP service on container port `8080`. It installs the pinned packages, runs local SDK checks, and exposes JSON smoke endpoints.

## Environment Variables

No secrets are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SUPERMEMORY_SDK_VERSION` | No | `4.24.12` | Version of the official `supermemory` TypeScript SDK installed at container startup. |
| `SUPERMEMORY_TOOLS_VERSION` | No | `2.0.0` | Version of `@supermemory/tools` installed at container startup. |
| `SUPERMEMORY_DEMO_CONTAINER_TAG` | No | `phala-template` | Local container tag used in deterministic request blueprints returned by `/demo`. |
| `SUPERMEMORY_DEMO_QUERY` | No | `What does this Supermemory verifier prove?` | Local query used in deterministic request blueprints returned by `/healthz` and `/demo`. |
| `APP_PORT` | No | `8080` | Internal HTTP port. The compose file maps host port `8080` to this service. |

Do not add a real `SUPERMEMORY_API_KEY` to this template unless you replace the verifier with an application that deliberately calls the hosted Supermemory API. If you do that for production, store the key as a Phala Cloud environment variable or secret, not in `docker-compose.yml`.

## Deploy

1. Deploy the `supermemory` prebuilt template on Phala Cloud.
2. Keep the default CPU-only resource profile for the verifier: 1 vCPU, 1024 MB memory, and 10 GB disk.
3. Optionally pin `SUPERMEMORY_SDK_VERSION` and `SUPERMEMORY_TOOLS_VERSION` to specific npm releases.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first start downloads npm packages only. It does not download models, datasets, browser binaries, or private deployment bundles.

## Endpoints

- `GET /healthz`: Imports the SDK/tools packages, verifies expected local symbols/resources, proves network-backed SDK calls are blocked by mock fetch, and returns `200` when the verifier is ready.
- `GET /demo`: Returns package metadata, SDK resource method lists, deterministic Supermemory request blueprints, `toFile` helper output, AI SDK tool schemas, and no-remote-call evidence.
- `GET /demo?q=...&containerTag=...`: Runs the same local verifier with custom deterministic demo inputs.
- `GET /v1/models`: Returns an OpenAI-style metadata list with one compatibility entry, `supermemory/no-model-sdk-verifier`. It is not an inference endpoint.
- `GET /`: Same readiness payload as `/healthz`.

Example deployed smoke checks:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS "https://<your-app-domain>/demo?q=memory%20context&containerTag=phala-user"
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "demo": {
    "no_remote_call_evidence": {
      "credentials_required": false,
      "outbound_api_request_performed": false,
      "hosted_model_call_attempted": false,
      "model_weights_downloaded": false
    },
    "ai_sdk_tools": {
      "executed_network_backed_tools": false
    }
  }
}
```

## Local Verification

Run these from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/supermemory/docker-compose.yml config >/dev/null
```

Optional local smoke run:

```bash
docker compose -f templates/prebuilt/supermemory/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/supermemory/docker-compose.yml down
```

If local port `8080` is already in use, temporarily change only the host side of the mapping, for example `18080:8080`, then use `http://localhost:18080/healthz`.

## Production Notes

- This template is a no-credential SDK verifier, not the Supermemory hosted API, app, worker deployment, MCP server, or a memory database.
- Real Supermemory API usage requires a `SUPERMEMORY_API_KEY` from the Supermemory developer console and uses the hosted API unless you have an enterprise self-hosting package.
- Upstream self-hosting is documented for enterprise customers and requires Cloudflare Workers, Postgres/pgvector, provider credentials, email service credentials, and connector OAuth credentials depending on the features enabled.
- Replace the verifier with your own API or agent service before storing user data, calling `client.add`, calling `client.profile`, executing `@supermemory/tools`, or accepting private documents.
- Add authentication, rate limits, request size limits, logging policy, data retention policy, and secret management before exposing real memory workflows.
- Pin npm versions or package digests for reproducible production deployments.
- The `/v1/models` endpoint is compatibility metadata only. It does not provide chat completions, responses, embeddings, reranking, or inference.

## Security Notes

- No real API keys, tokens, private keys, passwords, OTPs, or database credentials are included.
- The demo uses a non-secret placeholder string only to satisfy SDK construction; a mock `fetch` blocks outbound API requests before network I/O.
- The compose file does not use host bind mounts, `env_file`, privileged mode, host networking, host IPC, Docker socket access, GPU device reservations, external build contexts, Compose secrets, or model downloads.
- The verifier exposes unauthenticated smoke endpoints. Add application authentication before adapting it to a real Supermemory-backed service.

## Upstream Attribution

This template uses and attributes the upstream Supermemory project:

- Repository: https://github.com/supermemoryai/supermemory
- Documentation: https://supermemory.ai/docs
- Quickstart: https://supermemory.ai/docs/quickstart
- Self-hosting documentation inspected: `apps/docs/deployment/self-hosting.mdx` in the upstream repository
- Runtime packages inspected: `supermemory@4.24.12` and `@supermemory/tools@2.0.0`
