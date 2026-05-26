# Context7

Context7 is a developer documentation MCP server from Upstash. It gives AI coding agents current, library-specific documentation and code examples through the Model Context Protocol.

This Phala Cloud template runs the official `@upstash/context7-mcp` npm package in native HTTP transport mode. It pins `@upstash/context7-mcp@2.3.0`, the stateless HTTP release that starts without database credentials. It publishes one public HTTP service on port `18080` and does not require API keys, tokens, model downloads, GPU access, host bind mounts, or privileged containers for the default smoke deployment.

## What It Deploys

- `context7`: a Node.js container built from `node:22-alpine` with `@upstash/context7-mcp@2.3.0` installed globally.
- `/ping`: public JSON smoke endpoint from the upstream server.
- `/mcp`: Streamable HTTP MCP endpoint for Context7 documentation tools.
- `/mcp/oauth`: upstream OAuth-protected MCP endpoint for clients that support Context7 OAuth.

Upstream repository: https://github.com/upstash/context7

Phala template source: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/context7

## Environment Variables

No environment variables are required for the default deployment.

Optional variables:

- `CONTEXT7_API_URL`: Optional Context7 API base URL override. Default: `https://context7.com/api`.
- `RESOURCE_URL`: Optional OAuth protected-resource URL advertised by the HTTP server. Default: `https://mcp.context7.com`.
- `AUTH_SERVER_URL`: Optional OAuth authorization-server URL advertised by the HTTP server. Default: `https://context7.com`.

Do not set a template-level `CONTEXT7_API_KEY` for this HTTP deployment. Upstream HTTP mode accepts Context7 API keys per MCP request header instead, which lets each client bring its own key. Clients can send `CONTEXT7_API_KEY`, `Context7-API-Key`, `X-API-Key`, or an `Authorization: Bearer <your-context7-api-key>` header when they need higher Context7 limits.

## Deploy On Phala Cloud

1. Open Phala Cloud and create a new deployment from the `context7` prebuilt template.
2. Use the default `tdx.small`-safe resources: `1` vCPU, `1024` MB memory, and `10` GB disk.
3. Leave the optional environment variables unset unless you operate a compatible Context7 API or OAuth endpoint.
4. Deploy the CVM and open the public HTTP endpoint exposed by Phala Cloud on port `18080`.

## Usage

Smoke endpoint:

```bash
curl -fsS https://<your-app-domain>/ping
```

Expected response:

```json
{"status":"ok","message":"pong"}
```

MCP endpoint reachability:

```bash
curl -i https://<your-app-domain>/mcp
```

The upstream server returns `405` for `GET /mcp` because Streamable HTTP MCP requests are sent with `POST`. That response still proves the route is live.

Minimal MCP initialize request:

```bash
curl -i https://<your-app-domain>/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl-smoke","version":"0.0.1"}}}'
```

Example MCP client configuration:

```json
{
  "mcpServers": {
    "context7": {
      "type": "streamablehttp",
      "url": "https://<your-app-domain>/mcp"
    }
  }
}
```

With a Context7 API key for higher upstream limits, keep the key in your MCP client configuration rather than in the Phala template:

```json
{
  "mcpServers": {
    "context7": {
      "type": "streamablehttp",
      "url": "https://<your-app-domain>/mcp",
      "headers": {
        "CONTEXT7_API_KEY": "YOUR_CONTEXT7_API_KEY"
      }
    }
  }
}
```

## Local Verification

From the `sdks` directory:

```bash
docker compose -f templates/prebuilt/context7/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/context7/docker-compose.yml up -d --build
curl -fsS http://127.0.0.1:18080/ping
curl -i http://127.0.0.1:18080/mcp
docker compose -f templates/prebuilt/context7/docker-compose.yml down --remove-orphans
```

Template catalog validation from the same directory:

```bash
python3 templates/validate.py
```

## Icon Source

The template icon `context7.svg` is copied from the upstream Context7 repository at `public/context7-icon.svg`:

https://github.com/upstash/context7/blob/master/public/context7-icon.svg

## Production Caveats

- The default `/mcp` endpoint is public and anonymous. Context7 may rate-limit anonymous usage; production MCP clients should pass their own Context7 API key header for higher limits.
- The template is pinned to `@upstash/context7-mcp@2.3.0` because upstream `3.0.0` HTTP mode requires Upstash Redis REST credentials for stateful sessions. Revisit the pin only if you also add a no-secret-compatible session store or explicit Redis configuration.
- This template intentionally does not add a Caddy bearer-token gate so `/ping` remains a simple public smoke endpoint and no fake secrets are needed. Add an access proxy or network policy in a fork if you need to restrict MCP access.
- Upstash notes that this repository contains the MCP server source while the Context7 API backend, parsing engine, and crawling engine are private supporting services.
- `GET /mcp` returning `405` is normal. MCP clients must use Streamable HTTP `POST` requests.
