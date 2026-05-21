# EVM MCP

Deploy a protected EVM MCP server on Phala Cloud.

This template exposes blockchain tools for EVM agent workflows, including RPC-backed chain interactions and optional AI-assisted data access. Caddy protects the public MCP endpoint with a bearer token.

## Services

- `app`: EVM MCP server on internal port `3000`.
- `proxy`: Caddy reverse proxy exposed through Phala Cloud.

## Ports

- `18080`: Public MCP endpoint handled by Caddy.

## Required environment variables

- `BEARER_TOKEN`: Token required from MCP clients calling this deployment.
- `EVM_PRIVATE_KEY`: EVM private key used by the MCP server for wallet operations.
- `RPC_URL`: EVM RPC endpoint.
- `OPENAI_API_KEY`: OpenAI API key used by the server.
- `PERPLEXITY_API_KEY`: Perplexity API key used by the server.
- `COINGECKO_PRO_API_KEY`: CoinGecko Pro API key used by the server.

## Security notes

- Use a dedicated wallet key with limited funds and scoped permissions.
- Store all API keys as Phala Cloud environment variables.
- Rotate `BEARER_TOKEN` when sharing MCP access with another client.

## MCP client configuration

```json
{
  "mcpServers": {
    "evm": {
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

The first command should return `401`. The second command should reach the MCP server.
