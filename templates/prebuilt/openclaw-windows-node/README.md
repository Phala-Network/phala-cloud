# openclaw/openclaw-windows-node

Deploy a CPU-safe source verifier for the OpenClaw Windows companion suite on Phala Cloud.

## Deploy, Check, Customize

1. Deploy the `openclaw-windows-node` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Open `https://<your-app-domain>/healthz` after startup finishes.
4. Check the source inspection demo with `https://<your-app-domain>/demo`.
5. Optionally set `OPENCLAW_WINDOWS_NODE_REF` to another upstream branch, tag, or commit when you want to verify a different source revision.

The first startup downloads the upstream GitHub source tarball into a named volume, then serves deterministic JSON checks. It does not start the Windows tray app, connect to an OpenClaw gateway, run a local MCP server, call an LLM provider, download model weights, use browser authentication, require a GPU, or need credentials.

## Metadata

- Template id: `openclaw-windows-node`
- Display name: `openclaw/openclaw-windows-node`
- Category: AI Apps & Workflows
- Upstream repository: https://github.com/openclaw/openclaw-windows-node
- Upstream docs inspected: upstream `README.md`, `DEVELOPMENT.md`, `docs/SETUP.md`, `docs/MCP_MODE.md`, and `docs/WINDOWS_NODE_ARCHITECTURE.md`
- Default upstream ref: `4be005707f44f2b77d70e9ad83e2aecb878a5585`
- Icon source: upstream app logo `src/OpenClaw.Tray.WinUI/Assets/Square44x44Logo.targetsize-256_altform-unplated.png`, saved as `templates/icons/openclaw-windows-node.png`
- Upstream author: `openclaw`, via the `openclaw/openclaw-windows-node` GitHub repository

## Overview

`openclaw/openclaw-windows-node` is a Windows companion suite for OpenClaw. The upstream repository contains a WinUI system tray app, shared gateway client libraries, CLI utilities, a Windows node command surface, and a PowerToys/MXC-related build dependency used by the tray output.

The real application is Windows-oriented. Upstream installation and runtime paths expect Windows 10/11, .NET 10, Windows SDK/WinUI support, WebView2, a tray process, optional local MCP over loopback, and OpenClaw gateway pairing or setup-code flows. Those pieces are not honest Linux container workloads.

This Phala Cloud template therefore runs a verifier instead of pretending to launch the desktop suite. At startup it downloads the real upstream source tarball, parses project metadata from the solution and `.csproj` files, reads the root `package.json`, inspects the MCP/node command reference, verifies the upstream icon asset, and exposes HTTP endpoints for smoke checks.

## Services

- `app`: Python HTTP verifier on public port `8080`. It stores the downloaded upstream source in the named volume `openclaw_windows_node_source`.

No database, Caddy sidecar, Docker socket, host bind mount, external build context, privileged mode, host networking, host IPC, GPU device, `env_file`, or secret is used.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `OPENCLAW_WINDOWS_NODE_REF` | No | `4be005707f44f2b77d70e9ad83e2aecb878a5585` | Upstream git branch, tag, or commit downloaded from `openclaw/openclaw-windows-node` at startup. |
| `APP_PORT` | No | `8080` | HTTP port listened on inside the verifier container. The compose file publishes it as `8080:8080`. |

For a real Windows companion deployment, configure gateway URLs, setup codes, local MCP bearer tokens, and OpenClaw device pairing on the Windows host according to upstream documentation. Those operational secrets are intentionally not part of this no-secret Phala verifier.

## Exposed Endpoints

- `GET /healthz`: Downloads or reuses the upstream source and returns `200 OK` when required source files, project metadata, and command references are available.
- `GET /demo`: Returns deterministic source-inspection output: .NET SDK version, solution counts, key project target frameworks, root NPM dependency metadata, and grouped Windows node/MCP commands.
- `GET /v1/models`: Returns an OpenAI-style metadata list with `openclaw-windows-node/source-verifier`. It is a compatibility endpoint, not an inference API.
- `GET /upstream`: Returns upstream links, inspected ref, default verifier behavior, and production caveats.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
curl -fsS https://<your-app-domain>/upstream
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "credentials_required": false,
  "gateway_contacted": false,
  "windows_desktop_started": false,
  "llm_provider_calls": false,
  "model_downloaded": false,
  "demo": {
    "root_package": {
      "name": "openclaw-windows-node-mxc"
    },
    "production_runtime": "Windows 10/11 desktop companion; this Linux container is a verifier only."
  }
}
```

## Local Smoke Verification

Run locally from the parent worktree:

```bash
docker compose -f templates/prebuilt/openclaw-windows-node/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/upstream
docker compose -f templates/prebuilt/openclaw-windows-node/docker-compose.yml down
```

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/openclaw-windows-node/docker-compose.yml config >/dev/null
```

## Production Notes

- This template is a source verifier, not the Windows tray app, not a gateway, and not an MCP server.
- Use the upstream Windows installer or build on Windows for the real WinUI tray, WebView2 canvas, camera, screen, notification, local MCP, and native node capabilities.
- Real OpenClaw operation requires gateway configuration, device pairing, and token/setup-code handling. Add only the credentials needed by your gateway workflow in a custom deployment.
- The verifier never runs `system.run`, never starts the local MCP listener, never invokes Windows device APIs, and never contacts a model provider.
- The root `package.json` dependency on `@microsoft/mxc-sdk` is build support for the Windows tray output. This template reads that metadata from the real source but does not install or execute the Windows desktop build pipeline.
- The demo endpoints are unauthenticated. Add an authenticated gateway before exposing adapted private workflows.
- Pin `OPENCLAW_WINDOWS_NODE_REF` to a commit for reproducible verification.

## Cleanup

For a local test run from the parent worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/openclaw-windows-node/docker-compose.yml down
```
