# portkey-ai/gateway

Deploy the official Portkey AI Gateway image on Phala Cloud.

## Metadata

- Template id: `gateway`
- Display name: `portkey-ai/gateway`
- Category: LLM Gateways, Proxies & API Management
- Upstream repository: https://github.com/Portkey-AI/gateway
- Upstream documentation: https://portkey.ai/docs
- Upstream Docker image: `portkeyai/gateway:latest`
- Upstream Docker Compose: https://github.com/Portkey-AI/gateway/blob/main/docker-compose.yaml
- Icon source: `https://cfassets.portkey.ai/logo/dew-color.svg`, referenced from the upstream README deployment links
- Upstream author: Portkey AI, via the `Portkey-AI/gateway` GitHub repository

## What This Template Runs

Portkey AI Gateway is an OpenAI-compatible gateway for routing requests to external LLM providers with provider selection, retries, fallbacks, guardrails, logging, and proxy support.

This template runs the upstream `portkeyai/gateway:latest` container directly. The upstream Docker Compose file exposes the gateway on port `8787` and requires no provider API keys at startup. The default Phala Cloud template follows that shape and adds only a Compose healthcheck against the upstream no-secret root route.

No LLM provider calls, model downloads, GPU access, external databases, privileged mode, host networking, Docker socket mounts, `env_file`, host bind mounts, or real API keys are used by the default deployment. Provider credentials are supplied later at request time, usually as HTTP headers, when you are ready to route real LLM traffic.

## Services

- `gateway`: Official Portkey Gateway Node.js service from Docker Hub, listening on container port `8787`.

## Ports

- `8787`: Public HTTP endpoint for the gateway API.

## Environment Variables

No environment variables or secrets are required for the default smoke deployment.

Provider API keys are intentionally not configured in this template. For real routing, pass provider credentials through request headers, a client SDK, or an authenticated reverse proxy that injects secrets at request time. Use safe placeholders such as `<provider-api-key>` in examples and keep real keys out of Compose files.

## Deploy

1. Deploy the `gateway` template on Phala Cloud.
2. Keep the default CPU-only resources for the no-secret starter.
3. Open `https://<your-app-domain>/` after the service starts.
4. Use provider-specific request headers only when you are ready to send real traffic to an external model provider.

The first startup pulls the official Portkey Gateway image. The gateway itself is lightweight and does not start any model runtime.

## Usage

No-secret smoke check:

```bash
curl -fsS https://<your-app-domain>/
```

Expected response:

```text
AI Gateway says hey!
```

Real provider routing requires a provider and credentials. This example uses placeholders only:

```bash
curl -fsS https://<your-app-domain>/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-portkey-provider: openai" \
  -H "Authorization: Bearer <provider-api-key>" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "user",
        "content": "Reply with a one-line gateway smoke response."
      }
    ]
  }'
```

The default template does not include a local model list or fake provider. `GET /v1/models` depends on upstream Portkey/provider configuration and is not used as the no-secret smoke signal.

## Smoke Verification

Run locally from the `sdks/` directory:

```bash
docker compose -f templates/prebuilt/gateway/docker-compose.yml config
docker compose -f templates/prebuilt/gateway/docker-compose.yml up -d
curl -fsS http://localhost:8787/
docker compose -f templates/prebuilt/gateway/docker-compose.yml ps
docker compose -f templates/prebuilt/gateway/docker-compose.yml down
```

Expected results:

- `docker compose config` renders one `gateway` service.
- `GET /` returns `AI Gateway says hey!`.
- The Compose healthcheck probes `http://127.0.0.1:8787/` from inside the container.

Template validation commands from the repository root:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/gateway/docker-compose.yml config >/dev/null
```

## Production Notes

- Review Portkey's upstream documentation before enabling production routing: https://portkey.ai/docs
- Send provider credentials through secure request-time headers or a secret-managed proxy. Do not bake real keys into this template.
- Add authentication or network restrictions before exposing a production gateway publicly.
- The upstream gateway console route may require Portkey's admin-token configuration. This template does not mount a custom `conf.json`.
- Pin the Docker image to a tested digest or tag in production if you need reproducible rollouts.

## Security Notes

- The default service is unauthenticated and intended as a starter gateway deployment.
- No provider credentials, tokens, private keys, OTPs, or API keys are embedded.
- The template does not use privileged mode, host networking, Docker socket mounts, host bind mounts, `env_file`, GPUs, external databases, or persistent volumes.
- The no-secret smoke path is deterministic and does not contact an external LLM provider.

## Cleanup

For a local test run from `sdks/`, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/gateway/docker-compose.yml down
```
