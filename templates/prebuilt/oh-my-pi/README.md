# can1357/oh-my-pi on Phala Cloud

## Metadata

- Template id: `oh-my-pi`
- Display name: `can1357/oh-my-pi`
- Category: AI Apps & Workflows
- Deployable template repository: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/oh-my-pi
- Upstream repository: https://github.com/can1357/oh-my-pi
- Upstream package: `@oh-my-pi/pi-coding-agent`
- Default package version: `15.6.0`
- Exposed port: `8080`
- Icon source: `assets/icon.svg` from the upstream `can1357/oh-my-pi` repository, saved as `templates/icons/oh-my-pi.svg`.

## Overview

Oh My Pi (`omp`) is an AI coding agent for terminal workflows. The upstream README describes a Bun-based CLI with hash-anchored edits, an optimized tool harness, LSP and debugger integrations, Python and JavaScript evaluation, browser tooling, subagents, review workflows, and many model providers.

This Phala Cloud template intentionally runs a credential-free local verifier instead of a hosted interactive agent. At startup it installs the real published `@oh-my-pi/pi-coding-agent` package with Bun, starts a small HTTP server, and exposes deterministic endpoints that exercise local package and CLI primitives only.

The default verifier does not call model providers, does not use browser authentication, does not download model weights, does not require GPU access, and does not require API keys.

## What This Template Runs

- `app`: `oven/bun:1.3.14-slim`, matching the upstream package requirement of Bun `>=1.3.14`.
- A startup command that installs `@oh-my-pi/pi-coding-agent@$OH_MY_PI_VERSION` into a named volume under `/home/bun/oh-my-pi-app`.
- A Bun HTTP server on port `8080` from the inline compose config.
- A bundled sample Markdown file used by the `omp read` smoke path.

The verifier commands are run with a sanitized environment that omits provider API keys even if optional provider variables are configured for later production use.

## Deployment Steps

Deploy the `oh-my-pi` prebuilt template on Phala Cloud and expose port `8080`.

For a local smoke run from the `sdks/` submodule:

```bash
docker compose -f templates/prebuilt/oh-my-pi/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/oh-my-pi/docker-compose.yml down
```

The first startup downloads the pinned npm package and caches it in named volumes. Changing `OH_MY_PI_VERSION` causes the startup command to reinstall that version.

## Environment Variables

No credentials are required for `/healthz`, `/demo`, or `/v1/models`.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `OH_MY_PI_VERSION` | No | `15.6.0` | Published `@oh-my-pi/pi-coding-agent` version installed by the verifier at container startup. |
| `PORT` | No | `8080` | HTTP port used inside the container. |
| `ANTHROPIC_API_KEY` | No | unset | Optional Anthropic provider key for later real `omp` sessions. The verifier endpoints do not pass it to `omp`. |
| `OPENAI_API_KEY` | No | unset | Optional OpenAI provider key for later real `omp` sessions. The verifier endpoints do not pass it to `omp`. |
| `GEMINI_API_KEY` | No | unset | Optional Google Gemini provider key for later real `omp` sessions. The verifier endpoints do not pass it to `omp`. |
| `OPENROUTER_API_KEY` | No | unset | Optional OpenRouter provider key for later real `omp` sessions. The verifier endpoints do not pass it to `omp`. |

The compose file also sets local, non-interactive runtime defaults such as `PI_NO_TITLE=1`, `PI_NO_PTY=1`, `PI_AUTH_NO_BORROW=1`, `PI_FORCE_IMAGE_PROTOCOL=none`, `PI_PYTHON_SKIP_CHECK=1`, `CI=true`, `NO_COLOR=1`, and isolated Bun/cache paths under `/home/bun`.

## Exposed Endpoints

- `GET /healthz`: checks that the package metadata is present, the requested version marker matches, and `omp --version` runs locally.
- `GET /demo`: runs the health checks plus `omp --smoke-test`, `omp completions bash`, and `omp read /opt/oh-my-pi-demo/sample.md:raw`.
- `GET /v1/models`: returns an OpenAI-compatible model-list-shaped metadata response with `oh-my-pi/local-verifier`. It is not a hosted model and does not proxy an LLM.
- `GET /`: same readiness payload as `/healthz`.

Example verification:

```bash
curl -fsS http://localhost:8080/healthz | jq '.status, .checks.package.installed_version'
curl -fsS http://localhost:8080/demo | jq '.what_ran, .hosted_model_calls_performed, .credentials_required_for_health'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
```

Use `/demo` to verify the local package install and CLI smoke path without provider credentials.

Expected results:

- `/healthz` returns `200 OK` after the package install completes.
- `.checks.package.name` is `@oh-my-pi/pi-coding-agent`.
- `.checks.cli_version.version_output` contains the installed `omp` version.
- `/demo` reports `hosted_model_calls_performed: false`.
- `/demo` reports `provider_credentials_passed_to_verifier_commands: false`.
- `/v1/models` includes `oh-my-pi/local-verifier`.

## Template Validation

Run these from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/oh-my-pi/docker-compose.yml config >/dev/null
```

## Production Notes

This template is a verifier, not a full hosted `omp` terminal session. Real Oh My Pi usage is interactive and can access a workspace, shell tools, model providers, browser tooling, LSP servers, debugger adapters, subagents, and local session state. Treat a production agent endpoint as a privileged code-execution surface.

Before adapting this verifier into a production service:

- Add authentication and network policy before exposing any endpoint that can run arbitrary agent tasks.
- Provide model/provider credentials only through Phala Cloud environment settings or a secret manager. Do not hard-code real API keys, tokens, cookies, private keys, OTPs, or passwords in this compose file, README, image layers, or source control.
- Mount or provision only the workspace data that the agent should be allowed to read and edit.
- Review upstream provider configuration, auth storage, browser, MCP, LSP, debugger, and shell-tool settings for your threat model.
- Pin `OH_MY_PI_VERSION` and review upstream release notes before changing it.

## Security Notes

- The compose file uses named volumes only; it has no host bind mounts, `env_file`, external build context, privileged mode, host networking, host IPC, Docker socket mount, GPU devices, or real secrets.
- The default endpoints run local package and CLI checks only.
- Optional provider credentials are reported only as configured/not configured booleans and are not passed to the verifier commands.
- Browser authentication and hosted model calls are deliberately outside the default smoke path.

## Upstream Attribution

- Upstream project: https://github.com/can1357/oh-my-pi
- Upstream documentation inspected: upstream README install/runtime sections, `docs/models.md`, `docs/environment-variables.md`, `docs/sdk.md`, `Dockerfile`, and `scripts/install.sh`.
- npm package: https://www.npmjs.com/package/@oh-my-pi/pi-coding-agent
- Author: Can Boluk / `can1357`
- Icon: upstream `assets/icon.svg`, copied into this template as `templates/icons/oh-my-pi.svg`.
