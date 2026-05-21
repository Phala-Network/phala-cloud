# NEAR MCP Server

Deploy a protected NEAR MCP server on Phala Cloud.

This template lets AI agents use NEAR blockchain tools through MCP. It writes a base64-encoded NEAR keystore into the expected location at container startup and exposes the MCP server through Caddy bearer-token authentication.

## Services

- `app`: NEAR MCP server on internal port `3001`.
- `proxy`: Caddy reverse proxy exposed through Phala Cloud.

## Ports

- `18080`: Public MCP endpoint handled by Caddy.

## Required environment variables

- `BEARER_TOKEN`: Token required from MCP clients calling this deployment.
- `NEAR_KEYSTOREDATA`: Base64-encoded NEAR keystore JSON.
- `NEAR_ACCOUNT_ID`: NEAR account ID matching the keystore.

## Optional environment variables

- `NEAR_NETWORK`: NEAR network name. Defaults to `mainnet`.

Generate `NEAR_KEYSTOREDATA` from a local keystore file:

```bash
base64 -w 0 ~/.near-credentials/mainnet/<account-id>.json
```

## MCP client configuration

```json
{
  "mcpServers": {
    "near": {
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

The first command should return `401`. The second command should reach the NEAR MCP server.
