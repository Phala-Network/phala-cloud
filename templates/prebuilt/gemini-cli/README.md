# google-gemini/gemini-cli

Deploy a CPU-safe Gemini CLI verifier on Phala Cloud.

## Overview

Gemini CLI is Google's terminal AI coding agent. This template installs the real `@google/gemini-cli` npm package and exposes a small HTTP service that proves the package metadata and local `gemini --version` command work.

The default smoke path is intentionally local and deterministic. It does not start browser authentication, perform a Google login flow, download models, require GPU access, or call hosted Gemini APIs. The HTTP endpoints are suitable for a `tdx.small` deployment and let Phala Cloud verify the container without requiring credentials.

## Metadata

- Template id: `gemini-cli`
- Display name: `google-gemini/gemini-cli`
- Category: AI Coding Agents & Developer Tools
- Upstream repository: https://github.com/google-gemini/gemini-cli
- npm package: https://www.npmjs.com/package/@google/gemini-cli
- Icon source: upstream `packages/vscode-ide-companion/assets/icon.png` from https://github.com/google-gemini/gemini-cli

## What This Template Runs

- `app`: A Node.js HTTP server on port `8080`.
- Startup command: installs `@google/gemini-cli` with npm, then runs `/server.mjs`.
- Health check: calls `GET /healthz`.

The service uses only a named npm cache volume and a `/tmp` tmpfs. It does not use privileged mode, host bind mounts, an `env_file`, host networking, external build contexts, browser auth, or model provider calls.

## Environment Variables

No environment variable is required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `GEMINI_CLI_VERSION` | No | `0.43.0` | Published `@google/gemini-cli` version installed at container startup. |
| `GEMINI_API_KEY` | No | unset | Optional Gemini API key for users who later run the real interactive CLI. Not used by `/healthz`, `/demo`, or `/v1/models`. |
| `GOOGLE_API_KEY` | No | unset | Optional Google API key alias for users who later run the real interactive CLI. Not used by the default smoke endpoints. |

Set at most the credentials you need for an interactive workflow. Do not put real secrets in the compose file or README.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `gemini-cli` template.
2. Keep the default `tdx.small`-safe resources for the verifier.
3. Leave `GEMINI_API_KEY` and `GOOGLE_API_KEY` empty for the default smoke deployment.
4. Optionally pin `GEMINI_CLI_VERSION` to another published package version.
5. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the npm package. After the HTTP service is ready, all default endpoint checks are local package and process checks.

## Exposed Endpoints

- `GET /healthz`: Verifies package metadata and executes `gemini --version` with a sanitized local environment.
- `GET /demo`: Returns the same verifier status plus a short explanation of the local smoke target.
- `GET /v1/models`: Returns an OpenAI-style model list describing the local verifier. No LLM is loaded.
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

Run from the repository root:

```bash
docker compose -f templates/prebuilt/gemini-cli/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/gemini-cli/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/gemini-cli/docker-compose.yml down
```

Template validation:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
```

## Using The Interactive CLI Later

The HTTP verifier is not an interactive terminal. To use Gemini CLI interactively after deployment, provide `GEMINI_API_KEY` or `GOOGLE_API_KEY` through Phala Cloud environment variables, then open a shell in the container and run `gemini` from a workspace you control.

The template sets `GEMINI_SANDBOX=false` because it does not mount a Docker socket or request nested sandbox privileges. Review the upstream Gemini CLI documentation before enabling advanced workflows.

## Security Notes

- The default endpoints are unauthenticated status endpoints. Add an authenticated reverse proxy before exposing private workflow data.
- The server never prints credential values and does not pass API keys to the `gemini --version` verifier command.
- Optional API keys are for later manual interactive use only. The default endpoints do not call Gemini, Google, or other model providers.
- No GPU, privileged mode, host bind mount, `env_file`, browser login flow, or model download is used.
- Pin `GEMINI_CLI_VERSION` for reproducible deployments.

## Upstream Attribution

- Upstream project: https://github.com/google-gemini/gemini-cli
- Package: `@google/gemini-cli`
- Author: `google-gemini`
- Icon: copied from upstream `packages/vscode-ide-companion/assets/icon.png` and saved as `templates/icons/gemini-cli.png`.
