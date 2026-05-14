# Context7 MCP

Context7 MCP server on Phala Cloud for retrieving up-to-date library documentation and code examples.

## Environment Variables

- `BEARER_TOKEN` (required): Bearer token checked by the Caddy proxy.

## Expected HTTP Behavior

- Request without `Authorization` header returns `401 Unauthorized` from the proxy.
- Request to `/` with correct bearer token may return app-level `404 Not Found`.

An authenticated `404` on `/` is expected for this app and indicates proxy auth is working and requests are reaching the backend.

## Example `.env`

```env
BEARER_TOKEN=CHANGEME_BEARER_TOKEN
```

## MCP Client Endpoint

Use the authenticated SSE endpoint:

```text
https://APP_HOST/sse
```

Quick check:

```bash
curl -iN -H "Authorization: Bearer ${BEARER_TOKEN}" "https://APP_HOST/sse"
```
