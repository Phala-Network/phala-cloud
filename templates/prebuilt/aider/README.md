# Aider-AI/aider

Deploy a CPU-safe Aider verifier on Phala Cloud.

## Overview

Aider is an AI pair programming CLI that edits code in your local git repository. This template installs the real `aider-chat` Python package, imports the real `aider` module, and exposes a small HTTP service that proves the local `aider --version` command works.

The default smoke path is intentionally local and deterministic. It does not call OpenAI, Anthropic, Gemini, OpenRouter, DeepSeek, or any other hosted LLM provider. It does not download model weights, require GPU access, mount a host repository, or require provider credentials. The HTTP endpoints are suitable for a `tdx.small` deployment and let Phala Cloud verify the container before you configure Aider for real interactive coding sessions.

## Metadata

- Template id: `aider`
- Display name: `Aider-AI/aider`
- Category: AI Coding Agents & Developer Tools
- Upstream repository: https://github.com/Aider-AI/aider
- Python package: https://pypi.org/project/aider-chat/
- Icon source: upstream `aider/website/assets/logo.svg` from https://github.com/Aider-AI/aider

## What This Template Runs

- `app`: A Python HTTP server on port `8080`.
- Startup command: installs `git`, installs `aider-chat`, then runs `/server.py`.
- Health check: calls `GET /healthz`.

The service uses a named `/workspace` volume and a `/tmp` tmpfs. It does not use privileged mode, host bind mounts, an `env_file`, host networking, external build contexts, browser auth, or model provider calls.

## Environment Variables

No environment variable is required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `AIDER_PACKAGE_VERSION` | No | `0.86.2` | Published `aider-chat` version installed at container startup. |
| `AIDER_MODEL` | No | unset | Optional Aider model name for later manual interactive CLI use. Not used by `/healthz`, `/demo`, or `/v1/models`. |
| `OPENAI_API_KEY` | No | unset | Optional OpenAI-compatible provider API key for later manual Aider sessions. Not used by the default smoke endpoints. |
| `ANTHROPIC_API_KEY` | No | unset | Optional Anthropic API key for later manual Aider sessions. Not used by the default smoke endpoints. |
| `GEMINI_API_KEY` | No | unset | Optional Gemini API key for later manual Aider sessions. Not used by the default smoke endpoints. |
| `OPENROUTER_API_KEY` | No | unset | Optional OpenRouter API key for later manual Aider sessions. Not used by the default smoke endpoints. |

Use placeholders such as `<your-provider-api-key>` when documenting or testing configuration. Do not put real secrets in the compose file, README, or template config. Provider credentials are only needed when you intentionally open a shell and run a real Aider session against a configured model.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `aider` template.
2. Keep the default `tdx.small`-safe resources for the verifier.
3. Leave provider API key variables empty for the default smoke deployment.
4. Optionally pin `AIDER_PACKAGE_VERSION` to another published `aider-chat` release.
5. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup installs system `git` and the Python package. After the HTTP service is ready, all default endpoint checks are local package, import, and process checks.

## Exposed Endpoints

- `GET /healthz`: Verifies package metadata, imports the `aider` module, and executes `aider --version` with a sanitized local environment.
- `GET /demo`: Returns the same verifier status plus a deterministic explanation of what the template checks.
- `GET /v1/models`: Returns an OpenAI-style model list describing the local verifier and noting that provider credentials are not configured by default.
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
  "model_downloaded": false
}
```

## Local Verification

Run from the Phala Cloud repository root:

```bash
docker compose -f templates/prebuilt/aider/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/aider/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/aider/docker-compose.yml down
```

When running from the parent monorepo worktree root, prefix the compose path with `sdks/`:

```bash
docker compose -f templates/prebuilt/aider/docker-compose.yml config >/dev/null
```

Template validation from the parent monorepo worktree root:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
```

## Using Aider Interactively Later

The HTTP verifier is not an interactive terminal and does not mount your host git repository. To use Aider interactively after deployment, create or clone a repository inside the named `/workspace` volume, provide only the provider credentials you need through Phala Cloud environment variables, and open a shell in the container.

Example placeholder configuration:

```bash
export AIDER_MODEL=<provider/model-name>
export OPENAI_API_KEY=<your-provider-api-key>
cd /workspace/<your-repo>
aider --model "$AIDER_MODEL"
```

For Anthropic, Gemini, OpenRouter, DeepSeek, local OpenAI-compatible gateways, or other providers, follow the upstream Aider model configuration docs and set the provider-specific placeholder environment variables through Phala Cloud. The default `/healthz`, `/demo`, and `/v1/models` endpoints do not read or use those credentials.

## Security Notes

- The default endpoints are unauthenticated status endpoints. Add an authenticated reverse proxy before exposing private workflow data.
- The server never prints credential values and does not pass API keys to the `aider --version` verifier command.
- Optional provider API keys are for later manual interactive use only. The default endpoints do not call hosted model providers.
- No GPU, privileged mode, host bind mount, `env_file`, browser login flow, or model download is used.
- Pin `AIDER_PACKAGE_VERSION` for reproducible deployments.

## Upstream Attribution

- Upstream project: https://github.com/Aider-AI/aider
- Package: `aider-chat`
- Author: `Aider-AI`
- Icon: copied from upstream `aider/website/assets/logo.svg` and saved as `templates/icons/aider.svg`.
