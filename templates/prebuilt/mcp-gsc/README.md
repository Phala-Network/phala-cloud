# AminForou/mcp-gsc

## Overview

Google Search Console MCP server for SEO analytics, URL inspection, indexing, and sitemap management.

This Phala Cloud template runs a CPU-only, credential-free HTTP verifier for the real upstream Python server. It installs `mcp-search-console` version `0.4.1` from the SHA-256-checked source archive at commit `d49eea9e5efb5eb645b722249303179b2c150b49`, with MCP SDK `1.30.0`, and imports `gsc_server`. It discovers the 21 registered MCP tools and exercises the upstream `_rich_results_summary` helper on three synthetic URL-inspection fixtures: a product with an issue, valid breadcrumbs, and absent rich results.

The verifier makes no Google API or model-provider calls, opens no browser authentication flow, and downloads no model weights. Its HTTP responses contain local verification results and tool schemas. Live SEO data and MCP tool invocation require a separate production setup. `/v1/models` returns an empty list because this service hosts no models.

- Template ID: `mcp-gsc`
- Category: SEO & Analytics
- Upstream repository and author: [AminForou/mcp-gsc](https://github.com/AminForou/mcp-gsc), by Amin Foroutan (MIT license).
- Reviewed runtime documentation: [README](https://github.com/AminForou/mcp-gsc/blob/d49eea9e5efb5eb645b722249303179b2c150b49/README.md), including Google credential setup and Remote Deployment & Docker; [Dockerfile](https://github.com/AminForou/mcp-gsc/blob/d49eea9e5efb5eb645b722249303179b2c150b49/Dockerfile); [package metadata](https://github.com/AminForou/mcp-gsc/blob/d49eea9e5efb5eb645b722249303179b2c150b49/pyproject.toml).
- Icon source: upstream [`assets/logo.png`](https://raw.githubusercontent.com/AminForou/mcp-gsc/d49eea9e5efb5eb645b722249303179b2c150b49/assets/logo.png), copied unchanged to `templates/icons/mcp-gsc.png`.

## Deploy on Phala Cloud

1. Select the `mcp-gsc` prebuilt template, or paste this directory's `docker-compose.yml` into a new Phala Cloud deployment.
2. Use `tdx.small` or a CPU instance with at least 1 vCPU, 1 GiB RAM, and 10 GB disk. No GPU or credentials are required.
3. Deploy with the default environment. Startup downloads the source archive from GitHub and dependencies from PyPI; allow up to five minutes for installation and readiness checks.
4. Open the Phala HTTPS endpoint that routes to container port **8080**, then request `/healthz` and `/demo`.

One Python 3.13 service publishes `8080:8080`. The inline Compose config supplies the verifier code. It needs no bind mounts, build context, external configuration files, or persistent volumes.

## Environment variables

There are no required or user-configurable variables for this verifier (`envs: []` in the catalog). Compose fixes the following internal values:

| Variable | Value | Purpose |
| --- | --- | --- |
| `GSC_SKIP_OAUTH` | `true` | Skip upstream OAuth selection; the verifier never calls authentication tools. |
| `GSC_ALLOW_DESTRUCTIVE` | `false` | Keep upstream destructive operations disabled. |
| `GSC_CONFIG_DIR` | `/tmp/mcp-gsc` | Writable, ephemeral directory created during upstream import. |
| `PYTHONUNBUFFERED` | `1` | Stream startup logs. |
| `PIP_DISABLE_PIP_VERSION_CHECK` | `1` | Disable pip update checks. |

The default startup and endpoints do not accept or use Google credentials. The production-only credential paths described below belong to a separately configured upstream deployment.

## Exposed endpoints

| Endpoint | Response |
| --- | --- |
| `GET /` | Verifier mode, upstream link, and endpoint index. |
| `GET /healthz` | `status: "ok"`, package version, source revision, `tool_count: 21`, and local verification status. |
| `GET /demo` | Synthetic inspection fixtures and their actual upstream rich-result summaries, including the missing `offers` issue. |
| `GET /tools` | Tool names, descriptions, and schemas obtained from the upstream FastMCP registry; `invocation_enabled: false`. |
| `GET /v1/models` | `{"object":"list","data":[]}`. |

The server binds only after the package version, tool discovery, and all three parser outputs pass startup checks. Unknown routes return JSON with HTTP 404. `/mcp`, SSE, tool execution, and chat completion routes are outside this verifier's interface.

## Smoke verification

Run these commands from the **parent monorepo worktree**:

```bash
python sdks/templates/validate.py
git -C sdks diff --check origin/main...HEAD
git -C sdks diff --check
docker compose -f sdks/templates/prebuilt/mcp-gsc/docker-compose.yml config >/dev/null
docker compose -f sdks/templates/prebuilt/mcp-gsc/docker-compose.yml up -d --wait --wait-timeout 300

curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/tools
curl -fsS http://localhost:8080/v1/models

curl -fsS http://localhost:8080/healthz | python -c 'import json,sys; d=json.load(sys.stdin); assert d["status"] == "ok" and d["tool_count"] == 21 and d["local_checks_passed"]'
curl -fsS http://localhost:8080/demo | python -c 'import json,sys; d=json.load(sys.stdin); assert d["synthetic_data"] and not d["google_api_calls"]; assert d["cases"][0]["output"]["issues"][0]["message"] == "Missing field \"offers\""'
curl -fsS http://localhost:8080/v1/models | python -c 'import json,sys; assert json.load(sys.stdin) == {"object":"list","data":[]}'

docker compose -f sdks/templates/prebuilt/mcp-gsc/docker-compose.yml down
```

For Phala Cloud, replace `http://localhost:8080` with the HTTPS URL assigned to port 8080. Use `docker compose -f sdks/templates/prebuilt/mcp-gsc/docker-compose.yml logs app` to diagnose startup installation failures.

## Production notes

- Upstream documents a local stdio server and a Docker source build with SSE transport. Its README supplies no official prebuilt image that provides useful live Search Console access without Google credentials. This template therefore verifies the real source and local parser on a small CPU instance.
- For live SEO operations, follow upstream's Google Cloud setup: enable the Search Console API, create a service account, and grant that account access to the relevant Search Console property. In a separate production Compose configuration, provision its JSON key securely inside the container and set **`GSC_CREDENTIALS_PATH=/run/secrets/gsc-service-account.json`** (placeholder path, **required for service-account mode**), with `GSC_SKIP_OAUTH=true`. A path alone does not supply the key. Use Phala secrets and a container-local secret file or named volume; keep credential contents out of Compose, source control, and public responses. Add `GSC_CREDENTIALS_PATH` with `required: true` to that production template's `envs` metadata.
- Upstream also supports `GSC_OAUTH_CLIENT_SECRETS_FILE=/run/secrets/gsc-oauth-client.json` (placeholder path, required for OAuth mode). This entails browser sign-in and token persistence; use the documented local client workflow for OAuth. The bundled verifier does not run it.
- The upstream entry point is `mcp-search-console` or `python gsc_server.py`. For a separately secured remote deployment, use `MCP_TRANSPORT=sse`, `MCP_HOST=0.0.0.0`, and `MCP_PORT=3001`. Add TLS, authentication, and access controls before exposing private Search Console data; SSE transport alone provides no authentication. Keep `GSC_ALLOW_DESTRUCTIVE=false` unless site/sitemap modification has been explicitly authorized.
- The public demo serves synthetic data only and proves local import/parser behavior. It does not establish Google account connectivity, property access, indexing status, or API quota availability.
- Source and MCP SDK versions are pinned; other transitive dependencies and the Python base image tag can receive updates. Startup needs GitHub/PyPI access on each restart. For production, build and audit an immutable image with a complete dependency lock, and recheck the private `_rich_results_summary` helper before upgrading the upstream revision.
