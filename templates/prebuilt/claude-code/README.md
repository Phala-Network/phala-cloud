# Claude Code on Phala Cloud

## Overview

Claude Code is Anthropic's agentic coding tool for the terminal. This Phala Cloud template deploys a CPU-safe HTTP verifier for Claude Code rather than a hosted interactive coding session.

The container installs the real `@anthropic-ai/claude-code` npm package, verifies package metadata, runs `claude --version`, and exposes deterministic JSON smoke endpoints. The default service does not start browser authentication, does not call Anthropic or any hosted model provider, does not download models, and does not require GPU resources or credentials.

## Deploy

From this template directory:

```bash
docker compose config
docker compose up -d
```

On Phala Cloud, deploy the prebuilt `claude-code` template and open the public endpoint on port `8080`.

The first startup can take a few minutes because the container downloads the pinned npm package. After startup, the HTTP endpoints perform local package and CLI checks only.

## Configuration / Environment

No environment variable is required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `CLAUDE_CODE_VERSION` | No | `2.1.150` | Published `@anthropic-ai/claude-code` npm package version installed at container startup. |
| `PORT` | No | `8080` | HTTP port used inside the container and exposed by the compose file. |
| `ANTHROPIC_API_KEY` | No | unset | Optional Anthropic API key for real Claude Code use if you replace or extend the verifier. The default `/healthz`, `/demo`, and `/v1/models` endpoints do not use it. |

Claude Code can also be used with Claude account/subscription authentication in an interactive environment. That authentication is only needed for real agent use outside this verifier. Do not place real tokens in this compose file, README, image layers, or source control.

## Usage

The HTTP API listens on port `8080`.

```bash
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
```

Endpoints:

- `GET /healthz`: verifies that the real `@anthropic-ai/claude-code` package is installed, package metadata is readable, and `claude --version` executes locally.
- `GET /demo`: returns the verifier status plus an explanation of what production credentials are needed for real Claude Code agent sessions.
- `GET /v1/models`: returns an OpenAI-compatible model-list-shaped JSON object with a single `claude-code/local-verifier` metadata entry. It is not a hosted model.
- `GET /`: returns the same readiness payload as `/healthz`.

The verifier runs `claude --version` with a sanitized local environment and does not pass provider credentials to that command.

## Smoke / Verification

Run these checks after deployment:

```bash
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/healthz | jq '.status, .checks.package.installed_version, .checks.cli_version_check.version_output'
curl -fsS http://localhost:8080/demo | jq '.demo.what_ran, .hosted_llm_calls_performed, .credentials_required_for_health'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `.checks.package.name` is `@anthropic-ai/claude-code`.
- `.checks.cli_version_check.version_output` contains the Claude Code version from `claude --version`.
- `.credentials_required_for_health` is `false`.
- `.hosted_llm_calls_performed` is `false`.
- `/v1/models` includes `claude-code/local-verifier`.

Local template validation:

```bash
python3 templates/validate.py
docker compose -f templates/prebuilt/claude-code/docker-compose.yml config >/tmp/claude-code-compose-config.out
git diff --check origin/main...HEAD
```

If running from the parent monorepo worktree, prefix the paths with `sdks/`.

## Security Notes

- The service publishes only `8080:8080`.
- The compose file does not use privileged mode, host networking, host IPC, Docker socket mounts, host bind mounts, `env_file`, external build contexts, real secrets, or GPU configuration.
- The default endpoints perform only local npm package metadata checks and `claude --version`.
- Optional credentials are for later manual or customized Claude Code use only. The verifier reports whether `ANTHROPIC_API_KEY` is configured but never returns its value.
- The template sets update and nonessential-traffic disabling environment variables for the verifier process, and the version check uses a sanitized environment.
- Add your own authenticated reverse proxy before exposing any extended workflow that can access private source code or execute commands.

## Upstream Attribution

- Upstream project: https://github.com/anthropics/claude-code
- Upstream documentation: https://code.claude.com/docs/en/overview
- npm package: https://www.npmjs.com/package/@anthropic-ai/claude-code
- Author: `anthropics`
- Icon: official Claude Code docs logo from `https://mintcdn.com/claude-code/c5r9_6tjPMzFdDDT/logo/light.svg`, saved as `templates/icons/claude-code.svg`.

The upstream README currently recommends native installer, Homebrew, WinGet, or Linux package manager installation for normal users and marks npm installation as deprecated. This template uses the published npm package only for a deterministic containerized verifier that can prove the real `claude` CLI package is present without interactive authentication.
