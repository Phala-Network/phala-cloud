# ogulcancelik/herdr

Deploy a CPU-safe Herdr CLI verifier on Phala Cloud.

## Overview

Herdr is an agent multiplexer that lives in your terminal. Upstream describes it as a Rust terminal workspace manager with persistent sessions, workspaces, tabs, panes, detach/reattach, agent state awareness, local socket APIs, and direct integrations for tools such as Claude Code, Codex, OpenCode, GitHub Copilot CLI, Hermes, and others.

This Phala Cloud template does not start Herdr's interactive terminal UI by default. It downloads the real upstream Linux release binary, verifies it locally, and exposes deterministic HTTP endpoints for smoke testing. The default verifier does not require credentials, does not start browser authentication, does not call hosted LLM providers, does not download model weights, and does not require GPU resources.

## Metadata

- Template id: `herdr`
- Display name: `ogulcancelik/herdr`
- Category: AI Agents & Developer Tools
- Upstream repository: https://github.com/ogulcancelik/herdr
- Upstream docs: https://herdr.dev/docs/quick-start/
- Upstream release inspected: `v0.6.8`
- Icon source: upstream `assets/logo.svg`, saved as `templates/icons/herdr.svg`
- Upstream author: `ogulcancelik`

## What This Template Runs

- `app`: Python HTTP verifier on port `8080`.
- Startup command: downloads the upstream Linux release asset for `HERDR_VERSION`, verifies the known SHA256 digest for the default release, caches the binary in a named volume, then starts `/opt/herdr-demo/server.py`.
- Health check: calls `GET /healthz`.

The verifier executes only noninteractive local commands:

- `herdr --version`
- `herdr --help`
- `herdr --default-config`
- `herdr session list --json`
- `herdr status`

The deployment uses a named volume for the Herdr binary and a `/tmp` tmpfs for transient home/config directories. It does not use host bind mounts, `env_file`, host networking, host IPC, privileged mode, Docker socket access, browser authentication, GPU access, or model downloads.

## Environment Variables

No environment variable is required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `HERDR_VERSION` | No | `v0.6.8` | Upstream Herdr GitHub release tag downloaded at container startup. |

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `herdr` template.
2. Keep the default `tdx.small`-safe resources for the verifier.
3. Do not add provider API keys for the default smoke deployment.
4. Optionally pin `HERDR_VERSION` to another upstream release tag.
5. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the upstream release binary from GitHub. Subsequent restarts reuse the named volume while `HERDR_VERSION` and the CPU architecture stay the same.

## Exposed Endpoints

- `GET /healthz`: Verifies the upstream Herdr binary, version output, help text, default config, session list JSON, and status command locally.
- `GET /demo`: Returns the verifier details, local commands executed, and safe-default flags.
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
  "hosted_model_calls_performed": false,
  "browser_auth_performed": false,
  "model_weights_downloaded": false,
  "interactive_tui_started": false
}
```

## Local Verification

Run from the parent monorepo worktree:

Use these commands to verify the template metadata, Docker Compose shape, and whitespace before submitting:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/herdr/docker-compose.yml config >/dev/null
```

Optional endpoint smoke test:

```bash
docker compose -f templates/prebuilt/herdr/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/herdr/docker-compose.yml down
```

## Production Notes

- The default HTTP service is a verifier, not the Herdr terminal UI and not a hosted agent runtime.
- Real Herdr usage is normally interactive: SSH into the environment, run `herdr`, create workspaces/tabs/panes, and run your preferred coding agents inside those panes.
- Herdr can keep terminal sessions alive after detach and exposes socket-aware commands for workspaces, tabs, panes, agents, waits, integrations, and named sessions. Those workflows are outside this HTTP verifier.
- Upstream integrations for Claude Code, Codex, OpenCode, GitHub Copilot CLI, Hermes, and other agents may require their own installation, authentication, or provider credentials. Store real secrets only in Phala Cloud deployment variables and never in this compose file.
- The default endpoints are unauthenticated status endpoints. Put an authenticated reverse proxy in front of any deployment that exposes private workflow data or command execution.
- If adapting this template into a real persistent Herdr workspace, keep host bind mounts, Docker socket mounts, privileged mode, host networking, and real secrets out of the template unless a separate production review explicitly approves them.

## Upstream Attribution

- Upstream project: https://github.com/ogulcancelik/herdr
- Project website: https://herdr.dev
- Author: `ogulcancelik`
- Release used by default: `v0.6.8`
- Icon: copied from upstream `assets/logo.svg` and saved as `templates/icons/herdr.svg`.
