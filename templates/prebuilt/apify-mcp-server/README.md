# Apify

Deploy a protected Apify template from the GitHub MCP Registry on Phala Cloud.

Extract data from any website with thousands of scrapers, crawlers, and automations on Apify Store ⚡. Proxies Apify’s hosted MCP endpoint. Send upstream Authorization: Bearer <APIFY_TOKEN> from the MCP client when needed.

This template proxies the upstream streamable-http endpoint `https://mcp.apify.com/`. Keep upstream OAuth/API authorization in the MCP client request headers and use `X-Phala-MCP-Token` only for the Phala gateway gate.

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
    "apify-mcp-server": {
      "type": "streamablehttp",
      "url": "https://<your-app-domain>/mcp",
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
curl -i https://<your-app-domain>/mcp
```

Then verify that authenticated requests reach the MCP server or upstream MCP endpoint:

```bash
curl -i -H "X-Phala-MCP-Token: YOUR_BEARER_TOKEN" https://<your-app-domain>/mcp
```

A full MCP client performs the protocol initialization over the configured transport. Use the same checks after rotating `BEARER_TOKEN`, changing upstream credentials, or redeploying the template.

## Source

- GitHub MCP Registry: `https://github.com/mcp/com.apify/apify-mcp-server`
- Upstream repository: `https://github.com/apify/apify-mcp-server`
