# Blinko

Blinko is an innovative **privacy-focused** open-source notebook designed for individuals who want to securely capture and organize their fleeting thoughts. Built with privacy at its core, Blinko can integrate with **Phala Network's secure computation framework** to ensure your ideas and notes remain confidential and protected. Whether you're brainstorming sensitive projects or personal musings, Blinko allows you to seamlessly jot down ideas the moment they strike, with the peace of mind that your data stays private and secure.

## Required environment variables

Set these variables before deploying:

```env
NEXTAUTH_SECRET=replace-with-a-long-random-secret
POSTGRES_PASSWORD=replace-with-a-long-url-safe-random-password
```

`NEXTAUTH_SECRET` signs Blinko authentication state and must stay stable across redeploys. Generate a long random value, for example with `openssl rand -hex 32`.

`POSTGRES_PASSWORD` is used by both the internal Postgres service and the Blinko app `DATABASE_URL`. Because it is embedded in a URL, use a URL-safe value such as hex output from `openssl rand -hex 32`, or percent-encode any reserved URL characters.

## Networking

Blinko is published on port `1111` and is the only public service in this template.

Postgres is internal-only. It has no host port or public Phala endpoint; the app reaches it on the Compose bridge network at `postgres:5432`.

## Local validation

Render the Compose file with dummy values before deployment:

```bash
NEXTAUTH_SECRET=dummy-nextauth-secret \
POSTGRES_PASSWORD=dummy-postgres-password \
docker compose -f docker-compose.yml config
```

For a quick smoke test after deployment, open the Phala app URL for port `1111`. Blinko should load in the browser, and the Postgres container should stay healthy without exposing a separate database endpoint.
