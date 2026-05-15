# MOOF MCP

MOOF MCP server prebuilt template for Phala Cloud.

## Source

- Upstream repository: https://github.com/moofdotfun/MOOF-MCP
- Inspected upstream commit: `f3ff5b53d8e8d08f6bbb58024e8881489e4b3a34`
- Pinned image: `mooflowai/moof-mcp:p4aacnr9zhke`
- Pinned digest: `sha256:a11b0cf0643c9d6cb0e299b287f7be36302adb1bafd86107fb46ee5859d784b6`

The compose file uses the tag plus digest reference:

```text
mooflowai/moof-mcp:p4aacnr9zhke@sha256:a11b0cf0643c9d6cb0e299b287f7be36302adb1bafd86107fb46ee5859d784b6
```

## Phala Patch

The upstream `docker-compose.yml` declares `environment: {}`, so Phala-accepted template variables are not passed into the container. This template keeps the upstream image, port mapping, and `/var/run/tappd.sock` mount, then explicitly propagates the documented environment variables into the `app` service.

## Environment Variables

- `MOOF_API_KEY` (required): MOOF platform API key. The compose config fails if this is omitted.
- `MCP_API_KEY` (required): MCP API key. The compose config fails if this is omitted.
- `BASE_URL` (optional): MOOF app base URL. Defaults to `https://app.moof.fun`.
- `MCP_BASE_URL` (optional): MOOF MCP API base URL. Defaults to `https://dev-mcp-api.mooflow.ai`, matching the inspected source default.

Do not commit real API keys or secrets to this directory.

## Smoke Test Probes

After deployment, replace `APP_HOST` with the Phala CVM endpoint.

```bash
curl -i "https://APP_HOST/"
# Expect an app-level 404 response.

curl -iN "https://APP_HOST/sse"
# Expect HTTP 200 with an SSE stream. The request may stay open.
```

`/` returning `404` is expected for this app. `/sse` returning `200` confirms the HTTP server is running and serving the MCP SSE transport.

## Update Procedure

1. Inspect the new upstream source commit and record it in this README.
2. Verify the upstream image tag and public linux/amd64 digest.
3. Update `docker-compose.yml` to the new tag plus digest reference.
4. Re-check upstream environment variable names and defaults, then update the compose environment block and this README if needed.
5. Run:

```bash
MOOF_API_KEY=dummy MCP_API_KEY=dummy docker compose -f templates/prebuilt/moof-mcp/docker-compose.yml config
```

6. Smoke test `/` and `/sse` after deploying on Phala Cloud.
