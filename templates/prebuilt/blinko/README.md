# Blinko

Deploy Blinko, a privacy-focused self-hosted notebook, with its PostgreSQL database on Phala Cloud.

Blinko captures notes, ideas, and lightweight knowledge snippets in a web UI. This template runs the Blinko web app and an internal PostgreSQL service with persistent volumes for app data and database state.

## Services

- `blinko-website`: Blinko web application, exposed on port `1111`.
- `postgres`: Internal PostgreSQL 14 database used by Blinko.

## Ports

- `1111`: Blinko web UI.

## Required environment variables

- `NEXTAUTH_SECRET`: Secret used by Blinko authentication. Generate a strong random value.
- `POSTGRES_PASSWORD`: PostgreSQL password for the internal database.

Example values:

```bash
NEXTAUTH_SECRET=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -base64 24)
```

## Persistent data

The template creates these volumes:

- `blinko`: Blinko app data mounted at `/app/.blinko`.
- `db`: PostgreSQL data mounted at `/var/lib/postgresql/data`.

## Deploy

1. Create the required environment variables in the Phala Cloud template form.
2. Deploy the template.
3. Open `https://<your-app-domain>` and finish Blinko's first-run setup.

## Verify

After deployment, check the web UI and health endpoint behavior:

```bash
curl -I https://<your-app-domain>
```

The app container also runs a healthcheck against `http://blinko-website:1111/` inside the compose network.
