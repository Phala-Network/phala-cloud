# langchain-ai/langgraph

Deploy a CPU-safe LangGraph Python state graph demo on Phala Cloud.

## Metadata

- Template id: `langgraph`
- Display name: `langchain-ai/langgraph`
- Category: Agent Frameworks & Orchestration
- Description: Stateful, graph-based agent orchestration; LangGraph Cloud for managed deployment.
- Upstream repository: https://github.com/langchain-ai/langgraph
- Upstream documentation: https://docs.langchain.com/oss/python/langgraph/overview
- Python package: https://pypi.org/project/langgraph/
- Upstream author: `langchain-ai` / LangChain Inc.
- Icon source: `.github/images/logo-light.svg` from the upstream `langchain-ai/langgraph` repository

## What This Template Runs

LangGraph is a low-level orchestration framework for building long-running, stateful agents and workflows. The upstream project is primarily a Python and JavaScript framework, with managed production deployment handled through LangSmith/LangGraph deployment products rather than a single public no-credentials service image.

This Phala Cloud template runs a minimal HTTP demo service on the public `python:3.11-slim-bookworm` image. At startup it installs the real `langgraph` Python package from PyPI, builds a deterministic three-node `StateGraph`, and exposes JSON endpoints that prove the package imports, compiles, and invokes a state graph.

The default demo does not call OpenAI, Anthropic, LangSmith, LangGraph Cloud, Hugging Face, a database, or any external model service. It does not download model weights and does not require credentials.

## Services

- `app`: Python HTTP server that installs `langgraph`, compiles a tiny state graph, and serves health/demo endpoints on container port `8080`.

## Ports

- `8080`: Public HTTP endpoint for readiness checks, deterministic demo execution, and graph metadata.

## Environment Variables

No credentials are required for the default demo.

- `LANGGRAPH_VERSION`: Optional `langgraph` Python package version installed at container startup. Default: `1.2.1`.

Optional credentials such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `LANGSMITH_API_KEY` are only relevant if you extend this template into a real LLM-backed or LangSmith-traced application. Do not add real secrets to the compose file.

## Deploy

1. Deploy the `langgraph` template on Phala Cloud.
2. Use the default resource profile for the CPU-only demo: 2 vCPU, 4096 MB memory, and 40 GB disk.
3. Optionally set `LANGGRAPH_VERSION` to another published PyPI version.
4. Open `https://<your-app-domain>/healthz` after the first startup completes.

The first startup downloads the official Python package from PyPI. No private images, paid credentials, GPU devices, host mounts, privileged container features, or Docker socket access are required.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the `langgraph` package imports and the demo graph can invoke successfully.
- `GET /demo`: Runs the deterministic three-node state graph with the default topic `phala cloud`.
- `GET /demo?topic=confidential%20agents`: Runs the same graph with a custom topic.
- `GET /graph`: Returns a Mermaid representation and node list for the compiled graph.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS "https://<your-app-domain>/demo?topic=confidential%20agents"
curl -fsS https://<your-app-domain>/graph
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "external_model_called": false,
  "credentials_required": false,
  "node_order": ["normalize", "plan", "summarize"]
}
```

## Smoke Verification

Run locally from the repository root:

```bash
docker compose -f templates/prebuilt/langgraph/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/graph
docker compose -f templates/prebuilt/langgraph/docker-compose.yml down
```

Template validation commands:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/langgraph/docker-compose.yml config >/dev/null
```

## Security Notes

- This demo exposes unauthenticated JSON endpoints. Add an authenticated reverse proxy or application auth before exposing real agents, private state, or tool access.
- The default service has no required credentials and does not embed secrets.
- The compose file does not use host bind mounts, `env_file`, privileged mode, host networking, host IPC, Docker socket mounts, external build context, or Compose secrets.
- Pin `LANGGRAPH_VERSION` for reproducible deployments.
- Review model/provider credentials, outbound network needs, data retention, and trace settings before adapting this into a production agent.

## Cleanup

For a local smoke test, stop and remove the demo container with:

```bash
docker compose -f templates/prebuilt/langgraph/docker-compose.yml down
```

For Phala Cloud, delete the deployed app from the Phala Cloud dashboard when you no longer need it. No persistent host volume is created by this template.

## Extending To Real LangGraph Apps

- Replace the inline demo graph with your application graph module and keep `/healthz` lightweight.
- Add model providers only when needed, for example OpenAI with `OPENAI_API_KEY` or Anthropic with `ANTHROPIC_API_KEY`.
- Add LangSmith tracing only when needed with `LANGSMITH_API_KEY` and the relevant LangSmith tracing environment variables.
- For durable execution, persistence, or managed deployment workflows, follow the upstream LangGraph and LangSmith Deployment documentation and provision the required backing services explicitly.
- Keep secrets in Phala Cloud environment variables or a dedicated secret manager, not in `docker-compose.yml` or the README.
