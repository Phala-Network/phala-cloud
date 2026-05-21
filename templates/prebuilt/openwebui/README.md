# Open WebUI

Deploy Open WebUI on Phala Cloud.

Open WebUI is a self-hosted AI chat and model management interface. This template runs the upstream Open WebUI container with persistent backend data.

## Services

- `open-webui`: Open WebUI backend and frontend, exposed through container port `8080`.

## Ports

- `3000`: Public Open WebUI endpoint mapped to container port `8080`.

## Optional environment variables

- `WEBUI_SECRET_KEY`: Secret key used by Open WebUI for session and authentication security. Generate a stable value and keep it across redeploys.

Generate a key:

```bash
openssl rand -hex 32
```

## Persistent data

- `open-webui`: Mounted at `/app/backend/data` for user accounts, settings, uploaded files, and local app state.

## Deploy

1. Set `WEBUI_SECRET_KEY` for production use.
2. Deploy the template.
3. Open `https://<your-app-domain>` and create the first admin user.
4. Configure model providers from the Open WebUI admin settings.

## Verify

```bash
curl -I https://<your-app-domain>
```

The first user created in a fresh data volume becomes the initial administrator.
