# presenton/presenton on Phala Cloud

## Overview

Deploy [presenton/presenton](https://github.com/presenton/presenton) on Phala Cloud as a self-hosted AI presentation generator, editor, export service, and API.

Presenton is an open-source alternative to Gamma, Beautiful AI, and Decktopus. It provides a browser UI, editable PPTX/PDF export, a FastAPI backend, an API for presentation generation, custom templates, and support for OpenAI, Google Gemini, Vertex AI, Azure OpenAI, Amazon Bedrock, Fireworks, Together AI, Anthropic, LM Studio, Ollama, and OpenAI-compatible providers.

This template uses the upstream `ghcr.io/presenton/presenton:latest` server image documented in the upstream README. The default deployment is intentionally no-secret and CPU-safe: it starts the web app, stores state on a named Docker volume, disables runtime Ollama startup, disables Mem0 memory, disables image generation, and does not call a hosted model provider or download model weights during smoke checks.

## Metadata

- Template id: `presenton`
- Display name: `presenton/presenton`
- Category: AI Apps & Workflows
- Upstream repository: https://github.com/presenton/presenton
- Upstream documentation: https://docs.presenton.ai/
- Upstream image: `ghcr.io/presenton/presenton:latest`
- Icon source: `servers/nextjs/public/logo-with-bg.png` from the upstream repository tree
- Upstream author: `presenton`

## Included Services

- `presenton`: Official Presenton web UI, FastAPI backend, MCP server, Next.js server, Nginx, Chromium, LibreOffice, OCR tooling, SQLite fallback storage, and local app data.
- `proxy`: Caddy reverse proxy on public port `8080`. It forwards the real Presenton UI/API and adds smoke endpoints that do not require login or provider credentials.

## Ports

- `8080`: Public HTTP endpoint exposed by Phala Cloud.

The upstream Presenton container listens on internal port `80`; it is not published directly.

## Environment Variables

No credentials are required for the default smoke deployment.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `CAN_CHANGE_KEYS` | No | `true` | Keeps Presenton's UI-based provider configuration enabled. If set to `false`, upstream startup validates provider variables; set a complete provider configuration first. |
| `DISABLE_IMAGE_GENERATION` | No | `true` | Disables slide image generation by default so smoke checks do not require image-provider credentials. |
| `MEM0_ENABLED` | No | `false` | Disables Presenton's optional Mem0 presentation memory runtime to keep the template lightweight and avoid runtime embedding work. |
| `LITEPARSE_NUM_WORKERS` | No | `1` | Limits document parsing worker count for small CPU deployments. |
| `LITEPARSE_DPI` | No | `120` | Default OCR/render DPI used by upstream document parsing. |
| `AUTH_USERNAME` | No | unset | Optional first-boot admin username. If omitted, create the first admin user in the web UI. |
| `AUTH_PASSWORD` | No | unset | Optional first-boot admin password. Use at least 6 characters. If omitted, create the first admin user in the web UI. |

The compose file also pins these safe runtime defaults: `APP_DATA_DIRECTORY=/app_data`, `TEMP_DIRECTORY=/tmp/presenton`, `MIGRATE_DATABASE_ON_STARTUP=true`, `START_OLLAMA=false`, `DISABLE_ANONYMOUS_TRACKING=true`, and `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`.

Provider credentials such as `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, `CUSTOM_LLM_URL`, `CUSTOM_LLM_API_KEY`, `PEXELS_API_KEY`, and `PIXABAY_API_KEY` are intentionally not required for this template. Configure them in the Presenton UI after deployment, or extend the compose environment only when you are ready to run real generation.

## Persistent Data

The template creates one named Docker volume:

- `presenton_app_data`: mounted at `/app_data` for SQLite data, user configuration, uploaded files, generated exports, images, fonts, and presentation assets.

No host bind mounts are used.

## Deploy on Phala Cloud

1. Select the prebuilt `presenton` template.
2. Keep the default CPU-safe settings for the first smoke test.
3. Optionally set `AUTH_USERNAME` and `AUTH_PASSWORD` to preseed the admin account. Otherwise create the first admin user in the web UI after startup.
4. Deploy the CVM and open the generated public endpoint for port `8080`.
5. Visit `https://<your-app-domain>/healthz` to confirm the upstream app is responding.
6. Open `https://<your-app-domain>/` to use the Presenton UI.

The first startup pulls the upstream Presenton image. The image is large because it includes Chromium, LibreOffice, OCR tooling, the Next.js app, FastAPI backend, and presentation export assets.

## Exposed Endpoints

- `GET /healthz`: Proxies to Presenton's unauthenticated `/api/v1/auth/status` endpoint. It returns HTTP `200` only when the upstream app is reachable through the proxy.
- `GET /demo`: Returns deterministic template metadata and confirms that the default smoke path does not call providers, start Ollama, enable Mem0, generate images, or download model weights.
- `GET /v1/models`: Returns an OpenAI-shaped metadata list with `presenton/no-provider-smoke`. It is a compatibility smoke endpoint, not a hosted model server.
- `GET /`: Presenton web UI.
- `GET /api/v1/auth/status`: Upstream auth/setup status.
- `POST /api/v1/ppt/presentation/generate`: Upstream production presentation-generation API. It requires admin authentication and a configured model provider.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

## Smoke Verification

Use these commands to verify that the template starts, reaches the upstream Presenton app, and exposes the no-secret smoke endpoints.

Run locally from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/presenton/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/presenton/docker-compose.yml down
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "service": "presenton",
  "mode": "no-secret-smoke",
  "default_behavior": {
    "cpu_only": true,
    "provider_calls": false,
    "model_downloads": false,
    "image_generation_disabled": true,
    "mem0_disabled": true
  }
}
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/presenton/docker-compose.yml config >/dev/null
```

## Production Notes

- The default `/demo` and `/v1/models` endpoints are smoke-test metadata only. They do not prove that a text or image provider is configured.
- Configure a text provider and, optionally, an image provider in the Presenton UI before calling the real generation endpoint.
- Upstream protects `/api/v1/` routes other than `/api/v1/auth/*` with the single admin login. API clients should use HTTP Basic auth with the admin username and password.
- Keep `CAN_CHANGE_KEYS=true` unless you intentionally want environment-locked provider settings. If you set it to `false`, provide a complete upstream provider configuration before startup.
- `START_OLLAMA=false` is intentional. Running local Ollama models usually requires more disk, memory, and CPU than this smoke template and may require a separate Ollama service.
- `MEM0_ENABLED=false` is intentional for the default. Enable it only after sizing the instance and understanding upstream Mem0/embedding behavior.
- This template does not request GPU access, privileged mode, host networking, host IPC, Docker socket access, host bind mounts, `env_file`, browser-authenticated provider sessions, or real secrets.
- For public production deployments, use strong admin credentials, keep the named volume persistent, and review upstream's provider-specific configuration guidance.

## Upstream Attribution

- Upstream repository: [presenton/presenton](https://github.com/presenton/presenton)
- Upstream docs: [docs.presenton.ai](https://docs.presenton.ai/)
- Upstream Docker image documented by README: `ghcr.io/presenton/presenton:latest`
- Upstream API endpoint documented by README: `/api/v1/ppt/presentation/generate`
- Template icon: `presenton.png`, copied from [`servers/nextjs/public/logo-with-bg.png`](https://github.com/presenton/presenton/blob/main/servers/nextjs/public/logo-with-bg.png)

## Cleanup

For a local test run from the parent monorepo worktree, stop and remove the containers with:

```bash
docker compose -f templates/prebuilt/presenton/docker-compose.yml down
```
