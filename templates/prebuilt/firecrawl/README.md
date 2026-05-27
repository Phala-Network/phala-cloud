# firecrawl/firecrawl

Deploy a CPU-safe Firecrawl source verifier and demo API on Phala Cloud.

## Metadata

- Template id: `firecrawl`
- Display name: `firecrawl/firecrawl`
- Category: Web Agents & Browser Automation
- Upstream repository: https://github.com/firecrawl/firecrawl
- Phala prebuilt template path: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/firecrawl
- Upstream author: `firecrawl`
- Upstream license: AGPL-3.0
- Icon source: `img/firecrawl_logo.png` copied from the pinned upstream repository

## What This Template Runs

Firecrawl is an open-source web crawling, scraping, search, and extraction project
for AI agents. The upstream production self-hosted stack is intentionally larger
than a conservative `tdx.small` smoke target: it includes a TypeScript API, queue
workers, Redis, RabbitMQ, Postgres, a Playwright browser service, optional proxy and
search settings, optional LLM providers, and several credentials or operational
secrets for real deployments.

This Phala prebuilt template is therefore a CPU-safe verifier/demo template. It
does not start the full production Firecrawl crawler stack by default. Instead, it
runs a small Python stdlib HTTP API on port `8080` that:

- verifies selected pinned public Firecrawl upstream files by URL, size, and
  SHA256 digest;
- exposes deterministic smoke endpoints with no provider credentials;
- describes Firecrawl scrape, crawl, search, and extract use cases without
  performing live crawling;
- avoids browser launch, model downloads, GPU access, privileged mode, Docker
  socket access, host bind mounts, and `env_file` usage.

The upstream pin used by the verifier is:

```text
firecrawl/firecrawl@c5bb852969f7a88ecaf5a213567872bcf0c6a2ea
```

Pinned files checked by `/upstream` are:

- `README.md`
- `SELF_HOST.md`
- `docker-compose.yaml`
- `apps/api/package.json`

## Services

- `app`: Python HTTP verifier service using the `python:3.12-slim-bookworm` image.

## Ports

- `8080`: Public HTTP endpoint for health, demo, model-list, and upstream
  verification checks.

## Environment Variables

No credentials are required for the default smoke path.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `FIRECRAWL_UPSTREAM_TIMEOUT_SECONDS` | No | `5` | Per-file timeout, in seconds, for pinned public upstream file verification. Values are clamped between 1 and 30 seconds. |
| `FIRECRAWL_VERIFY_ON_STARTUP` | No | `true` | When true, verifies pinned upstream files once before the HTTP server starts. Set to `false` to skip startup network checks and use `/upstream?refresh=true` later. |

The compose file also sets fixed internal runtime values `PORT=8080` and
`PYTHONUNBUFFERED=1`.

## Deploy

1. Create a new Phala Cloud deployment from the `firecrawl` prebuilt template.
2. Keep the default `tdx.small`-friendly resources for the smoke demo.
3. Leave the environment variables at their defaults unless you need a shorter or
   longer upstream verification timeout.
4. Deploy the CVM and open `https://<your-app-domain>/healthz`.

The default service makes only bounded requests to pinned public raw GitHub URLs
for upstream verification. If GitHub is temporarily unreachable, the service
reports that status explicitly while keeping the local HTTP API available.

## Usage Endpoints

Health check:

```bash
curl -fsS https://<your-app-domain>/healthz
```

Run the deterministic demo:

```bash
curl -fsS https://<your-app-domain>/demo
```

List the smoke-test model surface:

```bash
curl -fsS https://<your-app-domain>/v1/models
```

Inspect pinned upstream verification details:

```bash
curl -fsS https://<your-app-domain>/upstream
```

Refresh upstream verification explicitly:

```bash
curl -fsS "https://<your-app-domain>/upstream?refresh=true"
```

Expected `/healthz` fields include:

```json
{
  "ok": true,
  "status": "ok",
  "firecrawl": {
    "upstream_repository": "https://github.com/firecrawl/firecrawl",
    "upstream_verification_status": "verified"
  }
}
```

If upstream raw files cannot be reached, `upstream_verification_status` may be
`unreachable` or `partial_unreachable`. If a pinned file's size or digest no longer
matches, the status is `failed`.

Expected `/demo` fields include:

```json
{
  "demo": {
    "ok": true,
    "status": "ok",
    "examples": [
      {
        "operation": "scrape",
        "performed_by_demo": false
      }
    ]
  }
}
```

The `/v1/models` endpoint is compatibility-shaped metadata for Phala smoke
conventions. It does not expose an inference model.

## What The Demo Proves

- The Firecrawl prebuilt template starts on a small CPU-only Phala deployment.
- The HTTP service exposes stable `/healthz`, `/demo`, `/v1/models`, and
  `/upstream` endpoints.
- Selected public files from the upstream Firecrawl repository can be verified
  against pinned SHA256 and size metadata.
- The default deployment requires no API keys, no crawler target URL, no browser
  binaries, no model downloads, and no host-level Docker capabilities.

## Production Stack Caveats

This template is not a drop-in production Firecrawl deployment. The upstream
`docker-compose.yaml` at the pinned commit defines a multi-service crawler stack
with local builds, a Playwright service, queue and database services, higher CPU
and memory limits, extra host mapping, and many optional environment variables for
providers, proxying, search, webhooks, observability, authentication, and admin
access. Those defaults are not appropriate as an unauthenticated `tdx.small` smoke
template.

To adapt this template into a real Firecrawl deployment, start from the upstream
self-hosting documentation, replace local builds with deployment-appropriate
images or build steps, set strong secrets through Phala Cloud environment handling,
size resources for browser and queue workloads, and review network, rate-limit,
robots, and legal requirements for your crawling targets.

Do not place real API keys, database passwords, proxy credentials, webhook secrets,
or admin tokens in `docker-compose.yml` or this README.

## Local Verification

From the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/firecrawl/docker-compose.yml config >/dev/null
```

If Docker is available locally, run the service:

```bash
docker compose -f templates/prebuilt/firecrawl/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/upstream
docker compose -f templates/prebuilt/firecrawl/docker-compose.yml down
```

## Upstream Attribution

- Upstream repository: https://github.com/firecrawl/firecrawl
- Upstream project/site: https://firecrawl.dev
- Upstream organization: https://github.com/firecrawl
- Upstream self-hosting guide: `SELF_HOST.md` in the Firecrawl repository
- Upstream production compose reference: `docker-compose.yaml` in the Firecrawl
  repository
- Icon source: `img/firecrawl_logo.png` from `firecrawl/firecrawl`
- License: AGPL-3.0, per the upstream GitHub repository metadata

The deployable template metadata routes through the Phala prebuilt path while this
README preserves upstream Firecrawl attribution.
