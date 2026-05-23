# Trigger.dev

Deploy a CPU-safe Trigger.dev SDK smoke demo on Phala Cloud.

## Metadata

- Template id: `trigger-dev`
- Display name: `Trigger.dev`
- Category: LLM Application Platforms & Low-Code Builders
- Upstream repository: https://github.com/triggerdotdev/trigger.dev
- Upstream documentation: https://trigger.dev/docs
- NPM package: `@trigger.dev/sdk`
- Icon source: Trigger.dev favicon from the upstream repository, `docs/images/favicon.png`
- Upstream author: Trigger.dev, via the `triggerdotdev/trigger.dev` GitHub repository

## What This Template Runs

Trigger.dev is an open-source platform for background tasks, durable AI workflows, queues, retries, schedules, and observability. Trigger.dev Cloud is the managed service for deploying and running those tasks without operating the platform infrastructure yourself.

This Phala template intentionally runs a small HTTP service instead of the full self-hosted Trigger.dev stack. At startup the container installs the real `@trigger.dev/sdk` package, imports it, defines a local SDK task and queue object, and exposes deterministic JSON endpoints for smoke testing.

The demo does not connect to Trigger.dev Cloud, does not run the Trigger.dev webapp or supervisor, does not need an API key, and does not download models. It is intended as a tdx.small-friendly package/runtime verification template.

## Services

- `app`: Node.js HTTP server that installs `@trigger.dev/sdk` and serves the smoke-test API.

## Ports

- `8080`: Public HTTP endpoint for health, demo, and compatibility checks.

## Environment Variables

No credentials are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `TRIGGER_DEV_SDK_VERSION` | No | `4.4.6` | Version of `@trigger.dev/sdk` installed at container startup. |

## Deploy

1. Deploy the `trigger-dev` template on Phala Cloud.
2. Keep the default CPU-only resource settings for the smoke demo.
3. Optionally set `TRIGGER_DEV_SDK_VERSION` to another published compatible SDK version.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the SDK from npm. The HTTP listener is fixed to port `8080`. The template avoids provider credentials, model downloads, GPU access, privileged mode, host networking, host bind mounts, Docker socket access, and `env_file`.

## Usage Endpoints

- `GET /healthz`: Returns `200` with `status: "ok"` when the Node runtime is up and `@trigger.dev/sdk` imports successfully. The response includes package version and SDK export evidence.
- `GET /demo`: Returns a deterministic background-job workflow payload with a local SDK task id, queue metadata, fixed workflow steps, and a fixed result id. It does not trigger a remote run.
- `GET /v1/models`: Returns a small OpenAI-style compatibility model list for common smoke harnesses. No model is loaded.
- `GET /`: Returns the service name and endpoint list.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "credentials_required": false,
  "remote_calls": false,
  "cpu_only": true,
  "workflow": {
    "id": "workflow-demo-001",
    "task_id": "phala-cloud-smoke-job",
    "result": {
      "status": "completed",
      "run_id": "run_demo_0001"
    }
  }
}
```

## Smoke Verification

Run locally from the `sdks/` directory:

```bash
docker compose -f templates/prebuilt/trigger-dev/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/trigger-dev/docker-compose.yml down
```

Template validation commands from the repository root:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/trigger-dev/docker-compose.yml config >/dev/null
```

## Production Caveats

This template is not a full Trigger.dev self-hosted deployment. The official self-hosting path runs multiple platform components and requires production decisions around the webapp, supervisor, PostgreSQL, Redis, registry, object storage, authentication, secrets, backups, monitoring, scaling, and optional ClickHouse-backed event storage.

Use this template to confirm Phala can start a service container, install and import the Trigger.dev SDK, and expose deterministic HTTP endpoints. For real workloads, use Trigger.dev Cloud or follow the official Docker or Kubernetes self-hosting guides and store credentials in Phala-managed environment variables or another secret manager.

## Security Notes

- The demo endpoints are unauthenticated and should not be used to expose private job data.
- Do not put real Trigger.dev access tokens, database URLs, registry passwords, object storage keys, or provider API keys in this compose file.
- No secrets are required for the default demo. Optional production credentials belong in deployment-time environment variables and should be marked non-required unless the service cannot start without them.
- Pin `TRIGGER_DEV_SDK_VERSION` for reproducible package-import checks.

## Cleanup

For a local test run from `sdks/`, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/trigger-dev/docker-compose.yml down
```
