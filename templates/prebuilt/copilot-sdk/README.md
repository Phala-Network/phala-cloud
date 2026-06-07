# github/copilot-sdk

Deploy a CPU-safe GitHub Copilot SDK verifier on Phala Cloud.

## Metadata

- Template id: `copilot-sdk`
- Display name: `github/copilot-sdk`
- Category: AI Agents & Developer Tools
- Upstream repository: https://github.com/github/copilot-sdk
- Upstream documentation: https://github.com/github/copilot-sdk#readme
- Python package: `github-copilot-sdk`
- Icon source: `copilot-sdk.png` is copied from the upstream repository asset `assets/copilot.png`, which is included in the upstream README asset tree
- Upstream author: GitHub, via the `github/copilot-sdk` GitHub repository

## Overview

GitHub Copilot SDK is a multi-platform SDK for integrating GitHub Copilot Agent into apps and services. The upstream repository publishes SDKs for Node.js/TypeScript, Python, Go, .NET, Java, and Rust. Its documented runtime path communicates with the Copilot CLI server over JSON-RPC.

The upstream docs explain that real Copilot Agent sessions require a GitHub Copilot subscription and authentication through the Copilot CLI, GitHub OAuth/user tokens, environment variables such as `COPILOT_GITHUB_TOKEN`, or BYOK provider credentials. Node.js, Python, and .NET SDKs bundle the Copilot CLI; Go, Java, and Rust require a CLI binary or an external server path.

This Phala Cloud template intentionally does not start Copilot CLI, authenticate with GitHub, open a browser/device flow, call an LLM provider, or download model weights. Instead, it runs a small HTTP verifier on `ghcr.io/astral-sh/uv:python3.12-bookworm-slim`. On startup it installs the real `github-copilot-sdk` Python package from PyPI, imports local SDK primitives, defines and invokes a deterministic typed tool through `define_tool` and `ToolInvocation`, builds isolated/custom tool filters with `ToolSet`, converts a local MCP-style result, and exercises `CopilotClient.on_list_models` without connecting to a runtime server.

The default deployment is an honest CPU-safe SDK verifier for `tdx.small`, not a production Copilot Agent backend.

## Services

- `app`: Python HTTP verifier service exposed internally on port `8000`.
- `proxy`: Caddy reverse proxy exposing the verifier on public port `8080`.

## Port

- `8080`: Public HTTP endpoint for readiness, deterministic SDK demo output, and an OpenAI-compatible model-list shape.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `COPILOT_SDK_PYTHON_VERSION` | No | `1.0.0` | Published `github-copilot-sdk` Python package version installed at container startup. |
| `COPILOT_SDK_DEMO_TOPIC` | No | `Phala Cloud Copilot SDK verifier` | Default topic returned by `/demo` when the request does not pass a `topic` query parameter. |

For real Copilot SDK applications, add the appropriate production credentials in your replacement app only after you choose an auth path. Common upstream options include `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_TOKEN`, GitHub OAuth user tokens, or BYOK model provider keys such as OpenAI, Azure OpenAI, or Anthropic credentials. Do not hardcode tokens in Compose files, README examples, or application source.

## Deploy

1. Deploy the `copilot-sdk` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `COPILOT_SDK_PYTHON_VERSION` to another compatible published package version.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the Python SDK wheel from PyPI. The runtime verifier path is local and deterministic after that install step completes.

## Endpoints

- `GET /healthz`: Returns `200` when the package imports and local SDK checks are ready.
- `GET /`: Same readiness payload as `/healthz`.
- `GET /demo`: Runs the deterministic local SDK verifier using the default topic.
- `GET /demo?topic=<text>&checks=<1-5>`: Runs the verifier with a custom topic and step count.
- `GET /v1/models`: Returns an OpenAI-compatible model-list response describing the local verifier. No model is hosted or called.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS "https://<your-app-domain>/demo?topic=Copilot%20SDK&checks=5"
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "credentials_required": false,
  "copilot_cli_started": false,
  "remote_model_calls": false,
  "model_downloaded": false,
  "default_behavior": {
    "installs_real_python_sdk": true,
    "uses_local_sdk_primitives": true,
    "calls_github_copilot": false,
    "calls_external_llms": false
  },
  "demo": {
    "tool": {
      "name": "copilot_sdk_plan",
      "result": {
        "steps": [
          "import github-copilot-sdk",
          "define a typed local tool with pydantic schema generation"
        ]
      }
    },
    "tool_filters": [
      "builtin:ask_user",
      "builtin:task_complete",
      "builtin:exit_plan_mode",
      "builtin:task",
      "custom:copilot_sdk_plan"
    ]
  }
}
```

## Smoke Verification

Use these commands to verify the Compose file, package import path, local SDK demo, and model-list endpoint.

Run locally from the `sdks/` directory:

```bash
docker compose -f templates/prebuilt/copilot-sdk/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/copilot-sdk/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/copilot-sdk/docker-compose.yml down
```

Template validation commands from the `sdks/` directory:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/copilot-sdk/docker-compose.yml config >/dev/null
```

## Production Notes

- The default service is a local verifier for the Python SDK package and selected SDK primitives. It is not a Copilot Agent inference service.
- Real Copilot SDK sessions start or connect to the Copilot CLI runtime. They can consume Copilot premium requests and require a valid GitHub Copilot subscription unless you use BYOK.
- For GitHub-authenticated server apps, follow the upstream GitHub OAuth, environment variable, backend-service, and multi-tenancy guidance. Do not use interactive browser/device login as a production server auth mechanism.
- For BYOK apps, configure a supported provider such as OpenAI, Azure OpenAI, Anthropic, Ollama, or another OpenAI-compatible endpoint according to the upstream BYOK docs. Store provider keys as Phala Cloud environment variables or secrets.
- Multi-user deployments need explicit per-tenant session storage, token isolation, and lifecycle cleanup. The verifier uses `mode="empty"` only with a local temporary base directory and does not create real sessions.
- Add application-layer authentication before exposing real agent workflows, user data, tool execution, or filesystem/session state.
- The compose file intentionally avoids host bind mounts, `env_file`, privileged mode, host networking, host IPC, Docker socket access, GPU devices, real secrets, browser authentication, hosted model calls, and model-weight downloads.

## Cleanup

For a local test run from the `sdks/` directory, stop and remove the containers with:

```bash
docker compose -f templates/prebuilt/copilot-sdk/docker-compose.yml down
```
