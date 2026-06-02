# 1jehuang/jcode

Deploy a CPU-safe jcode verifier on Phala Cloud.

## Overview

jcode is a coding agent harness for interactive TUI sessions, non-interactive `run` commands, multi-session server/client workflows, provider login flows, model routing, browser automation, and self-development workflows.

This Phala Cloud template does not start a real provider-backed agent session by default. It installs the upstream jcode release binary and runs a small HTTP service that verifies local CLI behavior with `jcode version --json`, `jcode --help`, and `jcode provider list --json`. The default endpoints do not require API keys, start browser OAuth, call hosted model providers, download model weights, or need GPU access.

## Metadata

- Template id: `jcode`
- Display name: `1jehuang/jcode`
- Category: AI Agents & Developer Tools
- Upstream repository: https://github.com/1jehuang/jcode
- Upstream release inspected: `v0.16.0`
- Icon source: upstream `assets/app-icons/Jcode.icns`, converted to `templates/icons/jcode.png`

## What This Template Runs

- `app`: Node.js HTTP verifier on port `8080`.
- Startup command: downloads the upstream Linux release asset for `JCODE_VERSION`, installs it under `/opt/jcode`, then starts `/opt/jcode-demo/server.mjs`.
- Health check: calls `GET /healthz`.

The deployment uses a named volume for the installed jcode binary and a `/tmp` tmpfs for transient home/config directories. It does not use host bind mounts, `env_file`, host networking, host IPC, privileged mode, Docker socket access, browser authentication, GPU access, or model downloads.

## Environment Variables

No environment variable is required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `JCODE_VERSION` | No | `v0.16.0` | Upstream jcode GitHub release tag downloaded at container startup. |

The compose file also sets `JCODE_NO_TELEMETRY=1` and `DO_NOT_TRACK=1` for the verifier. Upstream documents these as telemetry opt-out controls.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `jcode` template.
2. Keep the default `tdx.small`-safe resources for the verifier.
3. Do not add provider API keys for the default smoke deployment.
4. Optionally pin `JCODE_VERSION` to another upstream release tag.
5. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the upstream release archive from GitHub. Subsequent restarts reuse the named volume while `JCODE_VERSION` and the CPU architecture stay the same.

## Exposed Endpoints

- `GET /healthz`: Verifies the upstream jcode binary, version JSON, help text, and provider catalog locally.
- `GET /demo`: Returns the verifier details, local commands executed, and provider catalog summary.
- `GET /v1/models`: Returns an OpenAI-style model list describing the metadata-only local verifier. No LLM is hosted.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Expected fields include:

```json
{
  "ok": true,
  "credentials_required": false,
  "cpu_only": true,
  "remote_model_calls": false,
  "browser_auth_started": false,
  "model_weights_downloaded": false,
  "telemetry_disabled": true
}
```

## Local Verification

Use these commands to verify the compose file and HTTP smoke endpoints.

Run from the `sdks` submodule root:

```bash
docker compose -f templates/prebuilt/jcode/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/jcode/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/jcode/docker-compose.yml down
```

Run from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/jcode/docker-compose.yml config >/dev/null
```

## Production Notes

- The default HTTP service is a verifier, not a full jcode agent server or web UI.
- Real jcode agent sessions normally require provider setup through `jcode login`, OAuth, or API-key environment variables. Store real secrets only in Phala Cloud deployment variables.
- Upstream supports headless login flows such as `jcode login --provider <provider> --no-browser` and scriptable OAuth flows for supported providers, but those flows are intentionally not started by this template.
- Avoid `jcode run`, `jcode auth-test` without `--no-smoke`, and provider model-catalog commands in the default smoke path because they can call model/provider APIs when credentials are present.
- Browser automation requires additional setup outside this verifier and is not enabled by the compose file.
- The default endpoints are unauthenticated status endpoints. Put an authenticated reverse proxy in front of any deployment that exposes private workflow data.

## Upstream Attribution

- Upstream project: https://github.com/1jehuang/jcode
- Author: `1jehuang`
- Release used by default: `v0.16.0`
- Icon: copied from upstream `assets/app-icons/Jcode.icns`, converted to PNG, and saved as `templates/icons/jcode.png`.
