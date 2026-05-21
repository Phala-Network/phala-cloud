# Chatnio

Deploy Chatnio, a multi-model AI service management platform, with MySQL and Redis on Phala Cloud.

Chatnio provides a web console and API for managing model providers, users, quotas, and AI service access. This template includes the application container, an internal MySQL database, Redis, and a one-shot initializer that creates the root user securely.

## Services

- `chatnio`: Chatnio web application and API.
- `mysql`: Internal MySQL 8.4 database.
- `redis`: Internal Redis cache.
- `init-root-user`: One-shot setup job that creates the initial root account.

## Ports

- `8000`: Chatnio web UI and API, mapped to container port `8094`.

## Required environment variables

- `MYSQL_ROOT_PASSWORD`: Root password for the internal MySQL service.
- `MYSQL_PASSWORD`: Password for the `chatnio` MySQL user.
- `SECRET`: Chatnio application secret. Use at least 32 characters.
- `CHATNIO_ROOT_PASSWORD`: Initial `root` account password. Use 12-36 characters without whitespace.

Example values:

```bash
MYSQL_ROOT_PASSWORD=$(openssl rand -base64 24)
MYSQL_PASSWORD=$(openssl rand -base64 24)
SECRET=$(openssl rand -hex 32)
CHATNIO_ROOT_PASSWORD=$(openssl rand -base64 18 | tr -d '=+/')
```

## Persistent data

The template creates these volumes:

- `db`: MySQL data.
- `redis`: Redis data.
- `config`: Chatnio configuration.
- `logs`: Chatnio logs.
- `storage`: Chatnio uploaded and generated files.

## Deploy

1. Fill the required environment variables in Phala Cloud.
2. Deploy the template.
3. Open `https://<your-app-domain>`.
4. Sign in with username `root` and the `CHATNIO_ROOT_PASSWORD` value.

## Verify

```bash
curl -I https://<your-app-domain>
```

The MySQL and Redis services include healthchecks. The `init-root-user` job exits successfully after creating the root account or detecting an existing account.
