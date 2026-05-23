# CrewAI on Phala Cloud

This template runs a CPU-safe CrewAI package metadata demo behind a public Caddy proxy. The app installs the real `crewai` Python package, imports it, verifies package metadata and expected symbols, then exposes JSON endpoints for smoke testing.

The default demo does not run a CrewAI crew, does not download models, does not call external LLM APIs, and does not require provider API keys. Real CrewAI agent workflows normally need an LLM provider or local model connection; this template intentionally avoids that path so it can start deterministically on small CPU-only Phala CVMs.

## Metadata

- Template id: `crewai`
- Category: Agent Frameworks & Orchestration
- Upstream repo: `https://github.com/crewAIInc/crewAI`
- Upstream author: `crewAIInc`
- Package: `crewai==1.14.5`
- Python runtime: `python:3.12` from the `ghcr.io/astral-sh/uv:python3.12-bookworm-slim` image
- Icon source: upstream `docs/images/favicon.svg` from `crewAIInc/crewAI`, inspected at commit `179c20b35288fddf2fb7fdcaa8ccfeefe99b6689`

## Services

- `app`: internal Python HTTP service. At startup it installs `crewai`, imports the package, checks package metadata, and serves JSON on port `8000`.
- `proxy`: public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

## Deploy

From this template directory:

```bash
docker compose config
docker compose up -d
```

On Phala Cloud, deploy the prebuilt template and open the public endpoint on port `8080`.

The first start can take a few minutes because the app installs the pinned CrewAI wheel and dependencies inside the container. Restarts are lighter if the container filesystem is retained, but the template does not require a persistent volume.

## Usage

The public HTTP API is available through Caddy on port `8080`.

```bash
curl -fsS http://localhost:8080/healthz | jq
curl -fsS http://localhost:8080/demo | jq
curl -fsS http://localhost:8080/v1/models | jq
```

Endpoints:

- `/healthz`: returns HTTP 200 only when the real `crewai` package import and symbol checks pass. Returns HTTP 503 with the import error if startup checks failed.
- `/demo`: returns a local CrewAI metadata demo response, including the installed distribution version, module version, checked symbols, and a note that no LLM calls are performed.
- `/v1/models`: returns an OpenAI-shaped model list containing a `crewai/no-llm-demo` placeholder. It is metadata only; the default template does not host a model.

## Verification

Run these smoke checks after deployment:

```bash
docker compose ps
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo | jq '.crewai.import_ok, .llm_provider_calls'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `.crewai.import_ok` is `true`.
- `.llm_provider_calls` is `false`.
- `/v1/models` includes `crewai/no-llm-demo`.

## Environment Variables

The default template requires no credentials.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `CREWAI_PACKAGE_VERSION` | `1.14.5` | No | Pinned CrewAI Python package version installed at container startup. Override only when testing another compatible release. |
| `APP_PORT` | `8000` | No | Internal app port. Caddy proxies to this port; the host only exposes `8080:80`. |
| `CREWAI_DISABLE_TELEMETRY` | `true` | No | Disables CrewAI telemetry for this metadata demo. |
| `CREWAI_DISABLE_VERSION_CHECK` | `true` | No | Disables CrewAI version-check noise during local import checks. |
| `OTEL_SDK_DISABLED` | `true` | No | Disables OpenTelemetry SDK activity in the demo container. |

Provider keys such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SERPER_API_KEY`, or other model/tool credentials are intentionally not required and are not consumed by the default demo. Add them only if you replace this metadata service with a real CrewAI project that performs model or tool calls.

## Security Notes

- Only Caddy publishes a host port: `8080:80`.
- The app service is internal and uses `expose`, not `ports`.
- The template does not use privileged mode, host networking, host IPC, Docker socket mounts, host bind mounts, or external credentials.
- No API keys are baked into the compose file. Any secret-like values belong in deployment-time environment variables for custom CrewAI workloads, not in this default demo.
- CrewAI telemetry and OpenTelemetry are disabled by default in the demo environment.

## Cleanup

```bash
docker compose down
```

No named volumes are created by this template.
