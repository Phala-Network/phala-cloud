# revfactory/harness

Deploy a CPU-safe Harness source verifier and deterministic team-blueprint demo on Phala Cloud.

## Metadata

- Template id: `harness`
- Display name: `revfactory/harness`
- Category: AI Agents & Developer Tools
- Upstream repository: https://github.com/revfactory/harness
- Upstream documentation: https://github.com/revfactory/harness/blob/main/docs/quickstart.md
- Icon source: `harness_icon.png` from the upstream repository root, https://github.com/revfactory/harness/blob/main/harness_icon.png
- Upstream author: `revfactory`; plugin manifest author is `robin`
- Upstream source ref inspected for this template: `b8fb858ea9209d6b0d9000e551d3dedbbacb88aa`

## Overview

Harness is a Claude Code plugin and meta-skill that designs domain-specific agent teams, defines specialized agents, and generates the skills they use. The upstream README describes Harness as a team-architecture factory for Claude Code, with six patterns: Pipeline, Fan-out/Fan-in, Expert Pool, Producer-Reviewer, Supervisor, and Hierarchical Delegation.

Harness is not a hosted model server and does not provide an official no-secret HTTP service image. This template therefore runs an honest local verifier:

- Downloads the real upstream source archive from `revfactory/harness` at container startup.
- Reads `.claude-plugin/plugin.json`, `skills/harness/SKILL.md`, the Harness reference files, and docs from that archive.
- Verifies the plugin manifest, skill frontmatter, reference files, and the six documented architecture patterns.
- Exposes deterministic JSON endpoints that preview a small agent-team blueprint without invoking Claude Code, calling a model provider, downloading model weights, using browser authentication, or writing to a real user harness directory.

The default verifier is CPU-only and needs no API keys, GPU, privileged mode, host networking, host bind mounts, Docker socket access, or `env_file`.

## Services

- `app`: Python HTTP service that downloads the upstream Harness source archive and exposes smoke-test endpoints.

## Ports

- `8080`: Public HTTP endpoint for health, demo, and model-list checks.

## Environment Variables

No credentials are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `HARNESS_SOURCE_REF` | No | `b8fb858ea9209d6b0d9000e551d3dedbbacb88aa` | Upstream `revfactory/harness` commit, tag, or branch downloaded from the GitHub source archive at container startup. |
| `HARNESS_DEMO_DOMAIN` | No | `fintech risk-assessment team` | Domain sentence used by the deterministic `/demo` blueprint preview. |

## Deploy

1. Deploy the `harness` template on Phala Cloud.
2. Keep the default CPU-only `tdx.small`-style resources for the verifier.
3. Optionally set `HARNESS_SOURCE_REF` to another upstream commit or tag for a reproducible source check.
4. Optionally set `HARNESS_DEMO_DOMAIN` to preview the deterministic blueprint for another domain.
5. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads a source archive from GitHub. The template only extracts the upstream manifest, skill, references, and docs needed for verification.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the upstream source archive was loaded and the manifest, skill, references, and architecture patterns are present.
- `GET /demo`: Returns a deterministic team-blueprint preview for `HARNESS_DEMO_DOMAIN`, using the upstream Harness source files as the verified input surface.
- `GET /v1/models`: Returns an OpenAI-style model list identifying the local verifier. This endpoint does not represent a hosted LLM.
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
docker compose -f templates/prebuilt/harness/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/harness/docker-compose.yml down
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "credentials_required": false,
  "remote_model_calls": false,
  "model_downloaded": false,
  "claude_code_invoked": false,
  "check": "Harness upstream source verifier and deterministic team-blueprint demo",
  "selected_pattern": "Fan-out/Fan-in",
  "demo": {
    "domain": "fintech risk-assessment team",
    "generated_artifact_preview": {
      "agents_directory": ".claude/agents/",
      "skills_directory": ".claude/skills/",
      "claude_pointer_file": "CLAUDE.md"
    }
  }
}
```

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/harness/docker-compose.yml config >/dev/null
```

Use the smoke commands above to verify the running service after Compose reports the container as healthy.

## Production Notes

- The verifier endpoints are unauthenticated. Add authentication or a private reverse proxy before exposing internal workflow details in production.
- Real Harness use happens in Claude Code, not inside this verifier. Follow the upstream quickstart to install the plugin with `claude plugin marketplace add revfactory/harness` and `claude plugin install harness@harness`.
- Upstream Harness currently depends on Claude Code Agent Teams for full team orchestration. The upstream docs require `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` for generated multi-agent workflows.
- Real Claude Code runs may require Anthropic or other provider credentials through the user's local Claude Code setup. This template does not ask for or use those credentials.
- The `/demo` endpoint is deterministic and local. It previews a small blueprint shape from the verified source files; it does not generate production-ready `.claude/agents/` or `.claude/skills/` files.
- Pin `HARNESS_SOURCE_REF` to a commit or release tag for reproducible deployments. Use `/healthz` and `/demo` after changing it.
- Keep Phala Cloud deployments free of real secrets in compose files. Use Phala Cloud environment variable configuration for any production credentials added around a separate Harness workflow.

## Cleanup

For a local test run from the parent worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/harness/docker-compose.yml down
```
