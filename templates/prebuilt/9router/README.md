# decolua/9router

Deploy 9Router on Phala Cloud with a CPU-safe smoke verifier.

## Overview

9Router is a self-hosted AI gateway and dashboard for routing coding tools such as Claude Code, Codex, Cursor, Cline, Copilot, Antigravity, OpenClaw, Continue, and OpenCode through a single OpenAI-compatible endpoint. It supports provider/account fallback, model combos, format translation, usage tracking, cloud sync, and RTK token compression for tool output.

This template runs the official upstream Docker image and adds a small front verifier service. The verifier exposes unauthenticated smoke endpoints that prove the upstream gateway is running and can return its local model catalog. The default smoke path does not call model providers, start OAuth/browser-login flows, download model weights, or require GPU access. Real provider routing is configured later through the 9Router dashboard.

## Metadata

- Template id: `9router`
- Display name: `decolua/9router`
- Category: LLM Gateway & API Proxy
- Upstream repository: https://github.com/decolua/9router
- Upstream Docker docs: https://github.com/decolua/9router/blob/master/DOCKER.md
- Docker image: `decolua/9router`
- Icon source: upstream `public/favicon.svg` from https://github.com/decolua/9router/blob/master/public/favicon.svg

## What This Template Runs

- `router`: the official `decolua/9router` container listening internally on port `20128`, with persistent state in the named `9router_data` volume at `/app/data`.
- `app`: a Node.js verifier and reverse proxy listening publicly on port `8080`.

The template does not use host bind mounts, `env_file`, privileged mode, host networking, host IPC, Docker socket access, GPUs, or external build contexts.

## Environment Variables

The smoke endpoints work without model-provider credentials. The dashboard should still be protected before real use, so set strong values for the required secret variables in Phala Cloud.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `INITIAL_PASSWORD` | Yes | unset | Initial dashboard login password when no password hash exists. Set a long random value; do not rely on upstream's fallback password. |
| `JWT_SECRET` | Yes | unset | Long random secret used to sign dashboard session cookies. Generate with `openssl rand -hex 32`. |
| `API_KEY_SECRET` | Yes | unset | Long random secret used by 9Router when generating and validating endpoint API keys. Generate with `openssl rand -hex 32`. |
| `MACHINE_ID_SALT` | Yes | unset | Long random salt for stable machine/API-key identity hashing. Generate with `openssl rand -hex 32`. |
| `ROUTER_IMAGE_TAG` | No | `latest` | Upstream `decolua/9router` Docker image tag. Pin a release tag for production when one is available. |
| `BASE_URL` | No | `http://localhost:20128` | Server-side base URL used by internal 9Router cloud-sync jobs. Update if you enable cloud sync behind a public domain. |
| `CLOUD_URL` | No | `https://9router.com` | Server-side cloud-sync endpoint base URL. |
| `NEXT_PUBLIC_BASE_URL` | No | `http://localhost:20128` | Public/base URL value used by upstream UI compatibility paths. |
| `NEXT_PUBLIC_CLOUD_URL` | No | `https://9router.com` | Public cloud-sync endpoint base URL used by the upstream UI. |
| `AUTH_COOKIE_SECURE` | No | `false` | Set to `true` when the dashboard is exposed only through HTTPS. |
| `ENABLE_REQUEST_LOGS` | No | `false` | Enables upstream request/translator logs. Keep `false` unless debugging because logs can contain sensitive prompts or headers. |

Provider credentials such as OpenAI, Anthropic, Gemini, OpenRouter, GLM, MiniMax, Kiro, GitHub Copilot, Cursor, or Codex tokens are not placed in this compose file. Add providers through the dashboard after deployment.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `9router` template.
2. Set strong values for `INITIAL_PASSWORD`, `JWT_SECRET`, `API_KEY_SECRET`, and `MACHINE_ID_SALT`.
3. Keep the default CPU resource shape for the smoke deployment. Increase memory if you enable heavy dashboard usage or request logging.
4. Wait for the service health check to pass.
5. Open `https://<your-app-domain>/healthz` and `https://<your-app-domain>/demo`.
6. Open `https://<your-app-domain>/dashboard` and sign in with `INITIAL_PASSWORD` to configure providers, API keys, and model combos.

## Exposed Endpoints

- `GET /healthz`: verifies the upstream 9Router container is reachable and that its local `/v1/models` catalog returns JSON.
- `GET /demo`: returns the same verifier status plus a deterministic explanation of the checks performed.
- `GET /v1/models`: returns the upstream OpenAI-compatible model list through the running 9Router process. In the default empty state this is a local/static catalog and does not call providers.
- `GET /dashboard`: proxies to the 9Router dashboard. Use `INITIAL_PASSWORD` for the first login.
- Other paths are proxied to the upstream 9Router service. Remote `/v1/*` production calls should use API keys generated in the dashboard.

## Smoke Verification

After deployment:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Use these commands to verify the 9Router process and template proxy without sending prompts to any external model provider.

Expected health fields include:

```json
{
  "ok": true,
  "status": "ready",
  "safety": {
    "official_upstream_image": true,
    "cpu_only": true,
    "credentials_required_for_smoke_endpoints": false,
    "provider_network_calls_performed_by_smoke_endpoints": false,
    "model_downloads": false
  }
}
```

## Local Verification

Run from the parent monorepo worktree root:

```bash
docker compose -f templates/prebuilt/9router/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/9router/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/9router/docker-compose.yml down
```

Template validation from the parent monorepo worktree root:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
```

## Production Notes

- 9Router stores provider connections, generated endpoint API keys, combos, usage data, and dashboard state under `/app/data` in the `9router_data` named volume.
- Set `INITIAL_PASSWORD`, `JWT_SECRET`, `API_KEY_SECRET`, and `MACHINE_ID_SALT` before using the dashboard with real provider accounts.
- Generate 9Router endpoint API keys from the dashboard before exposing `/v1/chat/completions`, `/v1/responses`, or provider-backed routes to clients.
- OAuth/subscription providers may involve browser authentication and upstream provider terms. Complete those flows intentionally from the dashboard; the smoke verifier does not perform them.
- Some upstream providers may be free, subscription-backed, or API-key based. 9Router routes to them only after you configure the corresponding provider credentials or OAuth accounts.
- Keep `ENABLE_REQUEST_LOGS=false` unless actively debugging. Request logs can include sensitive prompts, headers, provider responses, and tool output.
- Set `AUTH_COOKIE_SECURE=true` when using an HTTPS-only public domain.
- Pin `ROUTER_IMAGE_TAG` for reproducible production deployments. The template defaults to `latest` to follow the upstream Docker quick start.

## Upstream Attribution

- Upstream project: https://github.com/decolua/9router
- Author: `decolua`
- Docker image: `decolua/9router`
- Architecture notes inspected: https://github.com/decolua/9router/blob/master/docs/ARCHITECTURE.md
- Docker deployment docs inspected: https://github.com/decolua/9router/blob/master/DOCKER.md
- Icon: copied from upstream `public/favicon.svg` and saved as `templates/icons/9router.svg`.
