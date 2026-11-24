# discourse/discourse on Phala Cloud

[![Deploy on Phala Cloud](https://cloud.phala.com/deploy-button.svg)](https://cloud.phala.com/templates/discourse)

## Deploy, check, customize

1. Generate two stable secrets:
   - `DISCOURSE_DB_PASSWORD`: `openssl rand -hex 32`
   - `REDIS_PASSWORD`: `openssl rand -hex 32`
2. Set `DISCOURSE_DEVELOPER_EMAILS` to the address that should become the first admin on signup.
3. Deploy this template with the default 4 vCPU, 8 GB memory, and 40 GB disk.
4. Wait for PostgreSQL bootstrap, Discourse migrations, and Unicorn startup. First boot can take several minutes.
5. Open `https://<your-app-domain>` and create the first account with a developer email.
6. Add SMTP settings before inviting other people. Discourse uses email for signup confirmation, password resets, and notifications.
7. To serve a custom hostname, set `DOMAIN` (and usually `DISCOURSE_HOSTNAME` to the same value) plus a DNS provider token. Leave `DOMAIN` empty to use only the Phala Cloud app domain.

## What runs

This template deploys Discourse with versions locked for reproducibility:

- `proxy`: Caddy `2.10.2` public HTTPS-gateway adapter on port `80`.
- `dstack-ingress`: official `dstack-ingress` `2.8` on port `443` for an optional custom domain and Let's Encrypt certificate.
- `discourse`: official Discourse web image `discourse/discourse:2026.11.0-latest.2` (Nginx, Unicorn, Sidekiq) on the internal port `80`.
- `postgres`: Discourse PostgreSQL 18 with `hstore`, `pg_trgm`, and `vector`, `discourse/postgres:pg18`.
- `redis`: Redis persistence and job queue, `redis:7.4.12-alpine`.

Caddy publishes port `80` and forwards the Phala gateway's HTTPS scheme to Discourse. When `DOMAIN` is set, `dstack-ingress` publishes port `443`, obtains a certificate, and forwards TLS-terminated TCP to Caddy. If `DOMAIN` is empty, ingress stays idle and the Phala app domain remains the public URL. Discourse, PostgreSQL, and Redis stay internal to the Compose network. Named volumes preserve uploads, backups, PostgreSQL data, Redis data, and TLS certificates.

The published `discourse/discourse` image is Discourse's official prebuilt web image. Upstream still labels it experimental and recommends the `discourse_docker` launcher for production self-hosting. This template uses that image because Phala Cloud deploys a single Compose file.

## Required environment variables

| Variable | Generator | Purpose |
| --- | --- | --- |
| `DISCOURSE_DB_PASSWORD` | `openssl rand -hex 32` | PostgreSQL password for the `discourse` user. Keep it stable across redeploys. |
| `REDIS_PASSWORD` | `openssl rand -hex 32` | Redis password used by Discourse and Sidekiq. |
| `DISCOURSE_DEVELOPER_EMAILS` | your admin email | Comma-separated emails that become admin and developer on first signup. |

Optional settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DISCOURSE_HOSTNAME` | `DOMAIN`, then the Phala app domain | Public hostname without `https://`. Set it to the same value as `DOMAIN` for a custom hostname. |
| `DOMAIN` | empty | Custom hostname for `dstack-ingress` (for example `forum.example.com`). Leave empty to use only the Phala app domain. |
| `GATEWAY_DOMAIN` | `gateway.${DSTACK_GATEWAY_DOMAIN}` | dstack gateway hostname used as the custom-domain CNAME target. |
| `CLOUDFLARE_API_TOKEN` | empty | Cloudflare token with Zone:Read and DNS:Edit. Required for `dns-01` when `DNS_PROVIDER=cloudflare`. |
| `DNS_PROVIDER` | `cloudflare` | DNS provider for certificate validation: `cloudflare`, `linode`, `namecheap`, or `route53`. |
| `CERTBOT_EMAIL` | empty | Optional ACME contact address. Published in ingress evidence if set. |
| `SET_CAA` | `true` | Publish a Let's Encrypt CAA record for the custom domain. |
| `CHALLENGE_TYPE` | `dns-01` | `dns-01` (DNS API token) or `tls-alpn-01` (create DNS records by hand). |
| `DISCOURSE_NOTIFICATION_EMAIL` | `noreply@example.com` | Address used as the sender for forum notifications. |
| `DISCOURSE_SMTP_ADDRESS` | empty | SMTP server hostname. |
| `DISCOURSE_SMTP_PORT` | `587` | SMTP server port. |
| `DISCOURSE_SMTP_USER_NAME` | empty | SMTP username. |
| `DISCOURSE_SMTP_PASSWORD` | empty | SMTP password. |
| `DISCOURSE_SMTP_ENABLE_START_TLS` | `true` | Enables STARTTLS when the provider supports it. |

## Custom domain

The default public URL is the Phala Cloud app domain on port `80`. To use your own hostname:

1. Create a DNS API token. Cloudflare needs Zone:Read and DNS:Edit. Linode, Namecheap, and Route53 are also supported.
2. Set `DOMAIN` to the hostname, for example `forum.example.com`.
3. Set `DISCOURSE_HOSTNAME` to the same hostname, or leave it empty so the template copies `DOMAIN`.
4. Set `CLOUDFLARE_API_TOKEN` (or the matching token for another `DNS_PROVIDER`).
5. Redeploy. `dstack-ingress` writes the CNAME/TXT/CAA records, obtains a Let's Encrypt certificate, and proxies `https://<DOMAIN>` to Caddy.

`GATEWAY_DOMAIN` defaults to `gateway.${DSTACK_GATEWAY_DOMAIN}`. Override it only when the CVM uses a different gateway hostname. First certificate issuance usually takes a few minutes.

Without a DNS API token, set `CHALLENGE_TYPE=tls-alpn-01` and create the records that `dstack-ingress` prints at startup. That mode pins the hostname to one CVM instance.

## Persistent data

- `discourse_shared`: uploads, backups, and other Discourse files under `/shared`.
- `postgres_data`: forum topics, users, settings, and application records.
- `redis_data`: persistent Redis data for Sidekiq and caching.
- `cert-data`: Let's Encrypt certificates managed by `dstack-ingress`.
- `evidences`: TLS certificate attestation evidence served at `/evidences/` on the custom domain.

Back up `discourse_shared` and `postgres_data` before upgrades. Keep the two required secrets and the developer email list in a secure secret manager.

## Verify / smoke test

Verify the public service after migrations have completed:

```bash
curl -fsS https://<your-app-domain>/srv/status
curl -fsSI https://<your-app-domain>/
```

`/srv/status` should return `ok`. The site root should return a successful HTTP response. In Phala Cloud, verify that `discourse`, `postgres`, `redis`, and `proxy` are running. `dstack-ingress` stays up even when `DOMAIN` is empty; it only provisions a certificate after `DOMAIN` is set.

For local Compose validation:

```bash
DISCOURSE_DB_PASSWORD=validation-postgres-password \
REDIS_PASSWORD=validation-redis-password \
DISCOURSE_DEVELOPER_EMAILS=admin@example.com \
docker compose -f templates/prebuilt/discourse/docker-compose.yml config
```

## Version upgrades

All runtime images use immutable version tags at the template level. Upgrade by changing the Discourse image tag, reviewing the upstream release notes, backing up persistent data, and redeploying. `MIGRATE_ON_BOOT=1` applies matching database migrations during startup.

This template starts at Discourse `2026.11.0-latest.2`. PostgreSQL and Redis versions are also locked to prevent automatic major or minor image movement.

## Upstream sources

- Repository: [discourse/discourse](https://github.com/discourse/discourse)
- Locked web image: [discourse/discourse:2026.11.0-latest.2](https://hub.docker.com/r/discourse/discourse/tags)
- Official PostgreSQL image: [discourse/postgres](https://github.com/discourse/discourse-postgres)
- Official cloud install guide: [INSTALL-cloud.md](https://github.com/discourse/discourse/blob/main/docs/INSTALL-cloud.md)
- Official web-only launcher sample: [`samples/web_only.yml`](https://github.com/discourse/discourse_docker/blob/main/samples/web_only.yml)
- Custom domain ingress: [dstack-ingress](https://github.com/Dstack-TEE/dstack-examples/tree/main/custom-domain/dstack-ingress)
- Template icon: Discourse GitHub organization avatar

## Security and production notes

- The template references secrets through environment variables and contains no embedded credentials.
- SMTP credentials are added by the deployer after first boot.
- Keep Discourse, PostgreSQL, and Redis private. This template publishes Caddy on port `80` and `dstack-ingress` on port `443`.
- Do not enable Let's Encrypt inside the Discourse container. The Phala gateway terminates TLS for the default app domain; `dstack-ingress` terminates TLS for a custom domain.
- For a custom domain, set `DOMAIN` and `DISCOURSE_HOSTNAME` to the same hostname, and provide the matching DNS provider token. See the [custom domain guide](https://github.com/Dstack-TEE/dstack-examples/tree/main/custom-domain/dstack-ingress).
- Changing `DISCOURSE_DB_PASSWORD` after the first boot does not rotate the PostgreSQL role password. Set it once and keep it.
- Size resources according to traffic and Sidekiq load. The default allocation prioritizes a reliable first deployment over minimum memory usage.
