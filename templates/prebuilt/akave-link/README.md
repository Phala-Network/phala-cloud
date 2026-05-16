# Akave Link

This prebuilt template deploys Akave Link behind a Caddy Basic Auth reverse proxy for Phala Cloud. The Akave Link app is kept on an internal Docker network and Caddy is the only service that publishes port `80`.

## Source

- Reference repo: https://github.com/DylanCkawalec/akavelink
- Reference commit: `69124a575eba00f97f3b344cffca5a3e088b1d5d`
- Upstream image: `dylanckawalec/akavelink@sha256:b2c4a351869d6ed0665e4e6a15c5c73fbea38489589d2547ed4a9026f0cdf73b`
- Caddy image: `caddy:2.8@sha256:b95ed06fbc6d74d24a40902090c8cc6086ce7d08ba60a3a7e8e62bf164a9d7bb`
- Platform: `linux/amd64`
- Upstream source license: GPL-3.0, based on the `LICENSE` file at the reference commit.

This Phala Cloud template does not vendor or modify upstream source code. It uses the pinned published upstream image plus local Docker Compose and Caddy wrapper files for deployment.

## Services

- `app`: Akave Link, listening only on the internal Docker network at port `80`.
- `caddy`: Public reverse proxy on `80:80`, protecting all routes with Basic Auth.
- `akave_downloads`: Named volume mounted at `/app/downloads`, replacing the upstream `./downloads` bind mount.

The app healthcheck is overridden to probe `http://localhost:80/health`, matching the configured app port. The Caddy healthcheck validates the local Caddyfile because the public `/health` route is intentionally protected and cannot be checked without the plaintext Basic Auth password.

## Environment

Required:

- `NODE_ADDRESS`: Akave node endpoint, for example `connect.akave.ai:5500`.
- `PRIVATE_KEY`: EVM private key used by Akave Link for bucket and file operations.
- `ADMIN_PASSWORD_HASH`: Caddy bcrypt hash for the Basic Auth password.

Optional:

- `AKAVELINK_USERNAME`: Basic Auth username. Defaults to `admin`.
- `PORT`: Catalog compatibility setting. Keep this at `80`; the compose file runs the app on internal port `80`.
- `CORS_ORIGIN`: App CORS origin. Defaults to `*`.
- `DEBUG`: App debug logging flag. Defaults to `true`.

`ADMIN_PASSWORD_HASH` is also passed to the app for forward compatibility, although the pinned upstream app currently ignores it for route authorization. Caddy is the enforced public access control layer.

## Generate `ADMIN_PASSWORD_HASH`

Use Caddy's bcrypt helper:

```bash
docker run --rm --platform linux/amd64 caddy:2.8@sha256:b95ed06fbc6d74d24a40902090c8cc6086ce7d08ba60a3a7e8e62bf164a9d7bb caddy hash-password --plaintext 'replace-with-a-long-random-password'
```

Set the generated hash as `ADMIN_PASSWORD_HASH`. If you use a local `.env` file with Docker Compose, wrap the bcrypt hash in single quotes so the `$` characters are preserved:

```env
AKAVELINK_USERNAME=admin
ADMIN_PASSWORD_HASH='$2a$14$replace.with.the.hash.from.caddy'
```

Keep the plaintext password outside the deployment environment. It is only needed by clients when sending Basic Auth credentials.

## Local Validation

Validate compose rendering with dummy values:

```bash
NODE_ADDRESS=connect.akave.ai:5500 \
PRIVATE_KEY=0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
ADMIN_PASSWORD_HASH='$2a$14$replace.with.a.real.caddy.hash.before.running' \
docker compose -f docker-compose.yml config --quiet
```

Use a real hash before starting the stack. After deployment, these probes are safe because they do not create buckets or write storage data:

```bash
BASE_URL=http://localhost
AKAVELINK_USERNAME=admin
AKAVELINK_ADMIN_PASSWORD='the-plaintext-password-used-for-the-hash'

curl -i "$BASE_URL/health"
curl -fsS -u "$AKAVELINK_USERNAME:$AKAVELINK_ADMIN_PASSWORD" "$BASE_URL/health"
curl -fsS -u "$AKAVELINK_USERNAME:$AKAVELINK_ADMIN_PASSWORD" "$BASE_URL/" >/dev/null
```

The unauthenticated `/health` request should return `401 Unauthorized`. The authenticated `/health` request should return the app health JSON.

For Phala Cloud, use the deployment gateway URL as `BASE_URL`, for example:

```bash
BASE_URL=https://<app-id>-80.<gateway-domain>
```

## Akave Operations

A syntactically valid but unfunded dummy private key can validate container boot, the UI, Caddy authentication, and `/health`. Real Akave bucket and file operations require a real funded private key for the target Akave network.

## Update Path

1. Review upstream changes from commit `69124a575eba00f97f3b344cffca5a3e088b1d5d`.
2. Choose and verify a replacement `linux/amd64` image digest.
3. Update `docker-compose.yml` with the new digest and keep the app unexposed behind Caddy.
4. Re-run Docker Compose config validation with dummy values.
5. Smoke test unauthenticated `401`, authenticated `/health`, and authenticated UI loading before updating the catalog entry.
