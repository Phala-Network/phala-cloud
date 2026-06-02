# twentyhq/twenty

Deploy a CPU-safe Twenty SDK verifier on Phala Cloud.

## Metadata

- Template id: `twenty`
- Display name: `twentyhq/twenty`
- Category: AI Apps & Workflows
- Upstream repository: https://github.com/twentyhq/twenty
- Upstream author: `twentyhq`
- NPM packages: `twenty-sdk` and `twenty-client-sdk`
- Default package versions: `2.8.0`
- Icon source: upstream `packages/twenty-website/public/images/core/logo.svg`, referenced by the upstream README, inspected from `twentyhq/twenty` at commit `fc90b4ba8bb0a5d7c12c846fe9b2305527a0f7a8`

## Overview

Twenty is an open-source CRM and app platform with objects, views, workflows, AI skills, agents, and developer SDKs. The upstream README describes it as the "#1 Open-Source CRM" and links self-hosting to the official Docker Compose guide.

The full self-hosted Twenty stack is a production CRM deployment: it runs the `twentycrm/twenty` server image with Postgres, Redis, a worker process, persistent storage, `SERVER_URL`, a generated `ENCRYPTION_KEY`, and a durable Postgres password. That is useful for production, but it is not a no-secret smoke template.

This Phala Cloud template therefore runs a deterministic verifier instead of the full CRM. At startup it installs the real `twenty-sdk` and `twenty-client-sdk` NPM packages, imports `twenty-sdk/define` plus `twenty-client-sdk` modules, validates a local application/object/skill/agent manifest, and serves JSON endpoints for health checks. It does not start a browser login flow, create a workspace, connect to Postgres, call an LLM provider, download model weights, or require API credentials.

## Services

- `app`: Node.js HTTP verifier on public port `8080`. It installs the pinned Twenty SDK packages at container startup, exercises local SDK primitives, and serves JSON responses from an embedded Node server.

No database, Redis, Caddy sidecar, model server, GPU device, host bind mount, or external build context is used.

## Environment Variables

No credentials are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `TWENTY_SDK_VERSION` | No | `2.8.0` | Version of the `twenty-sdk` NPM package installed by the verifier at startup. |
| `TWENTY_CLIENT_SDK_VERSION` | No | `2.8.0` | Version of the `twenty-client-sdk` NPM package installed by the verifier at startup. |

The internal HTTP port is fixed at `8080` by the compose file and exposed locally as `8080:8080`.

## Deploy

1. Deploy the `twenty` prebuilt template on Phala Cloud.
2. Keep the default resources for this verifier: 1 vCPU, 2048 MB memory, and 20 GB disk.
3. Leave both package versions pinned to `2.8.0` unless you intentionally want to test another published Twenty SDK release.
4. Open `https://<your-app-domain>/healthz` after startup finishes.

The first start downloads NPM packages from the public registry. Runtime verification is local and deterministic after the packages are installed.

## Exposed Endpoints

- `GET /healthz`: imports Twenty SDK packages, verifies package versions, checks required exports, and returns `200 OK` only when local manifest validation succeeds.
- `GET /demo`: returns the application/object/skill/agent validation results plus deterministic sample CRM data and a local CRM summary. No model/provider call is made.
- `GET /v1/models`: returns an OpenAI-style metadata list with `twenty-sdk-local-verifier`. It is a compatibility endpoint, not an inference API.
- `GET /upstream`: returns upstream repository, docs links, package metadata, and production caveats.
- `GET /`: returns a compact endpoint index.

Example:

```bash
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/upstream
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "credentials_required": false,
  "external_provider_calls": false,
  "model_downloads": false,
  "demo": {
    "sdk_exercise": "defineApplication, defineObject, defineSkill, defineAgent, validateFields, and twenty-client-sdk metadata import"
  }
}
```

## Smoke Verification

Use the smoke checks below to verify the compose file, package imports, and deterministic HTTP responses before publishing the template.

Run these commands from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/twenty/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/twenty/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/upstream
docker compose -f templates/prebuilt/twenty/docker-compose.yml down
```

If local port `8080` is already in use, temporarily change only the host side of the port mapping, for example `18080:8080`, then use `http://localhost:18080/healthz`.

Template validations from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/twenty/docker-compose.yml config >/dev/null
```

## Production Notes

- This template is a no-credential verifier, not a production Twenty CRM deployment.
- For production self-hosting, use the official Twenty Docker Compose stack and set at minimum `SERVER_URL`, `ENCRYPTION_KEY`, and a strong `PG_DATABASE_PASSWORD`.
- Store `ENCRYPTION_KEY` and database credentials in a secrets manager or Phala deployment environment variables. Do not bake real secrets into `docker-compose.yml`.
- The upstream production stack uses persistent volumes for Postgres data and local file storage. Losing the database or encryption key can make stored CRM data or encrypted secrets unrecoverable.
- The full CRM UI normally creates or signs into a workspace in the browser. This verifier intentionally avoids browser auth and returns HTTP-only smoke responses.
- Twenty's AI skills and agents are manifest primitives in this template. Running real AI chat, agent, email, calendar, OAuth, or workflow integrations requires explicit production configuration and provider credentials outside this no-secrets demo.
- Pin package versions for reproducible smoke tests. Test upgrades in a separate deployment before changing the defaults.

## Security Notes

- No secrets are required for the default template.
- Do not put API keys, bearer tokens, private keys, OTPs, database passwords, or encryption keys in the compose file.
- The compose file does not use `env_file`, host bind mounts, privileged mode, host networking, host IPC, Docker socket access, GPU device reservations, or an external build context.
- The HTTP verifier is unauthenticated. Put an access-control layer in front of it if you expose custom private endpoints.

## Upstream Attribution

This template installs and imports packages from Twenty's upstream project:

- Repository: https://github.com/twentyhq/twenty
- Self-hosting docs: https://docs.twenty.com/developers/self-host/capabilities/docker-compose
- Setup/environment docs: https://docs.twenty.com/developers/self-host/capabilities/setup
- App SDK docs: https://docs.twenty.com/developers/extend/apps/getting-started
- NPM package: https://www.npmjs.com/package/twenty-sdk
- Icon: https://github.com/twentyhq/twenty/blob/main/packages/twenty-website/public/images/core/logo.svg
