# MCP Server Sequential Thinking

This Phala Cloud prebuilt template runs the Sequential Thinking MCP server from Leechael's `mcp-servers` repository as an HTTP SSE service.

## Upstream

- URL: https://github.com/Leechael/mcp-servers/tree/main/src/sequentialthinking
- Pinned commit: `ded1d9211d0c713161cec146a96fe901e61e5fa7`
- Upstream commit date: 2025-05-07
- License: MIT, inherited from the upstream repository and the `src/sequentialthinking` package metadata.

## Why this wrapper exists

The upstream `src/sequentialthinking/docker-compose.yaml` references `leechael/mcp-server-sequentialthinking:latest`. That image is not publicly pullable, so Docker manifest inspection and Phala Cloud smoke deployment fail with pull access denied.

This template keeps deployment self-contained in Phala Cloud by using Compose `dockerfile_inline` to build the server from the pinned upstream source instead of depending on the missing image or waiting for an upstream image fix. The inline Dockerfile fetches the pinned repository archive, copies only `src/sequentialthinking`, pins the direct npm dependencies to the versions recorded with that upstream commit, patches the POST endpoint to `/messages`, builds the TypeScript package, prunes development dependencies, and runs the compiled server on port `3001`.

## Service

- Service: `mcp-server-sequential-thinking`
- Host port: `8000`
- Container port: `3001`
- Restart policy: `unless-stopped`

## Smoke Probes

After deployment, replace `APP_HOST` with the Phala CVM endpoint for port `8000`.

```bash
curl -i "https://APP_HOST/"
```

Expected: `404 Not Found`. The server does not define a root route, so this confirms the HTTP app is reachable.

```bash
curl -iN "https://APP_HOST/sse"
```

Expected: `200 OK` with `Content-Type: text/event-stream` and an `event: endpoint` line. The endpoint event should point clients at `/messages?sessionId=...`.

```bash
curl -i -X POST "https://APP_HOST/messages"
```

Expected: `400 Bad Request` with an invalid session response because no `session_id` or `sessionId` query parameter was supplied.

## Update Path

1. Review upstream changes in https://github.com/Leechael/mcp-servers/tree/main/src/sequentialthinking.
2. Choose and record a new immutable upstream commit SHA.
3. Update `UPSTREAM_COMMIT` in `docker-compose.yml`.
4. Re-check whether the local `/messages` endpoint patch is still required.
5. Run `docker compose config` from this template directory.
6. Run `python3 templates/validate.py` from the repository root.
7. Run smoke probes against a local or Phala Cloud deployment.

Do not switch this template back to `leechael/mcp-server-sequentialthinking:latest` unless the image is public, maintained, and verified by manifest inspection and a Phala Cloud smoke test.
