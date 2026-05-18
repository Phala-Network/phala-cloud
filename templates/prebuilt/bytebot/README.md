# ByteBot Template

Deploy ByteBot, an open-source AI desktop agent, on Phala Cloud. ByteBot runs a browser-accessible desktop, an agent API, a web UI, and a PostgreSQL database inside the same Docker Compose deployment.

## Components

- `bytebot-desktop`: Ubuntu desktop environment, noVNC/websockify, and the ByteBot desktop daemon.
- `bytebot-agent`: Agent service that plans and executes tasks with configured LLM providers.
- `bytebot-ui`: Web UI for creating and monitoring tasks.
- `postgres`: Internal PostgreSQL database for ByteBot state.
- `caddy`: Public reverse proxy for the ByteBot desktop, agent API, and web UI.

## Phala Cloud Deployment

Use the ByteBot prebuilt template in Phala Cloud and provide these environment variables:

```bash
BYTEBOT_PASSWORD=replace-with-a-strong-password
BYTEBOT_USERNAME=bytebot
ANTHROPIC_API_KEY=replace-with-your-anthropic-api-key
OPENAI_API_KEY=replace-with-your-openai-api-key
GEMINI_API_KEY=replace-with-your-gemini-api-key
```

`BYTEBOT_PASSWORD` is required. `BYTEBOT_USERNAME` is optional and defaults to `bytebot`.

The LLM API keys are optional at deploy time, but at least one real provider key is required for actual ByteBot task execution. A deployment without a valid Anthropic, OpenAI, or Gemini key can start, but ByteBot will not be able to run real AI tasks.

Only set keys for providers you plan to use. Leave unused provider variables empty or unset.

## Authentication

This template does not expose `bytebot-desktop`, `bytebot-agent`, `bytebot-ui`, or `postgres` directly.

All public traffic goes through the `caddy` service. Caddy publishes ports `9990`, `9991`, and `9992`, generates a bcrypt hash from `BYTEBOT_PASSWORD` at container startup with `caddy hash-password --algorithm bcrypt --plaintext`, and enforces HTTP Basic Auth on all three public ports.

Use the same Basic Auth credentials for every public endpoint:

- Username: `BYTEBOT_USERNAME`, or `bytebot` when unset.
- Password: `BYTEBOT_PASSWORD`.

Do not use the placeholder password in production. Choose a long, unique password.
Use the HTTPS Phala gateway URL when accessing public endpoints, because Basic Auth credentials are reusable.

## Public Endpoints

Phala Cloud exposes the template ports through its public gateway. The exact hostnames are assigned by Phala Cloud after deployment.

- Port `9992`: ByteBot web UI, proxied to `bytebot-ui:9992`.
- Port `9990`: ByteBot desktop/noVNC and desktop daemon, proxied to `bytebot-desktop:9990`.
- Port `9991`: ByteBot agent API, proxied to `bytebot-agent:9991`.

Every request to these public endpoints must include Basic Auth. For direct API access to the public agent endpoint, configure your client to send Basic Auth credentials with the request.

## Internal Service URLs

The application services continue to communicate over the private Docker network:

```bash
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/bytebotdb
BYTEBOT_DESKTOP_BASE_URL=http://bytebot-desktop:9990
BYTEBOT_AGENT_BASE_URL=http://bytebot-agent:9991
BYTEBOT_DESKTOP_VNC_URL=http://bytebot-desktop:9990/websockify
```

These internal URLs are for container-to-container traffic only. They are not public gateway URLs and do not require Basic Auth inside the Docker network.

## Local Docker Compose Usage

For local testing, create a `.env` file next to `docker-compose.yml`:

```bash
BYTEBOT_PASSWORD=replace-with-a-strong-password
BYTEBOT_USERNAME=bytebot

# Provide at least one real key before running actual tasks.
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
```

Start the template:

```bash
docker compose up -d
```

Then open:

- `http://localhost:9992` for the ByteBot web UI.
- `http://localhost:9990` for the ByteBot desktop/noVNC endpoint.
- `http://localhost:9991` for the ByteBot agent API.

Your browser or API client will prompt for Basic Auth before access is granted.

## Usage Notes

- Create tasks from the web UI on port `9992`.
- Use the desktop endpoint on port `9990` for direct desktop access or takeover workflows.
- Use the agent API on port `9991` only with Basic Auth when calling it from outside the deployment.
- PostgreSQL is internal-only and is not published to the public gateway.
- ByteBot Desktop uses `shm_size: "2g"` and needs enough memory for browser and desktop automation workloads.

## Logs and Operations

View logs:

```bash
docker compose logs
docker compose logs caddy
docker compose logs bytebot-agent
docker compose logs bytebot-desktop
docker compose logs bytebot-ui
```

Restart services:

```bash
docker compose restart
docker compose restart caddy
docker compose restart bytebot-agent
```

## Resources

- [ByteBot Documentation](https://docs.bytebot.ai/introduction)
- [ByteBot GitHub Repository](https://github.com/bytebot-ai/bytebot)
- [Phala Cloud Documentation](https://docs.phala.network/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
