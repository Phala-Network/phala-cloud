# Codex CLI on Phala Cloud

This template deploys a CPU-safe HTTP verifier for the OpenAI Codex CLI. The container installs the real `@openai/codex` npm package at startup, checks that the `codex` command is available, and serves local JSON endpoints for smoke testing.

The default service does not start an interactive coding session, does not call OpenAI or OpenAI-compatible providers, and does not require provider credentials. Real Codex CLI sessions normally need ChatGPT authentication or an OpenAI-compatible API key; this template intentionally limits the default behavior to a deterministic local CLI check so it can boot on small CPU-only Phala CVMs without secrets.

## Metadata

- Template id: `codex`
- Category: AI Agents & Developer Tools
- Upstream repo: `https://github.com/openai/codex`
- Upstream author: `openai`
- Package: `@openai/codex@0.133.0`
- Runtime: `node:22-bookworm-slim`
- Icon source: upstream `.github/codex-cli-splash.png` from `openai/codex`, inspected at commit `7d47056ea42636271ac020b86347fbbef49490aa`

## Services

- `app`: Node.js HTTP service on port `3000`. At startup it runs `npm install --global @openai/codex`, then the service verifies the installed package with `npm list -g @openai/codex --json` and `codex --version`.

## Deploy

From this template directory:

```bash
docker compose config
docker compose up -d
```

On Phala Cloud, deploy the prebuilt template and open the public endpoint on port `3000`.

The first start can take a few minutes because the container installs the pinned Codex CLI npm package. The template does not create persistent volumes and does not require GPU resources.

## Usage

The HTTP API is available on port `3000`.

```bash
curl -fsS http://localhost:3000/healthz | jq
curl -fsS http://localhost:3000/demo | jq
curl -fsS http://localhost:3000/v1/models | jq
```

Endpoints:

- `/healthz`: returns HTTP 200 when the real `@openai/codex` package and `codex` CLI are present. It also reports that provider credentials are not required for health and that no provider network calls were performed.
- `/demo`: runs a fresh local `codex --version` command and returns the result as JSON. This endpoint does not call OpenAI, sub2api, or any other hosted model provider.
- `/v1/models`: returns an OpenAI-compatible model-list-shaped JSON object with a single `codex-cli/local-verifier` metadata entry. It is a verifier/demo response, not a hosted model.

## Verification

Run these smoke checks after deployment:

```bash
docker compose ps
curl -i http://localhost:3000/healthz
curl -fsS http://localhost:3000/healthz | jq '.status, .codex_cli_present, .provider_credentials_required_for_health'
curl -fsS http://localhost:3000/demo | jq '.codex_cli_present, .version_output, .provider_network_calls_performed'
curl -fsS http://localhost:3000/v1/models | jq '.data[0].id'
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `.codex_cli_present` is `true`.
- `.provider_credentials_required_for_health` is `false`.
- `/demo` includes a `version_output` string from `codex --version`.
- `/v1/models` includes `codex-cli/local-verifier`.

## Environment Variables

The default verifier requires no credentials.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `CODEX_PACKAGE_VERSION` | `0.133.0` | No | Pinned `@openai/codex` npm package version installed at container startup. Override only when testing another compatible release. |
| `PORT` | `3000` | No | HTTP port used inside the container and exposed by the compose file. |
| `OPENAI_API_KEY` | unset | No | Optional OpenAI-compatible API key for real Codex CLI sessions if you replace or extend the verifier with an authenticated workflow. The default endpoints do not use this value. |
| `OPENAI_BASE_URL` | unset | No | Optional OpenAI-compatible API base URL for custom provider workflows that support it. The default endpoints only report whether it is configured and do not use the value. |

## Production Usage Notes

This prebuilt template is a readiness and packaging demo for Codex CLI, not a multi-user hosted coding agent. To use Codex for real coding sessions, add your deployment-specific authentication flow and provider configuration, then run Codex commands only in a workspace and permission model appropriate for your workload.

Keep provider credentials as deployment-time environment variables. Do not bake API keys into compose files, images, README files, or source control. If you need an OpenAI-compatible provider, provide `OPENAI_API_KEY` and any base URL or Codex provider configuration required by your chosen runtime.

## Security Notes

- The service publishes only `3000:3000`.
- The template does not use privileged mode, host networking, host IPC, Docker socket mounts, host bind mounts, `env_file`, or external build contexts.
- The default endpoints perform only local package and CLI checks.
- No API keys or default secret values are included.

## Cleanup

```bash
docker compose down
```

No named volumes are created by this template.
