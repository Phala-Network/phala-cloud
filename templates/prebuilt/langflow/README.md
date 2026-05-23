# Langflow

Deploy Langflow on Phala Cloud.

Langflow is a visual, low-code platform for building AI agents and workflows. Upstream attribution belongs to [langflow-ai/langflow](https://github.com/langflow-ai/langflow). This template runs the official `langflowai/langflow` container, exposes the real Langflow web UI, and stores local app data in a named Docker volume.

## Services

- `langflow`: Langflow server, API, and web UI.

## Ports

- `80`: Public Langflow endpoint mapped to container port `7860`.

Open `https://<your-app-domain>` after deployment.

## Required environment variables

- `LANGFLOW_SUPERUSER_PASSWORD`: Password for the initial Langflow superuser. Generate a long random value and keep it in your Phala Cloud deployment environment.
- `LANGFLOW_SECRET_KEY`: Stable secret key used by Langflow for signing and encryption. Generate once and keep the same value across redeploys.

Generate safe values:

```bash
openssl rand -base64 32
python3 -c "from secrets import token_urlsafe; print(token_urlsafe(32))"
```

## Optional environment variables

- `LANGFLOW_SUPERUSER`: Initial superuser username. Defaults to `admin`.
- `LANGFLOW_AUTO_LOGIN`: Defaults to `false`. Keep this disabled for public deployments. Setting it to `true` bypasses login and is only appropriate for isolated testing.
- `LANGFLOW_WORKERS`: Langflow worker count. Defaults to `1` for small CPU deployments.
- `OPENAI_API_KEY`: Optional OpenAI key for flows that call OpenAI models.
- `ANTHROPIC_API_KEY`: Optional Anthropic key for flows that call Anthropic models.
- `GOOGLE_API_KEY`: Optional Google Gemini key for flows that call Google models.

The compose file also keeps these safer defaults:

- `LANGFLOW_REMOVE_API_KEYS=true`: API keys are removed from exported flow data.
- `LANGFLOW_STORE_ENVIRONMENT_VARIABLES=false`: Runtime environment variables are not imported into Langflow's variable store by default.
- `LANGFLOW_FALLBACK_TO_ENV_VAR=true`: Components can still read provider keys from runtime environment variables when configured to do so.
- `DO_NOT_TRACK=true`: Disables Langflow telemetry.

Do not commit API keys, passwords, or generated secret keys to source control. Store them as Phala Cloud environment variables.

## Persistent data

- `langflow_data`: Mounted at `/app/langflow`.

This volume stores Langflow's local configuration, SQLite database, uploaded assets, flows, users, and app state. Removing the volume resets the instance.

The compose service keeps `user: root` for first-boot volume preparation. Its startup command creates the mounted `/app/langflow` directory, changes ownership to the upstream image user named `user`, and then execs `langflow run --host 0.0.0.0 --port 7860`. This keeps the named volume writable on first boot when Docker creates it as `root`.

## Deploy

1. Create a Phala Cloud app from the `langflow` prebuilt template.
2. Set `LANGFLOW_SUPERUSER_PASSWORD` and `LANGFLOW_SECRET_KEY`.
3. Optionally add provider API keys such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_API_KEY`.
4. Deploy the template.
5. Open `https://<your-app-domain>` and log in with `LANGFLOW_SUPERUSER` and `LANGFLOW_SUPERUSER_PASSWORD`.

## Verify

Probe the public UI:

```bash
curl -I https://<your-app-domain>/
```

Some Langflow releases also expose a health route:

```bash
curl -fsS https://<your-app-domain>/health_check || curl -fsSI https://<your-app-domain>/
```

Inside the container, the Docker healthcheck probes `http://127.0.0.1:7860/`.

## Production notes

- Keep `LANGFLOW_AUTO_LOGIN=false` for any public deployment.
- Rotate `LANGFLOW_SUPERUSER_PASSWORD` and provider keys if they are exposed.
- Keep `LANGFLOW_SECRET_KEY` stable across redeploys so existing sessions and encrypted data remain valid.
- Use Langflow user accounts and API keys for shared access instead of sharing the superuser credentials.
- Review flows before importing them, especially if they include custom Python components or external webhooks.
- Keep the `langflowai/langflow` image current and test upgrades against the persistent `langflow_data` volume.

## Icon

The template icon is `templates/icons/langflow.svg`, sourced from the upstream Langflow repository at `docs/static/img/langflow-icon-black-transparent.svg`.
