# google/adk-python on Phala Cloud

This template runs a CPU-safe Google Agent Development Kit Python package metadata demo behind a public Caddy proxy. The app installs the real `google-adk` Python package, imports `google.adk`, verifies package metadata and expected ADK symbols, instantiates local ADK primitives, then exposes JSON endpoints for smoke testing.

The default demo does not run an ADK agent, does not call Gemini, Vertex AI, OpenAI, or any other provider API, does not download models, and does not require credentials. Real ADK agent workflows normally need a configured model provider before execution; this template intentionally avoids that path so it can start deterministically on small CPU-only Phala CVMs.

## Metadata

- Template id: `adk-python`
- Category: Agent Frameworks & Orchestration
- Upstream repo: `https://github.com/google/adk-python`
- Upstream author: `google`
- Package: `google-adk==2.1.0`
- Python runtime: `python:3.12` from the `ghcr.io/astral-sh/uv:python3.12-bookworm-slim` image
- Icon source: upstream `assets/agent-development-kit.png` from `google/adk-python`, inspected on `main` commit `aa515125879725b53a2c003c89783dfdb0dd2654`

## Services

- `app`: internal Python HTTP service. At startup it installs `google-adk`, imports the package, checks package metadata, creates metadata-only ADK `Agent`, `Workflow`, and `FunctionNode` objects, and serves JSON on port `8000`.
- `proxy`: public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

## Deploy

From this template directory:

```bash
docker compose config
docker compose up -d
```

On Phala Cloud, deploy the prebuilt template and open the public endpoint on port `8080`.

The first start can take a few minutes because the app installs the pinned ADK wheel and dependencies inside the container. Restarts are lighter if the container filesystem is retained, but the template does not require a persistent volume.

## Usage

The public HTTP API is available through Caddy on port `8080`.

```bash
curl -fsS http://localhost:8080/healthz | jq
curl -fsS http://localhost:8080/demo | jq
curl -fsS http://localhost:8080/v1/models | jq
```

Endpoints:

- `/healthz`: returns HTTP 200 only when the real `google-adk` distribution import, ADK symbol checks, and local primitive instantiation checks pass. Returns HTTP 503 with the import error if startup checks failed.
- `/demo`: returns a local ADK metadata demo response, including the installed distribution version, checked symbols, safe local primitives, and explicit flags showing no provider calls, no hosted model calls, no model downloads, and no credentials required.
- `/v1/models`: returns an OpenAI-shaped model list containing a `google-adk/no-llm-demo` placeholder. It is metadata only; the default template does not host or call a model.

## Verification

Run these smoke checks after deployment:

```bash
docker compose ps
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo | jq '.google_adk.import_ok, .provider_calls, .credentials_required'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `.google_adk.import_ok` is `true`.
- `.provider_calls` is `false`.
- `.credentials_required` is `false`.
- `/v1/models` includes `google-adk/no-llm-demo`.

## Environment Variables

The default template requires no credentials.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `GOOGLE_ADK_PACKAGE_VERSION` | `2.1.0` | No | Pinned Google ADK Python package version installed at container startup. Override only when testing another compatible release. |
| `APP_PORT` | `8000` | No | Internal app port. Caddy proxies to this port; the host only exposes `8080:80`. |

Provider keys such as `GOOGLE_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`, `VERTEX_AI_PROJECT`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or other model/tool credentials are intentionally not required and are not consumed by the default demo. Add credentials only if you replace this metadata service with a real ADK project that performs model or tool calls.

## Security Notes

- Only Caddy publishes a host port: `8080:80`.
- The app service is internal and uses `expose`, not `ports`.
- The template does not use privileged mode, host networking, host IPC, Docker socket mounts, host bind mounts, external build contexts, `env_file`, or external credentials.
- No API keys are baked into the compose file. Any secret-like values belong in deployment-time environment variables for custom ADK workloads, not in this default demo.
- The demo creates ADK metadata objects only; it never runs `Runner`, agent execution, model generation, or hosted provider calls.

## Cleanup

```bash
docker compose down
```

No named volumes are created by this template.
