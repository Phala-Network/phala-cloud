# msitarzewski/agency-agents on Phala Cloud

Deploy a CPU-safe, no-credential verifier for The Agency agent pack on Phala Cloud.

## Overview

The upstream `msitarzewski/agency-agents` repository is a large Markdown-based collection of specialist AI agent definitions plus conversion and install scripts for tools such as Claude Code, GitHub Copilot, Antigravity, Gemini CLI, OpenCode, OpenClaw, Cursor, Aider, Windsurf, Kimi Code, Qwen Code, and Codex. It is not an official web server image and it does not ship a standalone runtime service.

This template runs a small HTTP verifier instead. At startup, the app downloads the pinned upstream source archive, verifies expected repository files such as `README.md`, `scripts/install.sh`, `scripts/convert.sh`, and `integrations/README.md`, parses real agent Markdown frontmatter from the upstream source tree, and exposes deterministic JSON endpoints.

The default service does not install agents into user tool directories, does not call an LLM provider, does not require browser auth, does not download model weights, does not use a GPU, and does not need API keys.

## Metadata

- Template id: `agency-agents`
- Display name: `msitarzewski/agency-agents`
- Category: AI Agents & Developer Tools
- Upstream repo: `https://github.com/msitarzewski/agency-agents`
- Upstream author: `msitarzewski`
- Inspected upstream ref: `a077c9ac0be381ec15e7dcbb690f641d6091a5db`
- Phala template repo: `https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/agency-agents`
- Icon source: fallback GitHub owner avatar, `https://github.com/msitarzewski.png`, saved as `agency-agents.jpg`. No upstream logo, icon, favicon, or checked-in image asset was found in the inspected upstream tree.

## Services

- `app`: internal Python HTTP verifier. It downloads the pinned upstream source archive from GitHub, scans Markdown agent definitions, and serves JSON on port `8000`.
- `proxy`: public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

## Deployment Steps

1. Deploy the `agency-agents` prebuilt template on Phala Cloud.
2. Keep the default CPU resources for the verifier.
3. Optionally set `AGENCY_AGENTS_REF` to another branch, tag, or commit only when testing a newer upstream source revision.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the upstream source tarball from GitHub. The verifier reads and indexes that source locally inside the container.

## Environment Variables

No credentials are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `AGENCY_AGENTS_REF` | No | `a077c9ac0be381ec15e7dcbb690f641d6091a5db` | Upstream branch, tag, or commit archive ref downloaded by the verifier. Pin this for reproducible deployments. |
| `AGENCY_AGENTS_SOURCE_TIMEOUT_SECONDS` | No | `60` | Network timeout for downloading the upstream source archive. Values below 10 seconds are raised to 10 seconds by the verifier. |

Provider credentials such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or browser session tokens are intentionally not used by the default template. Configure provider credentials only in your chosen local agent tool if you adapt this into a real production workflow.

## Exposed Endpoints

The public HTTP API is available on port `8080` through Caddy.

- `GET /healthz`: Returns `200 OK` when the pinned upstream source archive was downloaded, required files exist, integration docs are present, and sample agent Markdown frontmatter parsed successfully.
- `GET /demo`: Returns a deterministic handoff-plan demo built from real upstream agent files such as `engineering/engineering-frontend-developer.md`, `marketing/marketing-reddit-community-builder.md`, `design/design-whimsy-injector.md`, and `testing/testing-reality-checker.md`.
- `GET /v1/models`: Returns an OpenAI-shaped model list with `agency-agents/no-llm-roster-index`. This is metadata only; the template does not host or call an LLM.
- `GET /`: Returns service metadata and endpoint names.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

## Smoke Verification

Run these commands from the parent worktree to verify the template locally:

```bash
docker compose -f templates/prebuilt/agency-agents/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/agency-agents/docker-compose.yml down
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "credentials_required": false,
  "llm_provider_calls": false,
  "browser_auth": false,
  "model_downloaded": false
}
```

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/agency-agents/docker-compose.yml config >/dev/null
```

## Production Notes

- The upstream project is a source agent pack and installer toolkit, not a hosted inference server. Use the upstream `scripts/install.sh` and `scripts/convert.sh` workflow to install selected agents into your target local tool.
- The default Phala template is a verifier suitable for smoke tests, demos, and source inspection. It does not execute agent prompts against a model.
- Real agent execution depends on the target tool you install into and that tool's configured model provider. Store those provider credentials outside the compose file.
- The demo endpoints are unauthenticated. Add an authenticated proxy or application-level auth before exposing private source analysis or customized workflows.
- The compose file avoids privileged mode, host networking, host IPC, host bind mounts, Docker socket mounts, `env_file`, real secrets, and model downloads.
- Pin `AGENCY_AGENTS_REF` to a reviewed commit for reproducible deployments.

## Cleanup

For a local test run from the parent worktree:

```bash
docker compose -f templates/prebuilt/agency-agents/docker-compose.yml down
```

No named volumes are created by this template.
