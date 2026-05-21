# Supabase DB MCP

Deploy a protected Supabase MCP server on Phala Cloud.

This template lets MCP clients inspect and manage Supabase projects through a Supabase access token. Caddy protects the public MCP endpoint with bearer-token authentication.

## Services

- `app`: Supabase MCP server on internal port `3000`.
- `proxy`: Caddy reverse proxy exposed through Phala Cloud.

## Ports

- `18080`: Public MCP endpoint handled by Caddy.

## Required environment variables

- `BEARER_TOKEN`: Token required from MCP clients calling this deployment.
- `SUPABASE_ACCESS_TOKEN`: Supabase access token used by the MCP server.

## Mounted sockets

- `/var/run/docker.sock`: Docker socket mounted into the app container because the upstream server expects Docker access.

## MCP client configuration

```json
{
  "mcpServers": {
    "supabase": {
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

```bash
curl -i https://<your-app-domain>
curl -i -H "Authorization: Bearer YOUR_BEARER_TOKEN" https://<your-app-domain>
```

The first command should return `401`. The second command should reach the Supabase MCP server. Keep the Supabase access token scoped to the projects this deployment should manage.

When tool calls fail after authentication succeeds, verify the Supabase token in the dashboard and confirm the target project is visible to that token.
