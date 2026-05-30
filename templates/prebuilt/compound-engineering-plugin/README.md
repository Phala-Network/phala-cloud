# EveryInc/compound-engineering-plugin

Deploy a CPU-safe verifier for the official Compound Engineering plugin on Phala Cloud.

## Overview

Compound Engineering is a plugin marketplace and companion CLI for Claude Code, Codex, Cursor, Copilot, Droid, Qwen, OpenCode, Pi, Gemini, Kiro, and related coding-agent environments. The upstream repository ships plugin manifests, skills, agents, and a Bun/TypeScript converter CLI. It is not a standalone hosted inference server.

This Phala Cloud template runs a deterministic HTTP verifier. At startup it installs the real upstream source tarball from GitHub, pinned by `COMPOUND_PLUGIN_REF`, then reads the installed package metadata, plugin manifests, skills, agents, README, and favicon. It does not install the plugin into an IDE profile, does not perform browser or marketplace auth, does not call model providers, does not download model weights, and does not require credentials.

## Metadata

- Template id: `compound-engineering-plugin`
- Display name: `EveryInc/compound-engineering-plugin`
- Category: AI Agents & Developer Tools
- Upstream repository: https://github.com/EveryInc/compound-engineering-plugin
- Upstream package: `@every-env/compound-plugin`
- Inspected upstream commit: `85987d496fdfdc8a18faf592fd53329e23266537`
- Runtime image: `node:22-bookworm-slim`
- Icon source: upstream `favicon.png` at `85987d496fdfdc8a18faf592fd53329e23266537`
- Phala prebuilt source: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/compound-engineering-plugin

## What This Template Runs

The compose file starts one public service:

- `app`: Node.js HTTP server on port `8080`. On startup it installs `https://github.com/EveryInc/compound-engineering-plugin/archive/$COMPOUND_PLUGIN_REF.tar.gz` with npm, then serves local JSON endpoints.

The verifier checks:

- The installed package is named `@every-env/compound-plugin`.
- The package includes the `compound-engineering` plugin.
- Claude, Codex, and Cursor plugin manifests are present and named `compound-engineering`.
- Root marketplace manifests are present.
- The installed package includes real Compound Engineering skills and agent files.
- The upstream favicon is present in the installed source artifact.

## What This Template Does Not Run

The default deployment does not require or use:

- OpenAI, Anthropic, Google, or other model-provider API keys
- Browser login or IDE marketplace authentication
- Hosted LLM calls
- Model downloads or local model weights
- GPU access
- Host bind mounts
- Docker socket access
- Privileged mode or host networking
- `env_file`
- Real API keys, tokens, private keys, OTPs, or passwords

The only network access needed by the default startup path is downloading the pinned upstream GitHub source tarball and npm dependencies.

## Endpoints

- `GET /healthz`: Returns `200` when the real upstream package source artifact installed successfully and required manifests/inventory checks pass.
- `GET /demo`: Returns deterministic local plugin inventory, a sample Compound Engineering workflow, installed package metadata, manifest evidence, and safety flags.
- `GET /v1/models`: Returns an OpenAI-style compatibility list with one metadata-only id, `compound-engineering-plugin/local-verifier`. It does not represent a hosted model.
- `GET /upstream`: Returns upstream attribution, inspected commit, icon source, package metadata, and Phala template link.
- `GET /`: Same readiness payload as `/healthz`.

Example endpoint checks:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS "https://<your-app-domain>/demo?topic=make%20background%20job%20retries%20safer"
curl -fsS https://<your-app-domain>/v1/models
curl -fsS https://<your-app-domain>/upstream
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "mode": "local-deterministic-plugin-inventory",
  "safety": {
    "cpu_only": true,
    "credentials_required": false,
    "model_provider_calls": false,
    "model_downloads": false
  },
  "evidence": {
    "real_package_installed": true,
    "cli_executed": false
  }
}
```

Expected `/v1/models` shape:

```json
{
  "object": "list",
  "data": [
    {
      "id": "compound-engineering-plugin/local-verifier",
      "object": "model",
      "owned_by": "EveryInc"
    }
  ]
}
```

## Environment Variables

No credentials are required for the bundled smoke demo.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `COMPOUND_PLUGIN_REF` | No | `85987d496fdfdc8a18faf592fd53329e23266537` | Upstream Git commit, branch, or tag used to download the source tarball at startup. The default pins the inspected upstream commit. |

Provider keys such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, or IDE session tokens are intentionally not defined or consumed by this verifier. Add secrets only if you replace the verifier with a custom authenticated service that actually needs them.

## Deploy

1. Deploy the `compound-engineering-plugin` prebuilt template on Phala Cloud.
2. Keep the default CPU-only resource profile for the verifier: 1 vCPU, 1024 MB memory, and 10 GB disk.
3. Optionally set `COMPOUND_PLUGIN_REF` to another reviewed upstream commit, branch, or tag.
4. After startup completes, open `https://<your-app-domain>/healthz`.

The first startup may take a few minutes because npm downloads the upstream GitHub tarball and dependencies inside the container.

## Local Smoke Commands

Use these commands to verify the template metadata, compose syntax, and local HTTP smoke endpoints.

Run from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/compound-engineering-plugin/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/compound-engineering-plugin/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/upstream
docker compose -f templates/prebuilt/compound-engineering-plugin/docker-compose.yml down
```

## Production Notes

- The demo API is unauthenticated. Add an authenticated reverse proxy or application-level auth before exposing private workflows or repository-specific automation.
- The verifier proves that the upstream source artifact installs and contains the expected plugin manifests, skills, and agents. It does not prove that Claude Code, Codex, Cursor, or another desktop/CLI agent has installed the plugin in a user profile.
- The upstream CLI is Bun-targeted and is used by the project for converter-backed installs. This verifier intentionally does not run IDE installation commands because those would write profile files and may require local desktop tooling.
- Real Compound Engineering usage normally happens inside the user's coding-agent environment. Follow the upstream README for native Claude Code, Codex, Cursor, Copilot, Droid, Qwen, OpenCode, Pi, Gemini, and Kiro installation flows.
- If you adapt this template into a hosted automation service, add authentication, review outbound network policy, pin `COMPOUND_PLUGIN_REF`, and provide any required provider credentials through Phala Cloud secrets or environment variables. Do not hard-code real tokens in the compose file, README, or application code.
- The compose file does not mount host paths, use `env_file`, request privileged mode, use host networking, mount the Docker socket, or define credentials.

## Upstream Attribution

Compound Engineering is developed in the `EveryInc/compound-engineering-plugin` repository: https://github.com/EveryInc/compound-engineering-plugin.

The plugin manifests identify Kieran Klaassen as the plugin author and Every as the developer. The icon saved as `templates/icons/compound-engineering-plugin.png` is the upstream `favicon.png` from commit `85987d496fdfdc8a18faf592fd53329e23266537`.
