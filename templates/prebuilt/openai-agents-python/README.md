# OpenAI Agents SDK Python on Phala Cloud

This template runs a CPU-safe OpenAI Agents SDK Python smoke service behind a public Caddy proxy. The app installs the real `openai-agents` Python package, imports the `agents` module, constructs SDK objects such as `Agent` and `FunctionTool`, inspects a `function_tool` JSON schema, and exposes JSON endpoints for verification.

The default service does not call OpenAI APIs, does not invoke a hosted model, does not download model weights, does not require provider credentials, does not use a GPU, and does not connect to an external database. It is intended as a deterministic `tdx.small` readiness template for the SDK primitives, not as a production agent runner.

## Metadata

- Template id: `openai-agents-python`
- Category: Agent Frameworks & Orchestration
- Upstream repository: `https://github.com/openai/openai-agents-python`
- Upstream documentation: `https://openai.github.io/openai-agents-python/`
- Upstream author: `OpenAI`
- Package: `openai-agents==0.17.4`
- Import module: `agents`
- Python runtime: `python:3.12` from `ghcr.io/astral-sh/uv:python3.12-bookworm-slim`
- Template asset repository: `https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/openai-agents-python`
- Icon source: upstream `docs/assets/logo.svg` from `openai/openai-agents-python`

## Services

- `app`: internal Python HTTP service. At startup it installs `openai-agents`, imports `agents`, disables SDK tracing, constructs local SDK primitives, and serves JSON on port `8000`.
- `proxy`: public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

## Endpoints

The public HTTP API is available through Caddy on port `8080`.

```bash
curl -fsS http://localhost:8080/healthz | jq
curl -fsS http://localhost:8080/demo | jq
curl -fsS http://localhost:8080/v1/models | jq
```

- `GET /healthz`: returns HTTP 200 only when the real `openai-agents` distribution imports as module `agents`, expected SDK symbols are present, and local `Agent` plus `function_tool` construction succeeds.
- `GET /demo`: returns package metadata, constructed `Agent` details, inspected `FunctionTool` schema, a direct local Python function result, and explicit evidence that no `Runner`, hosted model, OpenAI API request, model download, GPU, or external database is used.
- `GET /v1/models`: returns an OpenAI-shaped model-list response with one metadata-only entry, `openai-agents-python/no-model-local-sdk-demo`. It is not a hosted inference model.
- `GET /`: returns the readiness payload and endpoint list.

Expected `/demo` fields include:

```json
{
  "ok": true,
  "demo": {
    "agent_construction": {
      "name": "Local SDK Inspector",
      "model": null,
      "runner_invoked": false
    },
    "function_tool_schema": {
      "name": "local_topic_summary",
      "strict_json_schema": true
    }
  },
  "no_remote_call_evidence": {
    "hosted_model_call_attempted": false,
    "model_downloaded": false,
    "gpu_required": false
  }
}
```

## Local Verification

Run these from the `sdks` repository root:

```bash
python3 templates/validate.py
docker compose -f templates/prebuilt/openai-agents-python/docker-compose.yml config >/dev/null
git diff --check origin/main...HEAD
```

If Docker Engine is available locally, run the endpoint smoke test:

```bash
docker compose -f templates/prebuilt/openai-agents-python/docker-compose.yml up -d
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo | jq '.sdk.import_ok, .demo.agent_construction.runner_invoked, .no_remote_call_evidence.hosted_model_call_attempted'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
docker compose -f templates/prebuilt/openai-agents-python/docker-compose.yml down
```

Expected results:

- `/healthz` returns `200 OK`.
- `.sdk.import_ok` is `true`.
- `.demo.agent_construction.runner_invoked` is `false`.
- `.no_remote_call_evidence.hosted_model_call_attempted` is `false`.
- `/v1/models` includes `openai-agents-python/no-model-local-sdk-demo`.

The first start downloads Python wheels from PyPI because the package is installed inside the container at startup. This is package installation only; the template does not download model weights or datasets.

## Environment Variables

The default template requires no credentials and intentionally does not define `OPENAI_API_KEY`.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `OPENAI_AGENTS_VERSION` | `0.17.4` | No | Pinned `openai-agents` Python package version installed at container startup. Override only when testing another compatible release. |
| `OPENAI_AGENTS_DISABLE_TRACING` | `true` | No | Disables OpenAI Agents SDK tracing for the local no-remote-call demo. The app also calls `set_tracing_disabled(True)`. |
| `OPENAI_AGENTS_DONT_LOG_MODEL_DATA` | `true` | No | Keeps model-data logging disabled if you later extend this service. The default demo does not call a model. |
| `OPENAI_AGENTS_DONT_LOG_TOOL_DATA` | `true` | No | Keeps tool-data logging disabled if you later extend this service. The default demo only exposes synthetic local tool data. |
| `APP_PORT` | `8000` | No | Internal app port. Caddy proxies to this port; the host only exposes `8080:80`. |

Provider credentials such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, OpenAI-compatible base URLs, vector database URLs, or model registry tokens are not required and are not consumed by this default template. Add secrets only if you replace the demo with a real agent workflow that deliberately calls an external provider.

## Phala Deployment Notes

1. Deploy the `openai-agents-python` prebuilt template on Phala Cloud.
2. Use the default small CPU resources for the smoke demo: `1` vCPU, `1024` MB memory, and `10` GB disk.
3. Wait for startup to complete while the container installs the pinned Python package.
4. Open `https://<your-app-domain>/healthz`, `https://<your-app-domain>/demo`, and `https://<your-app-domain>/v1/models` on the public endpoint for port `8080`.

The deployment does not need host bind mounts, named volumes, `env_file`, privileged mode, host networking, Docker socket access, GPU access, model downloads, external databases, or API keys.

## Limitations

- This is a package and SDK primitive verifier, not an agent inference server.
- `/v1/models` is a compatibility-shaped metadata endpoint. It does not imply that chat completions, responses, or embeddings are available.
- The demo intentionally does not call `Runner.run`, configure a model, create an OpenAI client request, execute hosted tools, or use tracing upload.
- Real OpenAI Agents SDK applications normally need a model provider, provider credentials, tool integrations, and application-specific authentication. Add those through Phala Cloud deployment secrets only after replacing the smoke service with your own agent application.

## Security Notes

- Only Caddy publishes a host port: `8080:80`.
- The app service is internal and uses `expose`, not `ports`.
- No API keys, tokens, private keys, connection strings, or provider credentials are included.
- The Compose file does not use `env_file`, host bind mounts, host mounts, privileged mode, host networking, host IPC, Docker socket mounts, GPUs, or external databases.
- Keep smoke endpoints free of private data. Add authentication before exposing real agent workflows or user-provided tool results.

## Cleanup

```bash
docker compose -f templates/prebuilt/openai-agents-python/docker-compose.yml down
```

No named volumes are created by this template.
