# Armor Crypto MCP

Armor Crypto MCP prebuilt template for Phala Cloud.

## Source

- Upstream repository: https://github.com/HashWarlock/armor-crypto-mcp
- Upstream branch: `phala-mcp`
- Inspected upstream commit: `4835f496b16e25dcd0b604afe374ee51a185bb1a`
- Pinned image: `hashwarlock/armor-crypto-mcp`
- Pinned linux/amd64 digest: `sha256:ae7bda1b29077cdb39abf6d42587db630231dff5f2d38c7980108b9c14e48e1e`
- Upstream license: GNU General Public License v3.0, from the upstream `LICENSE` file at the inspected commit.

The compose file uses the digest reference:

```text
hashwarlock/armor-crypto-mcp@sha256:ae7bda1b29077cdb39abf6d42587db630231dff5f2d38c7980108b9c14e48e1e
```

## Phala Patch

The upstream `docker-compose.yml` publishes port `8000` and sets `PORT=8000`, but it does not pass the README-required `ARMOR_API_KEY` into the container. This template keeps the public upstream image and port, pins the linux/amd64 image digest, and explicitly propagates the required and optional Armor API environment variables.

## Environment Variables

- `ARMOR_API_KEY` (required): Armor API key. The compose config fails if this is omitted.
- `ARMOR_API_URL` (optional): Armor API base URL. Defaults to `https://app.armorwallet.ai/api/v1`.
- `ARMOR_ACCESS_TOKEN` (optional): Armor access token, if your Armor setup requires one.

Do not commit real API keys or secrets to this directory.

## Smoke Test Probes

After deployment, replace `APP_HOST` with the Phala CVM endpoint.

```bash
curl -iN "https://APP_HOST/sse"
# Expect HTTP 200 with an SSE stream. The request may stay open.

curl -i "https://APP_HOST/messages"
# Expect an HTTP response from the MCP message endpoint.
```

Dummy `ARMOR_API_KEY` or `ARMOR_ACCESS_TOKEN` values only validate that the server boots and exposes the MCP transport. They do not validate real Armor API calls.

## Update Procedure

1. Inspect the new upstream source commit and record it in this README.
2. Confirm the upstream license is still GPL v3.0 or update the license note if it changed.
3. Verify the public linux/amd64 image digest for the image being deployed.
4. Update `docker-compose.yml` to the new digest reference.
5. Re-check upstream environment variable names and defaults, then update the compose environment block and this README if needed.
6. Run:

```bash
ARMOR_API_KEY=dummy docker compose -f templates/prebuilt/armor-crypto/docker-compose.yml config
```

7. Smoke test `/sse` and `/messages` after deploying on Phala Cloud. Use a real Armor key for any test that exercises Armor API tools.
