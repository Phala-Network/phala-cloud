# Atlassian

Deploy a protected Atlassian template from the GitHub MCP Registry on Phala Cloud.

Atlassian Rovo MCP Server. Proxies Atlassian’s hosted Streamable HTTP MCP endpoint. Complete upstream Atlassian auth from the MCP client.

This template proxies the upstream streamable-http endpoint `https://mcp.atlassian.com/v1/mcp`. Keep upstream OAuth/API authorization in the MCP client request headers and use `X-Phala-MCP-Token` only for the Phala gateway gate.

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
    "atlassian-mcp-server": {
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

- GitHub MCP Registry: `https://github.com/mcp/com.atlassian/atlassian-mcp-server`
- Upstream repository: `https://github.com/atlassian/atlassian-mcp-server`
