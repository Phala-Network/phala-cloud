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

## What runs

This template deploys Discourse with versions locked for reproducibility:

- `proxy`: Caddy `2.10.2` public HTTPS-gateway adapter on port `80`.
- `discourse`: official Discourse web image `discourse/discourse:2026.11.0-latest.2` (Nginx, Unicorn, Sidekiq) on the internal port `80`.
- `postgres`: Discourse PostgreSQL 18 with `hstore`, `pg_trgm`, and `vector`, `discourse/postgres:pg18`.
- `redis`: Redis persistence and job queue, `redis:7.4.12-alpine`.

The Caddy service publishes port `80` and forwards the Phala gateway's HTTPS scheme to Discourse. Discourse, PostgreSQL, and Redis stay internal to the Compose network. Named volumes preserve uploads, backups, PostgreSQL data, and Redis data.

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
| `DISCOURSE_HOSTNAME` | Phala app domain | Public hostname without `https://`. Set explicitly for a custom domain. |
| `DISCOURSE_NOTIFICATION_EMAIL` | `noreply@example.com` | Address used as the sender for forum notifications. |
| `DISCOURSE_SMTP_ADDRESS` | empty | SMTP server hostname. |
| `DISCOURSE_SMTP_PORT` | `587` | SMTP server port. |
| `DISCOURSE_SMTP_USER_NAME` | empty | SMTP username. |
| `DISCOURSE_SMTP_PASSWORD` | empty | SMTP password. |
| `DISCOURSE_SMTP_ENABLE_START_TLS` | `true` | Enables STARTTLS when the provider supports it. |

## Persistent data

- `discourse_shared`: uploads, backups, and other Discourse files under `/shared`.
- `postgres_data`: forum topics, users, settings, and application records.
- `redis_data`: persistent Redis data for Sidekiq and caching.

Back up `discourse_shared` and `postgres_data` before upgrades. Keep the two required secrets and the developer email list in a secure secret manager.

## Verify / smoke test

Verify the public service after migrations have completed:

```bash
curl -fsS https://<your-app-domain>/srv/status
curl -fsSI https://<your-app-domain>/
```

`/srv/status` should return `ok`. The site root should return a successful HTTP response. In Phala Cloud, verify that `discourse`, `postgres`, `redis`, and `proxy` are running.

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
- Template icon: Discourse GitHub organization avatar

## Security and production notes

- The template references secrets through environment variables and contains no embedded credentials.
- SMTP credentials are added by the deployer after first boot.
- Keep Discourse, PostgreSQL, and Redis private. This template publishes only Caddy's web port.
- Do not enable Let's Encrypt inside the Discourse container. Phala Cloud terminates TLS at the gateway.
- Changing `DISCOURSE_DB_PASSWORD` after the first boot does not rotate the PostgreSQL role password. Set it once and keep it.
- Size resources according to traffic and Sidekiq load. The default allocation prioritizes a reliable first deployment over minimum memory usage.
