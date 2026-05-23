# microsoft/promptflow

Deploy a CPU-safe Promptflow package smoke demo on Phala Cloud.

## Overview

Promptflow is Microsoft's Python framework and tooling suite for building, testing, evaluating, and deploying LLM application flows. This prebuilt template runs a minimal HTTP API that installs the real `promptflow` Python package, verifies that it imports, and executes a deterministic local Promptflow DAG without provider credentials, model downloads, GPU access, Azure/OpenAI calls, or external databases.

The default demo uses two local Python nodes:

- `normalize_topic`: normalizes the input topic.
- `compose_response`: returns deterministic flow-style output, including a stable hash-derived trace id.

## Metadata

- Template id: `promptflow`
- Display name: `microsoft/promptflow`
- Category: LLM Application Platforms & Low-Code Builders
- Upstream repository: https://github.com/microsoft/promptflow
- Upstream documentation: https://microsoft.github.io/promptflow/
- Python package: `promptflow`
- Icon source: upstream Promptflow docs logo at `scripts/docs/_static/logo.svg`
- Upstream author: Microsoft, via the `microsoft/promptflow` GitHub repository
- Phala prebuilt source: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/promptflow

## Included Services/Endpoints

The compose file starts one public HTTP service:

- `app`: Python 3.11 container based on `ghcr.io/astral-sh/uv:python3.11-bookworm-slim`. On startup it installs `promptflow==$PROMPTFLOW_VERSION`, then serves the demo API on port `8000` inside the container and `8080` publicly.

Endpoints:

- `GET /healthz`: Verifies `promptflow` package metadata and imports `promptflow.core.Flow` and `promptflow.core.tool`.
- `GET /demo`: Executes the bundled Promptflow standard DAG using only local Python code.
- `GET /v1/models`: Returns an OpenAI-compatible empty model-list shape with a `demo` explanation field.
- `GET /`: Same readiness payload as `/healthz`.

## Deployment on Phala Cloud

1. Deploy the `promptflow` prebuilt template on Phala Cloud.
2. Keep the default CPU-only resource profile for the smoke demo.
3. Optionally set `PROMPTFLOW_VERSION` to another published Promptflow package version compatible with Python 3.11.
4. Optionally set `PROMPTFLOW_DEMO_TOPIC` to change the default `/demo` input.
5. After startup completes, open `https://<your-app-domain>/healthz`.

The first startup downloads Python wheels from PyPI. The default compose file does not require or use API keys, LLM provider credentials, model weights, persistent databases, host bind mounts, host networking, privileged mode, or an `env_file`.

## Configuration/Env Vars

No credentials are required for the bundled smoke demo.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PROMPTFLOW_VERSION` | No | `1.18.5` | Promptflow Python package version installed at container startup. |
| `PROMPTFLOW_DEMO_TOPIC` | No | `Phala Cloud prompt orchestration` | Default topic used by `/demo` when no `topic` query parameter is supplied. |

If you adapt this template to call Azure OpenAI, OpenAI, or another provider, pass those credentials through Phala Cloud secrets or environment variables. Do not hard-code real tokens in the compose file or README examples.

## Verification Commands

Replace `<your-app-domain>` with the Phala Cloud public domain for the deployment:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS "https://<your-app-domain>/demo?topic=confidential%20prompt%20flows"
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "credentials_required": false,
  "model_downloaded": false,
  "remote_calls": false,
  "demo": {
    "flow": {
      "kind": "standard_dag",
      "credential_free": true
    },
    "outputs": {
      "remote_calls": false,
      "steps": ["normalize_topic", "compose_response"]
    }
  }
}
```

The `/v1/models` response intentionally has an empty `data` list:

```json
{
  "object": "list",
  "data": [],
  "demo": {
    "message": "This Promptflow template does not host an LLM model."
  }
}
```

## Local Testing

Run from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/promptflow/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/promptflow/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS "http://localhost:8080/demo?topic=local%20Promptflow%20test"
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/promptflow/docker-compose.yml down
```

Equivalent commands from inside the `sdks/` submodule:

```bash
python3 templates/validate.py
docker compose -f templates/prebuilt/promptflow/docker-compose.yml config >/dev/null
```

## Security/Production Notes

- The demo API is unauthenticated. Add an authenticated reverse proxy or application-level auth before using it for private workflows.
- The bundled flow is deterministic and local. It does not call Azure, OpenAI, or any external model provider.
- The compose file does not mount host paths, use `env_file`, request privileged mode, use host networking, mount the Docker socket, or define real credentials.
- `OTEL_SDK_DISABLED=true` and `PF_TRACING_SKIP_LOCAL_SETUP=true` are set so the smoke path stays local and quiet by default.
- Promptflow's upstream documentation currently includes a retirement notice: feature development ended on April 20, 2026, and Microsoft states that Prompt Flow will be fully retired on April 20, 2027. Treat this template as a package compatibility and migration smoke demo rather than a recommendation for new production Promptflow workloads.
- Pin `PROMPTFLOW_VERSION` for reproducible deployments, and review upstream release notes before changing it.

## Upstream Attribution

Promptflow is developed by Microsoft in the `microsoft/promptflow` repository: https://github.com/microsoft/promptflow.

This Phala Cloud prebuilt template preserves upstream attribution in the template metadata and README while routing deployable assets through the Phala prebuilt template path: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/promptflow.

The icon saved as `promptflow.svg` is the upstream Promptflow docs logo from `scripts/docs/_static/logo.svg` in the Microsoft repository.
