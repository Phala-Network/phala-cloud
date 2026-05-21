# n8n Workflow Automation

Deploy n8n workflow automation on Phala Cloud.

n8n lets you connect APIs, run scheduled jobs, receive webhooks, and build automation workflows through a visual editor. This template configures n8n for Phala Cloud app domains so webhooks and OAuth callbacks use the public HTTPS URL.

## Services

- `n8n`: n8n editor, API, worker runtime, and webhook receiver.

## Ports

- `80`: Public n8n endpoint mapped to container port `5678`.

## Required environment variables

- `N8N_ENCRYPTION_KEY`: Stable encryption key for n8n credentials. Generate once and keep it across redeploys.

Generate a key:

```bash
openssl rand -hex 32
```

## Optional environment variables

- `GENERIC_TIMEZONE`: Timezone for schedules. Defaults to `UTC`.
- `N8N_PROTOCOL`: Public protocol. Defaults to `https`.
- `N8N_SECURE_COOKIE`: Secure cookie setting. Defaults to `true`.
- `OPENAI_API_KEY`: Optional OpenAI key for workflows that use OpenAI nodes.
- `GOOGLE_OAUTH_CLIENT_ID`: Optional Google OAuth client ID.
- `GOOGLE_OAUTH_CLIENT_SECRET`: Optional Google OAuth client secret.

## Persistent data

- `n8n_data`: Mounted at `/home/node/.n8n` for workflows, credentials, and local n8n state.

## OAuth and webhook URLs

The compose file derives these from `DSTACK_APP_DOMAIN`:

- `N8N_EDITOR_BASE_URL=https://<your-app-domain>/`
- `WEBHOOK_URL=https://<your-app-domain>/`

Use the same public domain when configuring OAuth callback URLs in external services.

## Deploy

1. Set `N8N_ENCRYPTION_KEY`.
2. Deploy the template.
3. Open `https://<your-app-domain>` and create the first n8n owner account.

## Verify

```bash
curl -I https://<your-app-domain>/healthz
```

The container healthcheck also probes `http://127.0.0.1:5678/healthz`.
