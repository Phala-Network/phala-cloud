# ElevenLabs MCP Server

Deploy a protected ElevenLabs MCP server on Phala Cloud.

This template gives MCP clients access to ElevenLabs voice and audio workflows. It runs the MCP server behind Caddy and includes a small file server for generated assets stored in a shared volume.

## Services

- `app`: ElevenLabs MCP server on internal port `8000`.
- `fileserver`: Python HTTP file server for generated files on port `8080`.
- `proxy`: Caddy reverse proxy exposed through Phala Cloud.

## Ports

- `18080`: Public MCP endpoint handled by Caddy.
- `8080`: Generated file server.

## Required environment variables

- `BEARER_TOKEN`: Token required from MCP clients calling this deployment.
- `ELEVENLABS_API_KEY`: ElevenLabs API key used by the MCP server.
- `ELEVENLABS_MCP_BASE_PATH`: Base path used by the ElevenLabs MCP server for generated files.

## Persistent data

- `elevenlabs_data`: Shared data volume mounted into both the MCP server and file server.

## MCP client configuration

```json
{
  "mcpServers": {
    "elevenlabs": {
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

The public MCP endpoint should require the bearer token before proxying traffic to the app service.
