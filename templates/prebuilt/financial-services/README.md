# anthropics/financial-services

Deploy a CPU-safe source verifier for Anthropic's Claude for Financial Services reference repository on Phala Cloud.

## Overview

`anthropics/financial-services` is not a standalone inference server. The upstream repository is a file-based collection of Claude financial-services agents, vertical plugins, skills, slash commands, MCP connector definitions, Microsoft 365 install tooling, and Claude Managed Agent cookbooks for workflows such as pitch books, market research, earnings review, GL reconciliation, KYC screening, valuation review, and month-end close.

This Phala Cloud template runs a deterministic HTTP verifier. At startup it downloads the real upstream GitHub source tarball pinned by `FINANCIAL_SERVICES_REF`, extracts it safely, reads the Claude plugin marketplace, plugin manifests, managed-agent cookbooks, command files, skill files, and MCP connector manifests, then exposes JSON endpoints for smoke testing.

The default deployment does not call Anthropic, does not call any MCP data provider, does not install browser or Microsoft 365 add-ins, does not download model weights, does not require a GPU, and does not require credentials. It is designed to prove that the upstream source artifact is present and structurally usable on a small CPU-only Phala CVM.

## Metadata

- Template id: `financial-services`
- Display name: `anthropics/financial-services`
- Category: AI Apps & Workflows
- Upstream repository: https://github.com/anthropics/financial-services
- Upstream author: `anthropics`
- Inspected upstream commit: `120a31dcede4affa1d771cbf286a63ee331f92a4`
- Runtime image: `python:3.12-slim`
- Icon source: GitHub organization avatar fallback, `https://github.com/anthropics.png`
- Phala prebuilt source: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/financial-services

The upstream README and repository tree were inspected at commit `120a31dcede4affa1d771cbf286a63ee331f92a4`. No upstream logo, icon, favicon, PNG, JPG, SVG, WebP, or ICO asset was present, so this template uses the GitHub owner avatar fallback.

## What This Template Runs

The compose file starts one public service:

- `app`: Python HTTP service on port `8080`. The service downloads `anthropics/financial-services` from GitHub, validates the local source inventory, and serves JSON responses.

The verifier checks:

- Root Claude plugin marketplace manifest exists and lists the expected financial-services plugins.
- Plugin manifests exist for vertical plugins, agent plugins, partner plugins, and the Microsoft 365 install helper.
- Managed-agent cookbook directories include `agent.yaml`, `README.md`, and `steering-examples.json`.
- The source includes real skills, slash commands, and subagent manifests.
- MCP connector manifests are discovered and reported. Their parse status is evidence, not a hard health gate, because the default demo does not contact MCP providers or require partner credentials.

## What This Template Does Not Run

The default verifier does not require or use:

- `ANTHROPIC_API_KEY`
- MCP provider URLs or API keys
- Microsoft Graph, Azure, Office, browser, or Cowork authentication
- Hosted LLM calls
- Local model downloads or model weights
- GPU access
- Host bind mounts
- Docker socket access
- Privileged mode, host networking, or host IPC
- `env_file`
- Real API keys, bearer tokens, private keys, OTPs, or passwords

The only network access needed by the default startup path is downloading the pinned public GitHub source tarball.

## Environment Variables

No secrets are required for the bundled smoke demo.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `FINANCIAL_SERVICES_REF` | No | `120a31dcede4affa1d771cbf286a63ee331f92a4` | Git commit, branch, or tag downloaded from `anthropics/financial-services` at startup. The default pins the inspected upstream commit. |

Real upstream Claude Managed Agent deployments normally require `ANTHROPIC_API_KEY` and may require MCP provider URLs or credentials such as `CAPIQ_MCP_URL`, `DALOOPA_MCP_URL`, `FACTSET_MCP_URL`, or firm-specific connector settings. Those are intentionally not configured or consumed by this no-credential verifier. Add them only if you replace the verifier with a production service that actually calls Claude or external data providers, and provide them through Phala Cloud secrets or deployment-time environment variables.

## Deploy

1. Deploy the `financial-services` prebuilt template on Phala Cloud.
2. Keep the default CPU-only resource profile for the verifier: 1 vCPU, 1024 MB memory, and 10 GB disk.
3. Leave `FINANCIAL_SERVICES_REF` pinned unless you have reviewed another upstream commit, branch, or tag.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads and scans the upstream GitHub source tarball. The repository is file-based and has no build step, so startup should stay lightweight on `tdx.small`.

## Exposed Endpoints

- `GET /healthz`: Returns `200` when the real upstream source artifact was downloaded and required marketplace, plugin, skill, command, and managed-agent checks pass. Returns `503` with check details if the verifier cannot prove readiness.
- `GET /demo`: Returns deterministic local inventory evidence for a sample financial-services workflow. Optional query: `?topic=earnings%20review`.
- `GET /v1/models`: Returns an OpenAI-style compatibility list with one metadata-only id, `financial-services/source-verifier`. It is not a hosted model.
- `GET /upstream`: Returns upstream attribution, source-ref metadata, plugin inventory, managed-agent inventory, MCP connector parse evidence, and safety flags.
- `GET /`: Same readiness payload as `/healthz`.

Example endpoint checks:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS "https://<your-app-domain>/demo?topic=earnings%20review"
curl -fsS https://<your-app-domain>/v1/models
curl -fsS https://<your-app-domain>/upstream
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "mode": "local-deterministic-source-inventory",
  "selected_workflow": "earnings-reviewer",
  "safety": {
    "credentials_required_for_default_demo": false,
    "anthropic_api_calls": false,
    "mcp_provider_calls": false,
    "model_downloads": false
  },
  "evidence": {
    "real_upstream_source_downloaded": true,
    "hosted_model_call_attempted": false
  }
}
```

## Local Smoke And Verify Commands

Use these commands from the parent worktree to validate metadata, verify compose syntax, and check the local HTTP endpoints:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/financial-services/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/financial-services/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/upstream
docker compose -f templates/prebuilt/financial-services/docker-compose.yml down
```

If local port `8080` is already in use, temporarily change only the host side of the mapping in `docker-compose.yml`, for example `18080:8080`, then use `http://localhost:18080/healthz`.

## Production Notes

- The verifier API is unauthenticated. Add an authenticated reverse proxy, token check, or application-level authorization before exposing private workflows, customer data, or firm-specific automation.
- The verifier proves that the upstream source artifact downloads and contains the expected Claude plugin and managed-agent files. It does not install plugins into Cowork, Claude Code, Microsoft 365, or an analyst desktop profile.
- Real managed-agent deployment follows the upstream `managed-agent-cookbooks/` flow and requires Anthropic API access plus any MCP connector credentials needed by your workflow engine.
- Upstream financial-services agents draft analyst work product for human review. They do not make investment recommendations, execute transactions, bind risk, post to ledgers, approve onboarding, or provide legal, tax, accounting, or investment advice.
- MCP providers such as Daloopa, Morningstar, S&P Global, FactSet, Moody's, MT Newswires, Aiera, LSEG, PitchBook, Chronograph, Egnyte, and Box may require subscriptions, authentication, or enterprise data agreements.
- Pin `FINANCIAL_SERVICES_REF` to a reviewed commit for reproducible production deployments.
- The compose file does not use host bind mounts, `env_file`, privileged mode, host networking, host IPC, Docker socket mounts, GPU reservations, external build contexts, or baked-in credentials.

## Upstream Attribution

Claude for Financial Services is developed in the `anthropics/financial-services` repository: https://github.com/anthropics/financial-services.

This template uses the real upstream source tarball for the verifier and saves `templates/icons/financial-services.png` from `https://github.com/anthropics.png` because the inspected upstream README and repository tree did not include a dedicated icon asset.
