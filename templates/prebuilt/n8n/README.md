# n8n Workflow Automation

Deploy n8n on Phala Cloud with a compose file that works with Phala's built-in HTTPS app domain.

## Configuration

Set these encrypted secrets when deploying:

- `N8N_ENCRYPTION_KEY` - Required. Generate with `openssl rand -hex 32` and keep the same value for this instance.
- `GENERIC_TIMEZONE` - Optional. Defaults to `UTC`.
- `OPENAI_API_KEY` - Optional, for AI workflows.
- `GOOGLE_OAUTH_CLIENT_ID` - Optional, for Google integrations.
- `GOOGLE_OAUTH_CLIENT_SECRET` - Optional, for Google integrations.

Phala Cloud injects `DSTACK_APP_DOMAIN` automatically. The compose file uses it for `WEBHOOK_URL` and `N8N_EDITOR_BASE_URL`, so OAuth callbacks and webhooks use the public HTTPS app URL.

## First Run

After deployment, open the app URL shown by Phala Cloud. n8n displays its owner-account setup screen on first launch. n8n basic auth environment variables were removed upstream in n8n 1.0, so this template uses n8n's built-in user management flow.

## OAuth Callback URL

For OAuth providers such as Google, use:

```text
https://<your-phala-app-domain>/rest/oauth2-credential/callback
```

## Notes

- The service is exposed as `80:5678` so Phala's default app domain routes directly to n8n.
- n8n data persists in the `n8n_data` Docker volume.
- Keep `N8N_ENCRYPTION_KEY` stable. Changing it can prevent n8n from decrypting stored credentials.
