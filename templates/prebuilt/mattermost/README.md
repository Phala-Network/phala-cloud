# Mattermost on Phala Cloud

Mattermost is an open source platform for secure collaboration across the entire software development lifecycle. This template runs the official `mattermost/mattermost-preview` server image behind Caddy and adds a small verifier service for deterministic JSON smoke checks.

The default deployment does not require credentials, does not call external LLM or provider APIs, and does not download model weights. It is a preview/evaluation deployment, not the production Mattermost Docker topology.

## Quick Start

Deploy:

```bash
docker compose config
docker compose up -d
```

Check:

```bash
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
```

Customize:

- Replace the preview image with the official production Docker deployment when you need a real team server.
- Keep Caddy as the public `8080:80` service on Phala Cloud.
- Add SMTP, TLS, SSO, compliance, and backup settings only as deployment-time configuration; do not bake secrets into this compose file.

## Metadata

- Template id: `mattermost`
- Category: AI Apps & Workflows
- Upstream repo: `https://github.com/mattermost/mattermost`
- Upstream author: `mattermost`
- Runtime image: `mattermost/mattermost-preview:11.7.3`
- Deployment docs inspected: `https://docs.mattermost.com/deployment-guide/server/deploy-containers.html`
- Icon source: upstream `webapp/channels/src/images/favicon/android-chrome-192x192.png` from `mattermost/mattermost`, inspected at commit `d41865371704120a65e03f0a481b60e17dbc692e`

## Services

- `mattermost`: official Mattermost Docker Preview server. It exposes port `8065` only on the internal Compose network and serves the real Mattermost web UI and API.
- `verifier`: internal Python HTTP service. It checks the real Mattermost `/api/v4/system/ping?get_server_status=true` endpoint and exposes deterministic JSON endpoints for smoke tests.
- `proxy`: public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

Named volumes:

- `mattermost_data`: preview file data under `/mm/mattermost-data`.
- `mattermost_postgres`: internal preview PostgreSQL data under `/var/lib/postgresql/data`.

These volumes help ordinary container restarts keep local preview data. The upstream preview image is still not an upgradeable production data model.

## Deploy on Phala Cloud

1. Create a new CVM from the `mattermost` prebuilt template.
2. Keep the default port mapping `8080:80`.
3. Open the public endpoint to access the Mattermost web UI.
4. Create a preview account from the Mattermost UI if you want to test chat workflows.

For local testing from this template directory:

```bash
docker compose config
docker compose up -d
docker compose ps
```

## Exposed Endpoints

The public HTTP API is available through Caddy on port `8080`.

- `/`: Mattermost web UI from the official preview server.
- `/api/v4/system/ping`: native Mattermost server ping endpoint proxied from the preview server.
- `/healthz`: verifier health check. Returns HTTP 200 only when Mattermost reports `status: OK`.
- `/demo`: JSON deployment summary, including upstream links, image metadata, and the live Mattermost ping result.
- `/v1/models`: OpenAI-shaped metadata placeholder. This template does not host or call an LLM model.

Smoke commands:

Use these commands to verify that Caddy, the Mattermost preview server, and the deterministic verifier route are all reachable through the public port.

```bash
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo | jq '.mattermost.system_ping.mattermost_status_ok, .llm_provider_calls'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
curl -fsS http://localhost:8080/api/v4/system/ping | jq
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `.mattermost.system_ping.mattermost_status_ok` is `true`.
- `.llm_provider_calls` is `false`.
- `/v1/models` includes `mattermost/no-llm-preview`.
- `/api/v4/system/ping` returns a native Mattermost status response.

## Environment Variables

The default template requires no user-provided credentials and defines no required template environment variables.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| None | N/A | No | The preview server starts with upstream non-production settings baked into the official image. |

For a production Mattermost deployment, configure secrets such as PostgreSQL credentials, SMTP credentials, SSO client secrets, license files, and TLS material through Phala Cloud deployment-time environment variables or a secret manager. Never commit real keys, passwords, private keys, OTPs, or tokens to this template.

## Production Notes

- Mattermost's official container documentation says the production Docker deployment uses a separate database container, the Mattermost application container, and optionally a reverse proxy.
- Mattermost's Docker Preview mode is self-contained and works without user-supplied secrets, but upstream documents it as non-production. It uses known internal database settings, has other preview settings, and does not support production upgrades.
- Use `mattermost/mattermost-team-edition` or `mattermost/mattermost-enterprise-edition` with PostgreSQL v11+ for real teams.
- Configure `MM_SERVICESETTINGS_SITEURL`, SMTP, backups, TLS, SSO, compliance retention, plugin policy, and monitoring before handling production collaboration data.
- Mattermost can integrate with AI features through plugins or external services, but this template does not enable those integrations and does not consume provider API keys by default.

## Security Notes

- Only Caddy publishes a host port: `8080:80`.
- The Mattermost and verifier services are internal and use `expose`, not `ports`.
- The template does not use privileged mode, host networking, host IPC, Docker socket mounts, host bind mounts, external build contexts, or `env_file`.
- No real secrets are included in the compose file.
- The `/v1/models` route is metadata only. It exists for template smoke-check compatibility and is not an inference endpoint.

## Cleanup

```bash
docker compose down
```

To remove preview data as well:

```bash
docker compose down -v
```
