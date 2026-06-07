# ElizaOS on Phala Cloud

This template deploys a safe ElizaOS demo on Phala Cloud. It starts on a small CPU CVM, uses no credentials, and verifies that the real ElizaOS packages can load successfully.

## What runs

- `proxy`: Caddy public entrypoint on port `80`; forwards traffic to `app:8000`.
- `app`: Node.js demo verifier; installs `@elizaos/core@1.7.2` and `@elizaos/plugin-bootstrap@1.7.2`, then exposes JSON health/demo endpoints.

Caddy is here as the public reverse proxy. Keep public traffic on Caddy and keep the app service internal.

## Deploy

```bash
docker compose up -d
```

On Phala Cloud, deploy this template and open the generated HTTPS endpoint.

## Check it

```bash
curl http://localhost/healthz
curl http://localhost/demo
curl http://localhost/v1/models
```

Expected result:

- `/healthz` returns HTTP 200 with `status: ok`.
- `/demo` returns `external_llm_calls: false` and `credentials_required: false`.
- `/v1/models` returns `elizaos/no-llm-demo`.

## Turn this into your own ElizaOS agent

Most users only need to edit the `app` service and the Caddy target port.

Replace the demo app with your own image:

```yaml
app:
  image: ghcr.io/your-org/your-eliza-agent:latest
  expose:
    - "3000"
  environment:
    NODE_ENV: production
```

Then point Caddy to your app port:

```caddyfile
reverse_proxy app:3000
```

Keep this part the same:

```yaml
proxy:
  image: caddy:2.8
  ports:
    - "80:80"
```

Add provider keys and agent secrets through Phala Cloud deployment environment variables or your secret manager. Keep credentials out of `docker-compose.yml`.

## Things a real agent usually needs

- Character file and agent configuration
- Model provider key, for example OpenAI, Anthropic, Gemini, or Eliza Cloud
- Plugins for chat, social, Web3, RAG, or tool use
- Persistent storage for agent memory or local data
- API authentication and CORS settings for public endpoints
- Optional TEE, wallet, or secret-management settings

## Demo environment variables

- `ELIZAOS_PACKAGE_VERSION`: ElizaOS npm package version, default `1.7.2`.
- `APP_PORT`: internal demo app port, default `8000`.
- `NODE_ENV`: Node runtime mode, default `production`.

## Template safety rules

- Public port stays on Caddy: `80:80`.
- App service stays internal with `expose`.
- Use named volumes for persistence.
- Keep host bind mounts, Docker socket mounts, privileged mode, host network, `env_file`, and baked credentials out of the default template.

## Upstream

- Repo: `https://github.com/elizaOS/eliza`
- Homepage: `https://elizaos.ai/`
- Source ref: `379ec863f820b7ba4f5a507e06dc24d80cfa0bae` from `develop`
- Icon: upstream `packages/app/public/logos/elizaos-icon.png`
