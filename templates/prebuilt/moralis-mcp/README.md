# Moralis MCP

Moralis MCP server prebuilt template for Phala Cloud. The app is built locally at deploy time from pinned upstream source and exposed through a Caddy bearer-token proxy.

## Upstream

- Source repository: https://github.com/HashWarlock/moralis-mcp-server
- Pinned commit: `bcd9bf0ec430bb0dc68955973f13d61f9e3725d3`
- Upstream branch at inspection time: `phala-cloud`; deploy-time builds use the commit SHA, not the branch name.
- Package version: `@moralisweb3/api-mcp-server` `1.8.2`
- License: ISC, as declared in upstream `package.json`. The inspected commit does not include a standalone license file.

## Why This Template Builds Locally

The external compose file for the Phala Cloud support branch used `hashwarlock/moralis-mcp-server:v0.0.1`. Live smoke deployment showed the app container restarting and exiting with status 0 while the proxy stayed up. This template avoids the broken public image by building the server from the pinned source commit with Compose `dockerfile_inline`.

The inline Dockerfile downloads the immutable upstream archive, installs dependencies with `npm ci`, builds the TypeScript server, prunes development dependencies, and runs:

```bash
node ./dist/index.js --transport streamable-http
```

## Services

- `app`: Moralis MCP server on the internal Docker network at port `3000`.
- `proxy`: Caddy 2.8 on public port `18080`, requiring a bearer authorization header before forwarding to the app.

The app container does not publish port `3000` directly.

## Environment Variables

- `BEARER_TOKEN` (required): Bearer token checked by the Caddy proxy.
- `MORALIS_API_KEY` (required): Moralis API key used by the MCP tools when calling Moralis APIs.

Do not commit real API keys or bearer tokens to this directory.

## Local Compose Check

From the repository root:

```bash
BEARER_TOKEN=dummy MORALIS_API_KEY=dummy docker compose -f templates/prebuilt/moralis-mcp/docker-compose.yml config
```

## Smoke Probes

After deployment, replace `APP_HOST` with the Phala CVM endpoint for public port `18080`.

```bash
curl -i "https://APP_HOST/health"
```

Expected: `401 Unauthorized`, proving unauthenticated requests are blocked by Caddy.

Set AUTH_HEADER in your shell to the required bearer authorization header before running the authenticated examples.

```bash
curl -i -H "$AUTH_HEADER" "https://APP_HOST/health"
```

Expected: `200 OK` with JSON including `status: "OK"` and `server: "Moralis MCP"`.

```bash
curl -i -H "$AUTH_HEADER" "https://APP_HOST/mcp"
```

Expected: `405 Method Not Allowed`. The streamable HTTP MCP endpoint is `/mcp` and accepts MCP JSON-RPC over POST, so GET is rejected when the app is healthy.

## Update Path

1. Review upstream changes in https://github.com/HashWarlock/moralis-mcp-server.
2. Choose and record a new immutable upstream commit SHA.
3. Update `UPSTREAM_COMMIT` in `docker-compose.yml`.
4. Re-check the upstream runtime command, transport support, port, package license, and required environment variables.
5. Run the local compose check above.
6. Run `python3 templates/validate.py` from the repository root.
7. Run `git diff --check` before opening a pull request.
8. Smoke test `/health` and `/mcp` on a local or Phala Cloud deployment.

Do not switch this template back to `hashwarlock/moralis-mcp-server:v0.0.1` unless that image has been rebuilt, published for the expected platform, and verified by a Phala Cloud smoke deployment.
