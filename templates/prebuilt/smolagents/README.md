# huggingface/smolagents on Phala Cloud

This template runs a CPU-safe `smolagents` local primitives demo behind a public Caddy proxy. The app installs the real `smolagents` Python package, imports it, verifies expected symbols, and exposes JSON endpoints for deterministic smoke testing.

The default demo does not construct or run an LLM-backed agent. It does not call hosted models, download model weights, use a GPU, run browser automation, mount the Docker socket, use host bind mounts, read `env_file`, enable privileged mode, or connect to external databases. Real `smolagents` agents commonly need a model provider, local model runtime, sandbox backend, or tool credentials; this template intentionally avoids those paths so it can start on a small CPU-only Phala CVM.

## Metadata

- Template id: `smolagents`
- Category: Agent Frameworks & Orchestration
- Upstream repository: `https://github.com/huggingface/smolagents`
- Upstream documentation: `https://huggingface.co/docs/smolagents`
- Upstream author: `huggingface`
- Python package: `smolagents==1.25.0` by default
- Python runtime: `python:3.12` from `ghcr.io/astral-sh/uv:python3.12-bookworm-slim`
- Icon source: Hugging Face GitHub organization avatar fallback, `https://avatars.githubusercontent.com/u/25720743?s=256&v=4`

The upstream README includes project-specific `smolagents` artwork at `https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/smolagents/smolagents.png`, but the repository does not ship a dedicated square smolagents logo file. This template therefore uses the Hugging Face organization avatar as the fallback catalog icon.

## Services

- `app`: internal Python HTTP service. At startup it installs `smolagents`, imports the package, checks package metadata and expected symbols, then serves JSON on port `8000`.
- `proxy`: public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

## Environment Variables

No credentials are required.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `SMOLAGENTS_VERSION` | `1.25.0` | No | Pinned `smolagents` package version installed at container startup. Override only when testing another compatible release. |
| `APP_PORT` | `8000` | No | Internal app port. Caddy proxies to this port; the host only exposes `8080:80`. |

Do not add provider keys such as `HF_TOKEN`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TOGETHER_API_KEY`, or `OPENROUTER_API_KEY` to this default no-secret demo. Add credentials only if you replace the smoke server with a real agent workload that performs provider calls.

## Endpoints

The public HTTP API is available through Caddy on port `8080`.

- `GET /healthz`: returns HTTP 200 only when the package imports and the deterministic local demo pass.
- `GET /demo`: exercises local `smolagents` primitives by instantiating a custom `Tool`, wrapping input with `AgentText`, and passing the deterministic result through `FinalAnswerTool`.
- `GET /v1/models`: returns an OpenAI-shaped model list containing `smolagents-local-deterministic-primitives`. It is metadata only; the template does not host or call an LLM.
- `GET /`: returns service metadata and endpoint names.

Example:

```bash
curl -fsS http://localhost:8080/healthz | jq
curl -fsS 'http://localhost:8080/demo?text=hello%20smolagents' | jq
curl -fsS http://localhost:8080/v1/models | jq
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "credential_free": true,
  "llm_provider_calls": false,
  "hosted_model_calls": false,
  "model_downloaded": false,
  "model_loaded": false,
  "tool": {
    "name": "local_digest"
  }
}
```

## Deploy

1. Deploy the `smolagents` template on Phala Cloud.
2. Keep the default `tdx.small`-safe resources for the smoke demo: 1 vCPU, 1 GB memory, and 10 GB disk.
3. Optionally set `SMOLAGENTS_VERSION` to another published compatible package version.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads Python wheels from PyPI. The runtime smoke path itself is local and deterministic.

## Local Verification

From the `sdks/` directory:

```bash
docker compose -f templates/prebuilt/smolagents/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/smolagents/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz | jq
curl -fsS http://localhost:8080/demo | jq
curl -fsS http://localhost:8080/v1/models | jq
docker compose -f templates/prebuilt/smolagents/docker-compose.yml down
```

Template validation commands from the `sdks/` directory:

```bash
python3 templates/validate.py
docker compose -f templates/prebuilt/smolagents/docker-compose.yml config >/dev/null
git diff --check origin/main...HEAD
```

A simple static audit should also confirm that the compose file does not contain `privileged`, `network_mode: host`, `pid: host`, `ipc: host`, `env_file`, `volumes`, `/var/run/docker.sock`, GPU device requests, hosted-model credentials, or external database services.

## Security Notes

- The demo endpoints are unauthenticated. Add an authenticated reverse proxy before adapting this template for private workflows.
- No secrets are baked into the compose file, README, image, or inline application code.
- Only Caddy publishes a host port: `8080:80`.
- The app service is internal and uses `expose`, not `ports`.
- The compose file does not use privileged mode, host networking, host IPC, host PID, Docker socket mounts, host bind mounts, named volumes, `env_file`, GPU devices, browser automation services, external databases, or provider credentials.
- The demo imports agent classes but does not run `CodeAgent` or `ToolCallingAgent`, because those require a model. It exercises local `Tool`, `AgentText`, and `FinalAnswerTool` primitives instead.

## Cleanup

```bash
docker compose -f templates/prebuilt/smolagents/docker-compose.yml down
```

No named volumes are created by this template.
