# Context7 MCP

Deploy a protected Context7 MCP server on Phala Cloud.

Context7 gives AI agents current library documentation and code examples through MCP. This template runs the MCP server behind Caddy so the public endpoint requires a bearer token.

## Services

- `app`: Context7 MCP server on internal port `3000`.
- `proxy`: Caddy reverse proxy exposed through Phala Cloud.

## Ports

- `18080`: Public HTTP endpoint handled by Caddy.

## Required environment variables

- `BEARER_TOKEN`: Token required from MCP clients calling this deployment.

Generate a strong token:

```bash
openssl rand -hex 32
```

## MCP client configuration

Use your Phala Cloud app URL as a Streamable HTTP MCP endpoint:

```json
{
  "mcpServers": {
    "context7": {
      "type": "streamablehttp",
      "url": "https://<your-app-domain>",
      "headers": {
        "Authorization": "Bearer YOUR_BEARER_TOKEN"
      }
    }
  }
}
```

## Verify

Requests without the bearer token return `401`:

```bash
curl -i https://<your-app-domain>
```

Requests with the bearer token are proxied to the MCP server:

```bash
curl -i -H "Authorization: Bearer YOUR_BEARER_TOKEN" https://<your-app-domain>
```

Run the same checks after rotating `BEARER_TOKEN` or changing the app domain. Context7 returns MCP protocol responses only for clients that speak the configured Streamable HTTP transport.
