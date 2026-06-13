# obra/superpowers

Deploy a CPU-safe Superpowers verifier on Phala Cloud.

## Metadata

- Template id: `superpowers`
- Display name: `obra/superpowers`
- Category: AI Agents & Developer Tools
- Upstream repository: https://github.com/obra/superpowers
- Upstream source ref inspected: `6fd4507659784c351abbd2bc264c7162cfd386dc`
- Upstream version inspected: `5.1.0`
- Template repository path: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/superpowers
- Icon source: upstream `assets/superpowers-small.svg` from `obra/superpowers`, referenced by `.codex-plugin/plugin.json` as `interface.composerIcon`, saved as `superpowers.svg`
- Upstream author: Jesse Vincent / `obra`, via the `obra/superpowers` GitHub repository

## Overview

Superpowers is an agentic skills framework and software development methodology for coding agents. The upstream README describes a workflow built around composable skills for brainstorming, implementation planning, test-driven development, systematic debugging, subagent-driven development, code review, and finishing a development branch.

The upstream project is not a standalone inference server or hosted web app. It is a skills/plugin package for agent harnesses such as Claude Code, Codex, Gemini CLI, Cursor, OpenCode, Factory Droid, and GitHub Copilot CLI. The OpenCode docs install it with a git-backed plugin spec:

```json
{
  "plugin": ["superpowers@git+https://github.com/obra/superpowers.git"]
}
```

This Phala template therefore runs a small deterministic HTTP verifier instead of trying to host an interactive coding agent. At startup it installs the real upstream source archive with npm, imports the installed OpenCode plugin, executes the plugin config hook and bootstrap message transform against local fixture data, parses the real `skills/*/SKILL.md` metadata, and exposes JSON endpoints for smoke testing.

The default verifier does not call an LLM provider, does not perform browser authentication, does not download model weights, does not require credentials, and does not start an interactive agent session.

## What This Template Runs

- `app`: Node.js 22 HTTP service listening on container port `8080`.
- The startup command installs `https://github.com/obra/superpowers/archive/6fd4507659784c351abbd2bc264c7162cfd386dc.tar.gz` into `/opt/superpowers-demo`.
- The service verifies the installed `superpowers` package metadata, required skills, agent plugin metadata, and OpenCode plugin behavior locally.

## Deployment Steps

1. Deploy the `superpowers` prebuilt template on Phala Cloud.
2. Keep the default CPU-only resource size for the verifier.
3. Optionally set `SUPERPOWERS_SOURCE_REF` to another upstream commit or tag if you want to inspect a different Superpowers snapshot.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first start downloads the upstream GitHub source archive through npm. After installation, the HTTP endpoints use local files and local JavaScript only.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SUPERPOWERS_SOURCE_REF` | No | `6fd4507659784c351abbd2bc264c7162cfd386dc` | Upstream commit or tag installed from `https://github.com/obra/superpowers/archive/<ref>.tar.gz`. |
| `PORT` | No | `8080` | Internal HTTP port used by the verifier. The compose file publishes `8080:8080`. |

The default verifier does not read provider API keys, browser cookies, private keys, OTPs, passwords, or other secrets. If you adapt this template into a real agent-host deployment, configure any provider credentials only as Phala Cloud deployment-time environment variables or secrets, never in the compose file or README.

## Exposed Endpoints

- `GET /healthz`: Returns `200` when the upstream package, required skills, and OpenCode plugin verifier all load successfully.
- `GET /demo`: Returns a deterministic demo payload showing the real skill metadata and OpenCode plugin hook output. Optional query parameter: `?skill=test-driven-development`.
- `GET /v1/models`: Returns an OpenAI-compatible model-list-shaped response identifying the local verifier. It is metadata only; no model is hosted or called.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS "https://<your-app-domain>/demo?skill=test-driven-development"
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "credentials_required": false,
  "provider_network_calls_performed": false,
  "demo": {
    "what_ran": [
      "Installed the upstream Superpowers source archive with npm.",
      "Parsed real SKILL.md frontmatter from the installed skills directory.",
      "Dynamically imported the installed OpenCode plugin.",
      "Executed the plugin config hook and bootstrap message transform against local fixture data."
    ],
    "selected_skill": {
      "id": "test-driven-development",
      "name": "test-driven-development"
    }
  }
}
```

## Smoke Verification

Use these commands to verify the template locally before publishing:

Run locally from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/superpowers/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/superpowers/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS "http://localhost:8080/demo?skill=test-driven-development"
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/superpowers/docker-compose.yml down
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/superpowers/docker-compose.yml config >/dev/null
```

## Production Notes

- The default service is a verifier for the Superpowers source package, not a multi-user hosted coding agent.
- For real Superpowers usage, install the plugin inside the agent harness you use. The upstream README documents Claude Code, Codex CLI, Codex App, Factory Droid, Gemini CLI, OpenCode, Cursor, and GitHub Copilot CLI installation paths.
- The upstream OpenCode plugin injects bootstrap context and registers the Superpowers skills directory. This verifier exercises those local hooks but does not run OpenCode itself.
- Real coding-agent sessions usually require an agent host, workspace permissions, and provider authentication handled by that host. Keep those credentials outside this template and outside source control.
- The endpoints are unauthenticated. Add authentication or a trusted reverse proxy before exposing any adapted workflow that can run real agent actions or handle user data.
- The compose file intentionally avoids host bind mounts, `env_file`, privileged mode, host networking, host IPC, Docker socket access, GPU devices, real secrets, browser authentication, hosted model calls, and model-weight downloads.

## Cleanup

For a local test run from the parent monorepo worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/superpowers/docker-compose.yml down
```
