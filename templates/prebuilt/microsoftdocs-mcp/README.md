# Microsoft Learn

Deploy a protected Microsoft Learn template from the GitHub MCP Registry on Phala Cloud.

Enables clients like GitHub Copilot and other AI agents to bring trusted and up-to-date information directly from Microsoft's official documentation. Proxies the hosted Microsoft Learn MCP endpoint for trusted Microsoft documentation search.

This template proxies the upstream sse endpoint `https://learn.microsoft.com/api/mcp`. Keep upstream OAuth/API authorization in the MCP client request headers and use `X-Phala-MCP-Token` only for the Phala gateway gate.

## Services

- `proxy`: Caddy reverse proxy on public port `18080` that gates access and forwards traffic to the upstream hosted MCP endpoint.

## Ports

- `18080`: Public HTTP endpoint exposed by Phala Cloud.

## Environment variables

- `BEARER_TOKEN`: Local Phala gateway token checked through the `X-Phala-MCP-Token` request header.

Generate a strong local gateway token before deployment:

```bash
openssl rand -hex 32
```

## MCP client configuration

Use the Phala Cloud app URL with the MCP endpoint path shown below:

```json
{
  "mcpServers": {
    "microsoftdocs-mcp": {
      "type": "sse",
      "url": "https://<your-app-domain>/sse",
      "headers": {
        "X-Phala-MCP-Token": "YOUR_BEARER_TOKEN"
      }
    }
  }
}
```

For upstream services that require OAuth or API-token authorization, keep those upstream headers in the MCP client configuration alongside `X-Phala-MCP-Token`.

## Verify

Check that the local gate rejects unauthenticated traffic:

```bash
curl -i https://<your-app-domain>/sse
```

Then verify that authenticated requests reach the MCP server or upstream MCP endpoint:

```bash
curl -i -H "X-Phala-MCP-Token: YOUR_BEARER_TOKEN" https://<your-app-domain>/sse
```

A full MCP client performs the protocol initialization over the configured transport. Use the same checks after rotating `BEARER_TOKEN`, changing upstream credentials, or redeploying the template.

## Source

- GitHub MCP Registry: `https://github.com/mcp/microsoftdocs/mcp`
- Upstream repository: `https://github.com/microsoftdocs/mcp`
