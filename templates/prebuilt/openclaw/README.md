# OpenClaw on Phala Cloud

OpenClaw is a self-hosted AI gateway for coordinating agent sessions across native apps, browser/device nodes, and messaging channels such as Discord, Telegram, WhatsApp, Slack, and mobile companions.

This template deploys the OpenClaw gateway in a confidential VM on Phala Cloud. It keeps OpenClaw config, auth profiles, and agent workspace data in persistent Docker volumes.

## Services

- `openclaw-gateway`: OpenClaw gateway server.

## Ports

- `18789`: OpenClaw gateway HTTP/WebSocket endpoint.
- `18790`: bridge connectivity port.

## Required environment variables

```bash
OPENCLAW_GATEWAY_TOKEN=replace-with-a-long-random-token
```

Use a long random token when exposing the gateway outside localhost.

## Optional environment variables

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
CLAUDE_AI_SESSION_KEY=
CLAUDE_WEB_SESSION_KEY=
CLAUDE_WEB_COOKIE=
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=1
OPENCLAW_DISABLE_BONJOUR=1
TZ=UTC
```

## Persistent data

The template creates these volumes:

- `openclaw_config`: `/home/node/.openclaw`
- `openclaw_workspace`: `/home/node/.openclaw/workspace`
- `openclaw_auth_profiles`: `/home/node/.config/openclaw`

## Deploy

```bash
docker compose config
docker compose up -d
```

After the gateway starts, connect OpenClaw clients or companion nodes to the published gateway URL and port `18789`. Use `OPENCLAW_GATEWAY_TOKEN` for non-local access.

## Notes

- On startup, this template writes `gateway.mode=local` and `gateway.bind=${OPENCLAW_GATEWAY_BIND}` before launching the gateway. This avoids bootstrap failures on fresh volumes and keeps redeploys deterministic.
- Bonjour/mDNS is disabled because container bridge networking and remote CVM environments do not reliably support local network discovery.
- The upstream Docker setup also provides an interactive CLI sidecar. This Phala template keeps the deployment focused on the long-running gateway service so it can run reliably as a hosted CVM.
