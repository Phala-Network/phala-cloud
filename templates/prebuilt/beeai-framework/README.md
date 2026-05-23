# i-am-bee/beeai-framework on Phala Cloud

Deploy a credential-free, CPU-safe BeeAI Framework package-load demo on Phala Cloud.

## Metadata

- Template id: `beeai-framework`
- Category: Agent Frameworks & Orchestration
- Upstream repository: https://github.com/i-am-bee/beeai-framework
- Upstream documentation: https://framework.beeai.dev/
- Python package: https://pypi.org/project/beeai-framework/
- TypeScript package: https://www.npmjs.com/package/beeai-framework
- Upstream attribution: BeeAI project / `i-am-bee`; upstream package metadata and legal notices attribute the Python package to IBM Corp. and the TypeScript package to BeeAI a Series of LF Projects, LLC.
- Icon source: `docs/favicon.svg` from the upstream `i-am-bee/beeai-framework` repository.

## What This Template Runs

BeeAI Framework is a toolkit for building agents and multi-agent systems in Python and TypeScript. The upstream examples commonly configure a real LLM provider or local model backend, such as Ollama with a downloaded Granite model.

This Phala template intentionally keeps the default deployment lightweight and deterministic. It starts a small Python HTTP service on `python:3.11-slim-bookworm`, installs the real `beeai-framework` Python package from PyPI, imports framework modules, and exercises local message, memory, prompt-template, and tool primitives.

The default template is a credential-free CPU-safe demo. It does not start external model calls by default, does not configure a BeeAI `ChatModel` backend, does not download model weights, does not require GPU access, and does not require OpenAI, Anthropic, Ollama, Hugging Face, IBM watsonx, or other provider credentials.

## Services

- `app`: Python HTTP demo service exposed on container port `8080`.

## Ports

- `8080`: Public HTTP endpoint for health, deterministic framework demo checks, and an OpenAI-compatible model-list stub.

## Environment Variables

No credentials are required for the default demo.

- `BEEAI_FRAMEWORK_PYTHON_VERSION`: Optional BeeAI Framework Python package version installed at container startup. Default: `0.1.80`.

If you adapt this template to call a real LLM provider, add only the variables required by that provider as Phala Cloud environment variables or secrets. Do not hardcode provider tokens, API keys, private keys, passwords, or model registry credentials in the compose file or README.

## Deploy

1. Deploy the `beeai-framework` template on Phala Cloud.
2. Keep the default CPU-only resources for the package-load smoke test.
3. Optionally set `BEEAI_FRAMEWORK_PYTHON_VERSION` to another published PyPI version.
4. Open `https://<your-app-domain>/healthz` after the first startup completes.

The first startup downloads the pinned BeeAI Framework Python package and dependencies from PyPI. No private models, paid credentials, GPU devices, host bind mounts, host networking, host IPC, privileged mode, Docker socket access, or external build context are required.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the BeeAI Framework package imports and the local smoke test initializes successfully.
- `GET /demo`: Returns package metadata plus a deterministic BeeAI Framework demo result. The demo renders a `PromptTemplate`, stores messages in `UnconstrainedMemory`, and reports the `ThinkTool` schema without running an LLM.
- `GET /v1/models`: Returns an OpenAI-compatible model-list shape with an empty `data` array because this template does not run a model backend by default.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "credential_free": true,
  "external_model_calls": false,
  "model_downloaded": false,
  "model_loaded": false
}
```

## Smoke Verification

Run locally from the repository root:

```bash
docker compose -f templates/prebuilt/beeai-framework/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/beeai-framework/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/beeai-framework/docker-compose.yml down
```

Template validation commands:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/beeai-framework/docker-compose.yml config >/dev/null
```

## Extending To Real Agents

To run real BeeAI agents, replace or extend the demo server with your own application code and configure a model backend supported by BeeAI Framework. For example, upstream examples use `ChatModel.from_name("ollama:granite4:micro")` after Ollama and the selected model are available.

Real agent deployments depend on the selected model and provider. Review provider credentials, model license, memory requirements, disk size, download size, CPU latency, GPU requirements, and network access before deploying. Keep secrets in Phala Cloud environment variables or secret handling, not in source-controlled template files.

## Security Notes

- The default demo exposes unauthenticated health and metadata endpoints. Add authentication before exposing real agent actions, model inference, tools, private data, or provider-backed workflows.
- The container does not request GPU access, privileged mode, host networking, host IPC, host bind mounts, external build contexts, or Docker socket access.
- Pin `BEEAI_FRAMEWORK_PYTHON_VERSION` for reproducible deployments.

## Cleanup

For local Docker Compose testing:

```bash
docker compose -f templates/prebuilt/beeai-framework/docker-compose.yml down
```

The default demo does not create named volumes. In Phala Cloud, delete the deployment when you no longer need the CVM.
