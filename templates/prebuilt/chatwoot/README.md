# chatwoot/chatwoot on Phala Cloud

## Deploy, check, customize

1. Generate three stable secrets:
   - `SECRET_KEY_BASE`: `openssl rand -hex 64`
   - `POSTGRES_PASSWORD`: `openssl rand -hex 32`
   - `REDIS_PASSWORD`: `openssl rand -hex 32`
2. Deploy this template with the default 4 vCPU, 8 GB memory, and 40 GB disk.
3. Wait for the database migration and Rails startup, then open `https://<your-app-domain>/app/auth/signup` to create the first account.
4. After the first account exists, set `ENABLE_ACCOUNT_SIGNUP=false` and redeploy if public registration should close.
5. Add SMTP settings before inviting teammates or enabling email inboxes.

## What runs

This template deploys the official Chatwoot self-hosted stack with versions locked for reproducibility:

- `proxy`: Caddy `2.10.2` public HTTPS-gateway adapter on port `80`.
- `rails`: Chatwoot web application and API, `chatwoot/chatwoot:v4.16.0` on the internal port `3000`.
- `sidekiq`: background jobs using the same Chatwoot image.
- `migrate`: one-shot `bundle exec rails db:chatwoot_prepare` database preparation.
- `postgres`: PostgreSQL 16 with pgvector, `pgvector/pgvector:0.8.1-pg16`.
- `redis`: Redis persistence and job queue, `redis:8.2.5-alpine`.

The Caddy service publishes port `80` and forwards the Phala gateway's HTTPS scheme to Rails. Rails, PostgreSQL, and Redis stay internal to the Compose network. Named volumes preserve uploads, PostgreSQL data, and Redis data.

## Required environment variables

| Variable | Generator | Purpose |
| --- | --- | --- |
| `SECRET_KEY_BASE` | `openssl rand -hex 64` | Rails encryption and signing secret. Keep it stable across redeploys. |
| `POSTGRES_PASSWORD` | `openssl rand -hex 32` | Chatwoot PostgreSQL password. |
| `REDIS_PASSWORD` | `openssl rand -hex 32` | Chatwoot Redis password. |

Optional settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `FRONTEND_URL` | Phala app domain | Public Chatwoot URL used in links and callbacks. Set explicitly for a custom domain. |
| `ENABLE_ACCOUNT_SIGNUP` | `true` | Allows first-account creation. Set to `false` after bootstrap when public signup is unwanted. |
| `FORCE_SSL` | `false` | Caddy supplies the public HTTPS forwarding headers to Rails. |
| `LOG_LEVEL` | `info` | Rails log verbosity. |
| `MAILER_SENDER_EMAIL` | `Chatwoot <accounts@chatwoot.example>` | Sender used for account and notification email. |
| `SMTP_ADDRESS` | empty | SMTP server hostname. |
| `SMTP_PORT` | `587` | SMTP server port. |
| `SMTP_USERNAME` | empty | SMTP username. |
| `SMTP_PASSWORD` | empty | SMTP password. |
| `SMTP_AUTHENTICATION` | `plain` | SMTP authentication method. |
| `SMTP_ENABLE_STARTTLS_AUTO` | `true` | Enables STARTTLS when supported. |

## Persistent data

- `chatwoot_storage`: local attachment and Active Storage files.
- `postgres_data`: accounts, contacts, conversations, settings, and application records.
- `redis_data`: persistent Redis data for Sidekiq and caching.

Back up `chatwoot_storage` and `postgres_data` before upgrades. Keep the three required secrets in a secure secret manager.

## Verify / smoke test

Verify the public service after the migration has completed:

```bash
curl -fsSI https://<your-app-domain>/app/login
curl -fsS https://<your-app-domain>/api
```

The login request should return a successful HTTP response. The API root should return Chatwoot API metadata. In Phala Cloud, verify that `rails`, `sidekiq`, `postgres`, and `redis` are running and that the one-shot `migrate` service exited successfully.

For local Compose validation:

```bash
SECRET_KEY_BASE=validation-secret \
POSTGRES_PASSWORD=validation-postgres-password \
REDIS_PASSWORD=validation-redis-password \
docker compose -f templates/prebuilt/chatwoot/docker-compose.yml config
```

## Version upgrades

All runtime images use immutable version tags at the template level. Upgrade by changing the Chatwoot image tag for `rails`, `sidekiq`, and `migrate` together, reviewing the upstream release notes, backing up persistent data, and redeploying. The `migrate` service applies the matching database preparation task during startup.

This template starts at Chatwoot `v4.16.0`, released on July 18, 2026. PostgreSQL and Redis versions are also locked to prevent automatic major or minor image movement.

## Upstream sources

- Repository: [chatwoot/chatwoot](https://github.com/chatwoot/chatwoot)
- Locked release: [v4.16.0](https://github.com/chatwoot/chatwoot/releases/tag/v4.16.0)
- Official production Compose: [`docker-compose.production.yaml`](https://github.com/chatwoot/chatwoot/blob/v4.16.0/docker-compose.production.yaml)
- Official environment reference: [`.env.example`](https://github.com/chatwoot/chatwoot/blob/v4.16.0/.env.example)
- Official Rails entrypoint: [`docker/entrypoints/rails.sh`](https://github.com/chatwoot/chatwoot/blob/v4.16.0/docker/entrypoints/rails.sh)
- Template icon: upstream [`app/javascript/design-system/images/logo-thumbnail.svg`](https://github.com/chatwoot/chatwoot/blob/v4.16.0/app/javascript/design-system/images/logo-thumbnail.svg)

## Security and production notes

- The template references secrets through environment variables and contains no embedded credentials.
- SMTP and external channel credentials are added by the deployer after first boot.
- Local Active Storage is appropriate for a single Compose deployment. Configure an object-storage service for multi-instance production.
- Keep Rails, PostgreSQL, and Redis private. This template publishes only Caddy's web port.
- Size resources according to traffic and worker load. The default allocation prioritizes a reliable first deployment over minimum memory usage.
