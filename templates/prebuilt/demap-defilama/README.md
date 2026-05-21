# DeMCP DeFiLlama

Deploy a protected DeMCP DeFiLlama MCP server on Phala Cloud.

This MCP server lets AI agents query DeFiLlama data such as protocol TVL, chain metrics, and token prices. The template exposes the server through Caddy with bearer-token authentication.

## Services

- `app`: DeMCP DeFiLlama MCP server on internal port `8080`.
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

```json
{
  "mcpServers": {
    "defillama": {
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

The first command should return `401`. The second command should reach the MCP server. Use a dedicated token per MCP client so access can be rotated independently.

DeFiLlama data is fetched by the upstream MCP server. Check container logs when authorized requests reach the proxy but tool calls return upstream data errors.
