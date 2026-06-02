# BenedictKing/ccx on Phala Cloud

This template deploys CCX, a high-performance Claude, OpenAI Chat, OpenAI Images, Codex Responses, and Gemini API proxy with a built-in web administration UI.

The default deployment runs the upstream CCX Docker image behind a Caddy public proxy. It is CPU-safe, does not download model weights, does not call external model providers, and starts with demo placeholder access keys so the health and web UI paths can be verified on a small Phala Cloud CVM. Configure real upstream channels and replace the demo keys before routing production traffic.

## Metadata

- Template id: `ccx`
- Display name: `BenedictKing/ccx`
- Category: LLM Gateway & API Proxy
- Upstream repository: https://github.com/BenedictKing/ccx
- Upstream Docker image: `crpi-i19l8zl0ugidq97v.cn-hangzhou.personal.cr.aliyuncs.com/bene/ccx:latest`
- Upstream Docker Compose: https://github.com/BenedictKing/ccx/blob/main/docker-compose.yml
- Upstream documentation: https://github.com/BenedictKing/ccx/tree/main/docs/en
- Icon source: upstream `frontend/public/favicon.svg` from `BenedictKing/ccx`, inspected at commit `293149164ba016df55be10a1900b83cb9130f8a4`
- Upstream author: `BenedictKing`

## What This Template Runs

- `ccx`: the upstream CCX all-in-one backend and web UI, listening internally on port `3000`.
- `proxy`: Caddy on public port `8080`, forwarding to CCX and adding template smoke endpoints.
- `ccx_config`: named volume mounted at `/app/.config` for CCX channel/config persistence.
- `ccx_logs`: named volume mounted at `/app/logs` for CCX logs.

The CCX upstream app exposes:

- `GET /`: web UI.
- `GET /health`: upstream health endpoint.
- `GET /v1/models`: authenticated models API. It returns upstream-channel model data only after you configure channels in CCX.
- `POST /v1/messages`: Claude Messages proxy.
- `POST /v1/chat/completions`: OpenAI Chat proxy.
- `POST /v1/responses`: Codex Responses proxy.
- `POST /v1/images/generations`, `POST /v1/images/edits`, `POST /v1/images/variations`: OpenAI Images proxy.
- `POST /v1beta/models/{model}:generateContent`: Gemini proxy.

Caddy adds:

- `GET /healthz`: rewrites to the real CCX `GET /health` endpoint.
- `GET /demo`: deterministic JSON metadata endpoint for smoke verification. It does not call CCX upstream providers.

## Deployment Steps

1. Deploy the `ccx` prebuilt template on Phala Cloud.
2. Replace `PROXY_ACCESS_KEY` and `ADMIN_ACCESS_KEY` with long random values before exposing the deployment beyond a smoke test.
3. Open `https://<your-app-domain>/` to access the CCX web UI.
4. Add provider channels in the web UI when you are ready to route real Claude, Codex, OpenAI-compatible, or Gemini traffic.
5. Use the public endpoint on port `8080`.

The first startup pulls the upstream CCX image and Caddy. No GPU, external database, host bind mount, browser login, or model download is used by this template.

## Environment Variables

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `PROXY_ACCESS_KEY` | `ccx-demo-proxy-key` | Yes | Placeholder client proxy key for authenticated `/v1/*` routes. Replace with a long random value before real use. |
| `ADMIN_ACCESS_KEY` | `ccx-demo-admin-key` | Yes | Placeholder admin key for the web UI and `/api/*` routes. Replace with a long random value before real use. |
| `APP_UI_LANGUAGE` | `en` | No | CCX web UI language. Upstream supports values such as `en`, `id`, and `zh-CN`. |
| `LOG_LEVEL` | `warn` | No | CCX log level: `error`, `warn`, `info`, or `debug`. Keep `debug` off in production because request details may be sensitive. |

Provider API keys are not placed in this Compose file. Add upstream provider credentials through CCX channel configuration or a secret-managed deployment process when you intentionally enable real proxy traffic.

## Smoke Verification

Use these commands to verify that the template starts, serves deterministic smoke metadata, and reaches the real CCX proxy route without making external provider calls.

After deployment, replace the domain with your Phala Cloud app domain:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -i https://<your-app-domain>/v1/models \
  -H "x-api-key: <your-proxy-access-key>"
```

Expected default results:

- `GET /healthz` returns CCX health JSON with `"status": "healthy"`.
- `GET /demo` returns deterministic template metadata and `"default_provider_calls": false`.
- `GET /v1/models` authenticates with `PROXY_ACCESS_KEY`. Before channels are configured, CCX may return a not-found response such as `models endpoint not available from any upstream`; this confirms the proxy route is live without making provider calls.

Local verification from the `sdks/` directory:

```bash
docker compose -f templates/prebuilt/ccx/docker-compose.yml config
docker compose -f templates/prebuilt/ccx/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -i http://localhost:8080/v1/models -H "x-api-key: ccx-demo-proxy-key"
docker compose -f templates/prebuilt/ccx/docker-compose.yml down
```

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/ccx/docker-compose.yml config >/dev/null
```

## Production Notes

- Replace the demo `PROXY_ACCESS_KEY` and `ADMIN_ACCESS_KEY` with long random values. For example, generate each with `openssl rand -base64 32`.
- Keep `ADMIN_ACCESS_KEY` different from `PROXY_ACCESS_KEY` so web/admin access is separated from client proxy access.
- Configure upstream channels in the CCX web UI. Upstream provider API keys belong in channel configuration, not in this template file.
- Add external authentication, network policy, or an allowlist before exposing a production gateway publicly.
- Review upstream client setup docs before pointing Claude Code, Codex, OpenCode, Gemini, or OpenAI-compatible clients at CCX.
- Pin the CCX image to a tested digest or release tag for reproducible production rollouts.
- `GET /v1/models` depends on configured upstream channels; an empty demo deployment does not host a model and does not synthesize model data.

## Security Notes

- Only the Caddy proxy publishes a host port: `8080:80`.
- The CCX service is internal to the Compose network and uses `expose`, not `ports`.
- The template uses named volumes, not host bind mounts.
- The default deployment does not include real API keys, tokens, private keys, OTPs, or passwords.
- The template does not use privileged mode, host networking, host IPC, Docker socket mounts, GPUs, external databases, `env_file`, or provider credentials.

## Cleanup

For local testing from the `sdks/` directory:

```bash
docker compose -f templates/prebuilt/ccx/docker-compose.yml down
```

Add `-v` only if you intentionally want to remove the named `ccx_config` and `ccx_logs` volumes.
