# Continue on Phala Cloud

This template deploys a CPU-safe HTTP verifier for [Continue](https://github.com/continuedev/continue), the open-source AI code assistant for VS Code and JetBrains. The container installs the real `@continuedev/cli` npm package at startup, verifies the `cn` command locally, and serves JSON endpoints for smoke testing.

The default service does not start VS Code, JetBrains IDEs, browser authentication, model downloads, GPU workloads, hosted model calls, or provider-backed coding sessions. It is intentionally limited to deterministic runtime metadata so it can boot on a small CPU-only Phala Cloud CVM without credentials.

## Metadata

- Template id: `continue`
- Category: AI Coding Agents & Developer Tools
- Upstream repo: `https://github.com/continuedev/continue`
- Upstream author: `continuedev`
- Package: `@continuedev/cli@1.5.45`
- Runtime: `node:22-bookworm-slim`
- Icon source: upstream VS Code extension icon at `extensions/vscode/media/icon.png` from `continuedev/continue`, inspected at commit `cb273098d968906d25ee737b454f0b5f13ea2482`

## What Runs in Phala Cloud

- `app`: Node.js HTTP service on port `3000`.
- Startup command: installs `@continuedev/cli` globally with npm, then starts the verifier server.
- Runtime checks: `npm list -g @continuedev/cli --json` and `cn --version`.
- Credentials: none required by the default verifier.

## Deploy

From this template directory:

```bash
docker compose config
docker compose up -d
```

On Phala Cloud, deploy the prebuilt template and expose port `3000`.

The first start can take a few minutes because the container installs the pinned Continue CLI npm package. The template does not create persistent volumes and does not require GPU resources.

## Usage Endpoints

The HTTP API is available on port `3000`.

```bash
curl -fsS http://localhost:3000/healthz | jq
curl -fsS http://localhost:3000/demo | jq
curl -fsS http://localhost:3000/v1/models | jq
```

Endpoints:

- `/healthz`: returns HTTP 200 when the real `@continuedev/cli` package and `cn` CLI are present. It also reports that IDEs, provider credentials, GPU resources, and provider network calls are not required for health.
- `/demo`: runs a fresh local `cn --version` command and returns the result as JSON. This endpoint does not call Continue Hub, OpenAI, Anthropic, Ollama, or any other model provider.
- `/v1/models`: returns an OpenAI-compatible model-list-shaped JSON object with a single `continue-cli/local-verifier` metadata entry. It is a verifier/demo response, not a hosted model endpoint.

## Verification

Run these smoke checks after deployment:

```bash
docker compose ps
curl -i http://localhost:3000/healthz
curl -fsS http://localhost:3000/healthz | jq '.status, .continue_cli_present, .provider_credentials_required_for_health'
curl -fsS http://localhost:3000/demo | jq '.continue_cli_present, .version_output, .provider_network_calls_performed'
curl -fsS http://localhost:3000/v1/models | jq '.data[0].id'
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `.continue_cli_present` is `true`.
- `.provider_credentials_required_for_health` is `false`.
- `/demo` includes a `version_output` string from `cn --version`.
- `/v1/models` includes `continue-cli/local-verifier`.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `CONTINUE_CLI_VERSION` | `1.5.45` | No | Pinned `@continuedev/cli` npm package version installed at container startup. Override only when testing another compatible release. |
| `PORT` | `3000` | No | HTTP port used inside the container and exposed by the compose file. |

For a production Continue workflow that you build on top of this verifier, keep provider credentials as deployment-time secrets or environment variables, for example `OPENAI_API_KEY=<your-provider-api-key>` or `ANTHROPIC_API_KEY=<your-provider-api-key>`. Do not bake real API keys, tokens, private keys, OTPs, or other secrets into compose files, images, README files, or source control.

## Production Caveats

This prebuilt template is a readiness and packaging demo for Continue CLI, not a full hosted Continue IDE extension or multi-user coding agent. Real Continue usage normally depends on an IDE extension, a configured model provider, workspace-specific configuration, and an access-control model appropriate for editing code.

The `/v1/models` response is metadata-only so generic smoke clients can verify the service shape. It does not host a model and does not proxy requests to an external provider. If you extend this template into a real coding service, add authentication, explicit workspace isolation, provider configuration, version pinning, and secret handling suitable for your deployment.

## Security Notes

- The service publishes only `3000:3000`.
- The template does not use privileged mode, host networking, host IPC, Docker socket mounts, host bind mounts, `env_file`, or external build contexts.
- The default endpoints perform only local package and CLI checks.
- No API keys, tokens, private keys, OTPs, or default secret values are included.

## Cleanup

```bash
docker compose down
```

No named volumes are created by this template.
