# stanfordnlp/dspy

Deploy a CPU-safe DSPy package smoke demo on Phala Cloud.

## Metadata

- Template id: `dspy`
- Display name: `stanfordnlp/dspy`
- Category: LLM Observability, Evaluation & Testing
- Upstream repository: https://github.com/stanfordnlp/dspy
- Upstream documentation: https://dspy.ai/
- Python package: `dspy`
- Icon source: DSPy logo referenced by the upstream README, `https://raw.githubusercontent.com/stanfordnlp/dspy/main/docs/docs/static/img/dspy_logo.png`; upstream credits the logo design to Chuyi Zhang
- Upstream author: Stanford NLP, via the `stanfordnlp/dspy` GitHub repository

## What This Template Runs

DSPy is a framework for programming, rather than prompting, language models. It provides Python primitives for signatures, modules, examples, prediction objects, evaluation, and prompt or weight optimization workflows.

This template runs a minimal HTTP service on `python:3.12-slim-bookworm`. At startup it installs the real `dspy` Python package, imports it, and exposes JSON endpoints for Phala smoke tests.

The default `/demo` endpoint exercises DSPy concepts locally by defining a `Signature`, building `Example` objects with `.with_inputs()`, running a small `Module.forward` implementation that returns `Prediction` objects, and checking an exact-match metric. It intentionally avoids `dspy.Predict` and LM-backed optimization calls because those require user-supplied provider configuration. No OpenAI, Anthropic, Ollama, hosted model endpoint, model download, GPU, external database, privileged mode, Docker socket, `env_file`, host bind mount, or provider credential is used by default.

## Services

- `app`: Python HTTP server that installs DSPy and exposes the local deterministic smoke-test API.

## Ports

- `8080`: Public HTTP endpoint for health, demo, and model-list checks.

## Environment Variables

No credentials are required for the default smoke demo.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DSPY_PACKAGE_VERSION` | No | `3.2.1` | Pinned `dspy` package version installed by the demo service at container startup. |

Provider credentials such as OpenAI, Anthropic, or other LiteLLM-compatible settings are intentionally not part of this default template. If you adapt the template for real LM-backed DSPy programs, add those values through your deployment secret mechanism and use neutral documentation placeholders such as `<provider credential placeholder>`.

## Deploy

1. Deploy the `dspy` template on Phala Cloud.
2. Keep the default CPU-only resources for the smoke demo.
3. Optionally set `DSPY_PACKAGE_VERSION` to another published compatible DSPy package version.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads Python wheels from PyPI. The default service is only a no-secret readiness and API smoke demo; full DSPy prompt optimization, retrieval, or production LM programs require provider credentials and LM configuration supplied outside this default compose file.

## Usage Endpoints

- `GET /healthz`: Returns `200` when DSPy imports successfully and the deterministic local DSPy demo metric passes.
- `GET /demo`: Runs the local DSPy primitives demo and returns the signature, examples, predictions, and exact-match metric.
- `GET /v1/models`: Returns a small OpenAI-style model list identifying the local deterministic smoke endpoint. It does not imply that a model is hosted.
- `GET /`: Returns service metadata and available endpoints.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

## Smoke Verification

Run locally from the `sdks/` directory:

```bash
docker compose -f templates/prebuilt/dspy/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/dspy/docker-compose.yml down
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "demo_type": "deterministic local DSPy primitives",
  "llm_provider_calls": false,
  "remote_model_calls": false,
  "model_downloaded": false,
  "model_loaded": false,
  "credentials_required": false,
  "metric": {
    "name": "local exact match",
    "passed": 2,
    "total": 2,
    "ok": true
  }
}
```

Template validation commands from the `sdks/` directory:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/dspy/docker-compose.yml config >/dev/null
```

## Security Notes

- The demo endpoints are unauthenticated. Add an authenticated reverse proxy before adapting this template for private workflows.
- Do not put secrets in the compose file. This template does not need API keys or provider credentials.
- The container does not request GPU access, privileged mode, host networking, host bind mounts, Docker socket access, external databases, or an `env_file`.
- The runtime smoke path is deterministic and local. It does not download model weights or call any local or remote model server.
- Pin `DSPY_PACKAGE_VERSION` for reproducible deployments.

## Caveats

- The default demo is not a full DSPy optimizer or LM application. It validates package installation and local DSPy primitives only.
- Full DSPy workflows that use `dspy.Predict`, optimizers, retrieval, hosted LMs, or tracing integrations need user-supplied provider credentials and runtime configuration outside this no-secret template.
- If you add provider credentials, keep them out of the compose file and Phala template metadata.

## Cleanup

For a local test run from `sdks/`, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/dspy/docker-compose.yml down
```
