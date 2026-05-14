# Solana MCP by SendAI & DARK

Solana MCP server running behind a Caddy auth proxy on Phala Cloud.

## Environment Variables

- `BEARER_TOKEN` (required): Bearer token checked by the Caddy proxy.
- `SOLANA_PRIVATE_KEY` (required): Solana private key in base58 string format.
- `RPC_URL` (required): Solana RPC endpoint URL, for example `https://api.devnet.solana.com`.
- `OPENAI_API_KEY` (optional): Used by some upstream Solana Agent Kit flows.

## Important Key Format Note

`SOLANA_PRIVATE_KEY` must be a valid base58 Solana secret key string. Do not use:

- Arbitrary placeholder text.
- JSON-array key material like `[12,34,...]`.

Using a non-base58 value commonly causes authenticated proxy requests to return `502` because the upstream app fails to start correctly.

## Example `.env`

```env
BEARER_TOKEN=CHANGEME_BEARER_TOKEN
SOLANA_PRIVATE_KEY=CHANGEME_VALID_BASE58_SOLANA_SECRET_KEY
RPC_URL=https://api.devnet.solana.com
OPENAI_API_KEY=
```

## Verify Deployment

Replace `APP_HOST` with your Phala CVM endpoint.

```bash
# 1) No auth should be blocked by proxy
curl -i "https://APP_HOST/"
# Expect: HTTP/1.1 401 Unauthorized

# 2) Authenticated root can return app-level 404 (this is OK)
curl -i -H "Authorization: Bearer ${BEARER_TOKEN}" "https://APP_HOST/"
# Expect: HTTP/1.1 404 Not Found (or similar app-level response)

# 3) MCP SSE endpoint should be reachable when app is healthy
curl -iN -H "Authorization: Bearer ${BEARER_TOKEN}" "https://APP_HOST/sse"
# Expect: HTTP/1.1 200 and an SSE `event: endpoint` line
```
