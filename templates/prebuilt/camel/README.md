# camel-ai/camel on Phala Cloud

This template runs a CPU-safe CAMEL-AI verifier behind a public HTTP endpoint. The service installs the real `camel-ai` Python package, imports CAMEL framework modules, and exercises local prompt, message, enum, and config primitives without calling any LLM provider.

The default demo does not run model-backed agents, does not download model weights, does not use browser authentication, and does not require provider credentials. Production CAMEL role-playing agents normally need a configured model backend and API keys; this template keeps the default startup path deterministic for small CPU-only Phala CVMs.

## Metadata

- Template id: `camel`
- Display name: `camel-ai/camel`
- Category: Agent Frameworks & Orchestration
- Upstream repo: `https://github.com/camel-ai/camel`
- Upstream documentation: `https://docs.camel-ai.org/`
- Package: `camel-ai==0.2.90`
- Python runtime: `python:3.12` from the `ghcr.io/astral-sh/uv:python3.12-bookworm-slim` image
- Upstream author: `camel-ai`
- Icon source: upstream `misc/favicon.png` from `camel-ai/camel`, inspected at commit `8a75a567001c736c7a8afea8d0e1a35ce92129e7`

## Upstream Shape

CAMEL is a Python framework for communicative agents and multi-agent role-playing. The upstream README installs the package with `pip install camel-ai`, then demonstrates a `ChatAgent` backed by OpenAI and web tools. The upstream installation docs describe `camel-ai`, optional extras such as `web_tools`, `rag`, and `model_platforms`, and environment variables for provider API keys. The upstream Docker guide is an interactive development/runtime container and requires users to populate a `.env` file with their own API keys before running model-backed examples.

Sources inspected:

- `https://github.com/camel-ai/camel`
- `https://docs.camel-ai.org/get_started/installation`
- `https://github.com/camel-ai/camel/blob/master/.container/README.md`

## What This Template Runs

The `app` service starts from a small Python image, installs `camel-ai==$CAMEL_AI_VERSION`, then serves JSON on port `8080`.

The `/demo` endpoint uses these local CAMEL objects:

- `camel.prompts.ai_society.AISocietyPromptTemplateDict`
- `camel.prompts.TextPrompt`
- `camel.messages.BaseMessage`
- `camel.types.RoleType`, `TaskType`, and `OpenAIBackendRole`
- `camel.configs.ChatGPTConfig`

It renders role-playing prompt templates, creates a local three-message transcript, converts messages to OpenAI chat and ShareGPT-shaped formats, and returns a deterministic JSON response. No `ChatAgent.step`, `RolePlaying.step`, model backend request, tool call, web search, browser session, or model download is performed.

## Services

- `app`: Python HTTP server that installs CAMEL-AI and exposes the smoke-test API.

## Ports

- `8080`: Public HTTP endpoint for health, demo, and model-list checks.

## Environment Variables

No credentials are required by the default template.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `CAMEL_AI_VERSION` | No | `0.2.90` | Pinned `camel-ai` package version installed at container startup. Override only when testing another compatible release. |
| `APP_PORT` | No | `8080` | Internal HTTP port. The compose file maps `8080:8080`. |

Provider keys such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `MISTRAL_API_KEY`, `QWEN_API_KEY`, and tool credentials are intentionally not required and are not consumed by the default verifier. Add deployment-time secrets only if you replace this verifier with a real CAMEL application that performs model or tool calls.

## Deploy

Deploy the `camel` template on Phala Cloud with the default CPU-only resources. After startup completes, open the public endpoint on port `8080`.

For a local check from the parent worktree:

```bash
docker compose -f templates/prebuilt/camel/docker-compose.yml config
docker compose -f templates/prebuilt/camel/docker-compose.yml up -d
```

The first start downloads Python wheels from PyPI. The template does not use a persistent volume; it is intended as a deterministic verifier rather than a stateful CAMEL workspace.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the real `camel-ai` package imports and the local framework demo passes.
- `GET /demo`: Runs the deterministic local CAMEL prompt/message verifier. Optional query: `?topic=confidential+agent+workflows`.
- `GET /v1/models`: Returns an OpenAI-shaped model list containing `camel-ai/local-primitives-demo`. It is metadata only; the default template does not host a model.
- `GET /`: Returns service metadata and the endpoint list.

Examples:

```bash
curl -fsS http://localhost:8080/healthz
curl -fsS "http://localhost:8080/demo?topic=multi-agent+role-playing"
curl -fsS http://localhost:8080/v1/models
```

## Smoke Verification

Run these checks after local startup or after deploying on Phala Cloud to verify the service:

```bash
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo | jq '.ok, .llm_provider_calls, .messages.openai_chat_format[0].role'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `/demo` returns `"ok": true`.
- `/demo` returns `"llm_provider_calls": false`.
- `/demo` includes CAMEL-rendered role-playing prompt previews and local message conversions.
- `/v1/models` includes `camel-ai/local-primitives-demo`.

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/camel/docker-compose.yml config >/dev/null
```

## Production Notes

- Real CAMEL agent runs usually require model-provider credentials and a configured model backend. Follow the upstream docs for provider-specific environment variables and install extras such as `camel-ai[web_tools]`, `camel-ai[rag]`, or `camel-ai[model_platforms]` only when your workload needs them.
- The default verifier intentionally avoids `ChatAgent.step`, `RolePlaying.step`, toolkits, web search, browser automation, and model downloads because those paths are not credential-free.
- Add authentication or a private ingress before exposing custom production agent endpoints.
- Pin `CAMEL_AI_VERSION` for reproducible deployments and test upgrades before changing it.
- Keep secrets in Phala deployment environment variables or a proper secret manager. Do not bake API keys, tokens, private keys, OTPs, or passwords into the compose file or README.

## Security Notes

- The container does not request privileged mode, host networking, host IPC, GPU access, host bind mounts, Docker socket access, or an `env_file`.
- No API keys or provider credentials are included.
- The runtime smoke path is deterministic and local.

## Cleanup

For a local test run from the parent worktree:

```bash
docker compose -f templates/prebuilt/camel/docker-compose.yml down
```
