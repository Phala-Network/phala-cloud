# phuryn/pm-skills

Deploy a CPU-safe PM Skills Marketplace source verifier on Phala Cloud.

## Metadata

- Template id: `pm-skills`
- Display name: `phuryn/pm-skills`
- Category: AI Agents & Developer Tools
- Upstream repository: https://github.com/phuryn/pm-skills
- Template repository path: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/pm-skills
- Icon source: derived from the upstream README graphic `.docs/images/pm-brain-pm-skills.webp`, https://github.com/phuryn/pm-skills/blob/main/.docs/images/pm-brain-pm-skills.webp, saved as `pm-skills.png`
- Upstream author: Paweł Huryn / `phuryn`
- Upstream source ref inspected for this template: `d384f0c9eb81fe74656a4f6da168587836939edb`
- Upstream marketplace version inspected: `2.0.0`

## Overview

PM Skills Marketplace is a collection of product-management agent skills, commands, and plugins. The upstream marketplace metadata describes version `2.0.0` as 68 domain-specific skills and 42 chained workflows across 9 PM plugins, covering product discovery, strategy, execution, market research, data analytics, go-to-market, marketing growth, PM utilities, and AI shipping.

The upstream project is not a hosted HTTP service or model server. It is a Claude Code, Claude Cowork, Codex CLI, and general agent-skill marketplace made from Markdown skill and command files plus plugin manifests. The upstream README documents installation through `claude plugin marketplace add phuryn/pm-skills` and `codex plugin marketplace add phuryn/pm-skills`.

This Phala template therefore runs an honest local verifier instead of a fake plugin host:

- Downloads the pinned upstream GitHub source archive at startup.
- Parses the real `.claude-plugin/marketplace.json` file.
- Reads each plugin's `.claude-plugin/plugin.json`, `skills/*/SKILL.md`, and `commands/*.md` files.
- Verifies basic marketplace, manifest, skill frontmatter, and command frontmatter structure.
- Exposes deterministic JSON endpoints for smoke testing.

The default verifier does not invoke Claude Code, Codex, a browser, a model provider, or a hosted API. It does not download model weights and does not require credentials.

## What This Template Runs

- `app`: Python 3.12 HTTP service listening internally on `8000` and published as `8080`.
- The service downloads `https://api.github.com/repos/phuryn/pm-skills/tarball/d384f0c9eb81fe74656a4f6da168587836939edb` into `/tmp`.
- The service validates the upstream marketplace and plugin source tree in memory and returns JSON verification results.
- The service uses `tmpfs` for `/tmp`, drops Linux capabilities, runs as UID/GID `65532`, and requires no persistent storage.

## Deployment Steps

1. Deploy the `pm-skills` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `PM_SKILLS_SOURCE_REF` to another upstream commit, tag, or branch if you want to verify a different source snapshot.
4. Optionally set `PM_SKILLS_DEMO_PLUGIN` to a plugin name such as `pm-execution` or `pm-product-strategy`.
5. Open `https://<your-app-domain>/healthz` after startup completes.

The first health check downloads the source archive from GitHub. No API keys, browser cookies, passwords, OTPs, private keys, or provider tokens are required for the default verifier.

## Environment Variables

These variables are used by the default verifier:

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `APP_PORT` | No | `8000` | Internal HTTP port used by the Python verifier. The compose file publishes `8080:8000`. |
| `PM_SKILLS_SOURCE_REF` | No | `d384f0c9eb81fe74656a4f6da168587836939edb` | Upstream `phuryn/pm-skills` commit, tag, or branch downloaded from the GitHub source archive at startup. |
| `PM_SKILLS_VERIFY_TIMEOUT_SECONDS` | No | `30` | Timeout for the public GitHub source archive download. |
| `PM_SKILLS_DEMO_PLUGIN` | No | `pm-product-discovery` | Default plugin inspected by `/demo` when no `plugin` query parameter is supplied. |

The default verifier does not read or require provider credentials. If you adapt this template into a real Claude Code or Codex workflow host, keep credentials outside the compose file and configure them through the host tool or Phala Cloud environment-variable settings.

## Exposed Endpoints

- `GET /healthz`: Downloads and verifies the upstream source archive. Returns `200` only when the marketplace and plugin metadata pass the local checks.
- `GET /demo`: Returns a deterministic plugin, skill, and command metadata preview. Optional query parameter: `?plugin=<plugin-name>`.
- `GET /v1/models`: Returns an OpenAI-style model list identifying the local verifier. No model is loaded or served.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS "https://<your-app-domain>/demo?plugin=pm-execution"
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "marketplace_version": "2.0.0",
  "totals": {
    "plugins": 9,
    "skills": 68,
    "commands": 42,
    "components": 110
  },
  "selected_plugin": {
    "name": "pm-product-discovery",
    "skill_count": 13,
    "command_count": 5
  },
  "remote_calls": {
    "llm_provider_calls": false,
    "browser_auth": false,
    "model_downloaded": false,
    "model_loaded": false,
    "plugin_host_invoked": false
  }
}
```

## Smoke Verification

Run locally from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/pm-skills/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS "http://localhost:8080/demo?plugin=pm-execution"
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/pm-skills/docker-compose.yml down
```

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/pm-skills/docker-compose.yml config >/dev/null
```

## Production Notes

- This template is a verifier, not the full Claude Code, Claude Cowork, or Codex plugin runtime.
- Real upstream use happens in a supported agent host. Follow the upstream README to add the marketplace and install the PM plugins.
- Codex can install the marketplace and skills, but the upstream README notes that Claude-style slash commands install as files and do not run as Codex slash commands.
- The verifier intentionally avoids LLM calls, provider keys, browser authentication, hosted APIs, model downloads, GPU, host bind mounts, Docker socket access, privileged mode, host networking, host IPC, `env_file`, and external databases.
- The endpoints are unauthenticated. Add authentication or a trusted reverse proxy before exposing an adapted production workflow that can run agent tools or handle private product documents.
- Pin `PM_SKILLS_SOURCE_REF` to a commit for reproducible deployments. Use `/healthz` and `/demo` after changing it.
- Keep real API keys, tokens, private keys, OTPs, passwords, and browser cookies out of the compose file.

## Cleanup

For a local test run from the parent worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/pm-skills/docker-compose.yml down
```
