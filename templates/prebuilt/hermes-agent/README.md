# Hermes Agent on Phala Cloud

Hermes Agent is a persistent AI agent gateway from Nous Research. It can run command-capable conversations, expose an OpenAI-compatible API server, host a dashboard, and connect to messaging platforms such as Telegram, Discord, Slack, and WhatsApp.

This template deploys Hermes Agent in a confidential VM on Phala Cloud with a shared persistent data volume.

## Services

- `gateway`: Hermes gateway and OpenAI-compatible API server.
- `dashboard`: Hermes web dashboard.

## Ports

- `8642`: OpenAI-compatible API server and health endpoint.
- `9119`: Hermes dashboard.

## Required environment variables

```bash
API_SERVER_KEY=replace-with-a-long-random-api-key
```

`API_SERVER_KEY` is required because this template binds the API server to `0.0.0.0` for remote access through Phala Cloud.

## Optional environment variables

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=
DISCORD_TOKEN=
SLACK_BOT_TOKEN=
HERMES_UID=10000
HERMES_GID=10000
API_SERVER_HOST=0.0.0.0
```

Hermes can also read additional configuration and provider credentials from files inside its persistent data directory.

## Persistent data

The `hermes_data` volume is mounted to `/opt/data` and stores Hermes state:

- `.env`
- `config.yaml`
- `SOUL.md`
- `sessions/`
- `memories/`
- `skills/`
- `cron/`
- `hooks/`
- `logs/`

Do not run two Hermes gateway containers against the same data directory. The dashboard service can share the volume with the gateway.

## Deploy

```bash
docker compose up -d
```

After deployment:

- Open the dashboard on port `9119`.
- Use the API server on port `8642` with `API_SERVER_KEY`.

## Notes

- The upstream compose file uses `network_mode: host` and binds the dashboard to `127.0.0.1`. This Phala template uses normal Compose port mappings and binds the dashboard to `0.0.0.0` so it can be reached through the CVM gateway.
- Keep `API_SERVER_KEY` secret and rotate it if it is exposed.
