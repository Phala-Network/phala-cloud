# Firecrawl

Deploy a protected Firecrawl template from the GitHub MCP Registry on Phala Cloud.

Extract web data with Firecrawl. Provides Firecrawl search, scrape, crawl, and extraction tools.

## Services

- `app`: MCP server runtime.
- `proxy`: Caddy reverse proxy on public port `18080` that enforces the local token.

## Ports

- `18080`: Public HTTP endpoint exposed by Phala Cloud.

## Environment variables

- `BEARER_TOKEN`: Local Phala gateway token checked through the `X-Phala-MCP-Token` request header.
- `FIRECRAWL_API_KEY` (required): Firecrawl API key.
- `FIRECRAWL_API_URL` (optional): Optional self-hosted Firecrawl API URL.

Generate a strong local gateway token before deployment:

```bash
openssl rand -hex 32
```

## MCP client configuration

Use the Phala Cloud app URL with the MCP endpoint path shown below:

```json
{
  "mcpServers": {
    "firecrawl-mcp-server": {
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

- GitHub MCP Registry: `https://github.com/mcp/firecrawl/firecrawl-mcp-server`
- Upstream repository: `https://github.com/firecrawl/firecrawl-mcp-server`
