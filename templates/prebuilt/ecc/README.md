# affaan-m/ECC

Deploy a CPU-safe ECC package and local catalog verifier on Phala Cloud.

## Metadata

- Template id: `ecc`
- Display name: `affaan-m/ECC`
- Category: AI Apps & Workflows
- Upstream repository: https://github.com/affaan-m/ECC
- Package: `ecc-universal`
- Icon source: `assets/images/ecc-logo.png` from the upstream repository
- Upstream author: Affaan Mustafa, via the `affaan-m/ECC` GitHub repository

## Overview

ECC is a harness-native agent operating system for Claude Code, Codex, OpenCode, Cursor, Gemini, and terminal workflows. It packages skills, hooks, rules, MCP conventions, agents, memory and learning workflows, security guidance, and selective install tooling for agent harness setups.

The upstream project is not a model server and does not provide an official no-secret web service image. This template therefore runs an honest local verifier:

- Installs the real `ecc-universal` npm package at container startup.
- Reads the installed package, manifests, plugin descriptors, Codex/OpenCode surfaces, agents, commands, skills, and rules.
- Runs ECC's own `catalog` and `plan` CLI commands against a temporary container home.
- Exposes deterministic JSON endpoints without installing files into a real Claude/Codex/Cursor user directory.

The default path does not require API keys, browser authentication, model downloads, hosted model calls, GPU access, privileged mode, host networking, host bind mounts, Docker socket access, or an `env_file`.

## Services

- `app`: Node.js HTTP service that installs `ecc-universal`, verifies the local package surface, and exposes smoke-test endpoints.

## Ports

- `8080`: Public HTTP endpoint for health, demo, and model-list checks.

## Environment Variables

No credentials are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `APP_PORT` | No | `8080` | Internal HTTP port used by the verifier service. |
| `ECC_PACKAGE_VERSION` | No | `2.0.0-rc.1` | Published `ecc-universal` package version installed by the verifier at startup. |
| `ECC_DEMO_PROFILE` | No | `minimal` | ECC install profile passed to the dry-plan verifier. |
| `ECC_DEMO_TARGET` | No | `codex` | ECC target harness passed to the dry-plan verifier. |

## Deploy

1. Deploy the `ecc` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Optionally pin `ECC_PACKAGE_VERSION` to another published `ecc-universal` version.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the `ecc-universal` package from npm. The compose command installs with npm audit and funding prompts disabled, and skips package lifecycle scripts so the container only unpacks the published artifact before running the verifier.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the package, CLI entrypoint, manifest files, and expected harness/plugin surfaces are present.
- `GET /demo`: Runs ECC's local `catalog profiles`, `catalog components --family capability`, and `plan --profile <profile> --target <target>` commands, then returns a condensed verifier payload.
- `GET /v1/models`: Returns an OpenAI-style model list identifying the local ECC verifier. This endpoint does not represent a hosted LLM.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

## Smoke Verification

Run locally from the parent worktree:

```bash
docker compose -f templates/prebuilt/ecc/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/ecc/docker-compose.yml down
```

Use these smoke commands to verify that the package installs, the local ECC CLI responds, and the HTTP endpoints return deterministic CPU-only payloads.

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "credentials_required": false,
  "remote_model_calls": false,
  "model_downloaded": false,
  "check": "ECC local catalog and selective-install dry-plan verifier",
  "demo": {
    "profile_ids": ["minimal", "core", "developer", "security", "research", "full"],
    "resolved_plan": {
      "profile_id": "minimal",
      "target": "codex",
      "scaffold_only": true
    }
  }
}
```

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/ecc/docker-compose.yml config >/dev/null
```

## Production Notes

- The verifier endpoints are unauthenticated. Add an authenticated reverse proxy or other access control before exposing internal workflow details in production.
- ECC is normally installed into a local harness profile through the upstream plugin or manual installer. This template intentionally performs only a dry-plan check and does not write to `~/.claude`, `~/.codex`, Cursor, OpenCode, or other user harness directories.
- Follow upstream guidance to choose one install path only. Do not stack plugin and full manual installs in the same harness profile.
- Real agent workflows may use Claude, OpenAI-compatible, Gemini, or other provider credentials through the host harness. Those credentials are outside this template and are not used by the default verifier.
- Pin `ECC_PACKAGE_VERSION` for reproducible deployments. Test upgrades with `/demo` before using the same version in a real harness.
- Keep Phala Cloud deployments free of real secrets in compose files. Use Phala Cloud environment variable configuration for any production credentials added around this verifier.

## Cleanup

For a local test run from the parent worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/ecc/docker-compose.yml down
```
