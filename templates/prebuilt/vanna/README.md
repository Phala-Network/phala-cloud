# vanna-ai/vanna

Deploy a CPU-safe Vanna Text-to-SQL/RAG package/runtime demo on Phala Cloud.

## Metadata

- Template id: `vanna`
- Display name: `vanna-ai/vanna`
- Category: RAG (Retrieval-Augmented Generation) Platforms & Engines
- Template repository: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/vanna
- Upstream repository: https://github.com/vanna-ai/vanna
- Upstream status: Archived/read-only by the upstream owner on March 29, 2026
- Upstream owner: Vanna AI
- Upstream license: MIT
- Python package: `vanna==2.0.2` from https://pypi.org/project/vanna/
- Package summary: Generate SQL queries from natural language
- Package Python requirement: `>=3.9`
- Public base image: `python:3.11-slim-bookworm`
- Icon source: `img/vanna2.svg` from the upstream repository, https://raw.githubusercontent.com/vanna-ai/vanna/main/img/vanna2.svg

## What This Template Runs

Vanna is a Python framework for Text-to-SQL and RAG-style workflows over database schemas, documentation, examples, and SQL execution tools. Real Vanna usage normally connects to an LLM provider, a database or warehouse, and sometimes vector stores or other hosted services.

This Phala Cloud template intentionally does not connect to those systems by default. It builds a small HTTP service that installs and imports the real `vanna` Python package, imports Vanna's core request/user models and mock LLM integration, then exposes deterministic JSON endpoints:

- It verifies the `vanna` package can be installed and imported in a CPU-only container.
- It exercises Vanna's own `MockLlmService`, `LlmRequest`, `LlmMessage`, and `User` classes.
- It runs a local Text-to-SQL/RAG-like demo over bundled schema snippets and canned SQL examples.
- It makes no OpenAI, Anthropic, Google, Ollama, database, vector store, model download, GPU, or outbound provider calls.
- It is sized for a `tdx.small` style deployment.

## Services

- `app`: Python HTTP server built from `python:3.11-slim-bookworm`, with inline app code mounted from the Compose `configs` section at `/app/server.py`.

The container installs the package during image build, then runs as a non-root user. `/tmp` is backed by tmpfs for transient scratch data.

## Ports

- `8080`: Public HTTP endpoint for health, demo, and model metadata checks.

## Environment Variables

No credentials are required for this demo.

- `VANNA_PACKAGE_VERSION`: Optional build-time package version for the inline image build. Default: `2.0.2`. Changing it requires rebuilding the image.
- `VANNA_DEMO_TITLE`: Optional label returned by `/healthz` and `/demo`. Default: `Vanna CPU Text-to-SQL demo`.

Provider credentials such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `AZURE_OPENAI_API_KEY`, database passwords, warehouse tokens, vector database API keys, and connection strings are intentionally not wired into this demo service. Add them only when extending the template for real Vanna usage, and keep them outside this template directory in Phala Cloud environment variables or secrets.

## Deploy

1. Deploy the `vanna` template on Phala Cloud.
2. Keep the default CPU-only resources for the demo.
3. Do not add provider or database credentials unless you are modifying the template to run real Vanna workflows.
4. Open `https://<your-app-domain>/healthz` after the image build and first startup complete.

The first deployment builds the image and installs the pinned `vanna` package from PyPI. No private data, model weights, GPU devices, host bind mounts, privileged mode, Docker socket, host networking, external database, vector store, or hosted LLM provider are required.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the `vanna` package and demo components import successfully.
- `GET /demo`: Runs the deterministic local schema retrieval and SQL selection demo with the default question.
- `GET /demo?q=show%20open%20tickets%20by%20priority`: Runs the same deterministic demo with a custom question string.
- `GET /v1/models`: Returns OpenAI-style model metadata for the local demo endpoint.
- `GET /`: Same readiness payload as `/healthz`.

Examples:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS "https://<your-app-domain>/demo?q=Which%20plans%20generated%20the%20most%20revenue"
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "external_calls": false,
  "credentials_used": false,
  "demo": {
    "generated_sql": "SELECT c.plan, SUM(o.total_usd) AS revenue_usd FROM customers c JOIN orders o ON o.customer_id = c.customer_id GROUP BY c.plan ORDER BY revenue_usd DESC;",
    "llm_provider": "none",
    "database": "none",
    "model_downloaded": false,
    "gpu_required": false
  }
}
```

## Smoke Verification

Run locally from the `sdks/` repository root:

```bash
docker compose -f templates/prebuilt/vanna/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/vanna/docker-compose.yml up -d --build
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS "http://127.0.0.1:8080/demo?q=show%20open%20tickets%20by%20priority"
curl -fsS http://127.0.0.1:8080/v1/models
docker compose -f templates/prebuilt/vanna/docker-compose.yml down --remove-orphans
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/vanna/docker-compose.yml config >/dev/null
```

## Extending For Real Vanna Usage

Use this template as a package/runtime smoke test, not as a production Text-to-SQL service.

For real Vanna usage:

1. Choose and configure an LLM provider integration such as OpenAI, Anthropic, Google, Azure OpenAI, Ollama, or another supported backend.
2. Connect to your database or warehouse through a reviewed SQL runner with least-privilege credentials.
3. Add schema documentation, DDL, example questions, and SQL examples from your own data model.
4. Store provider keys, database passwords, connection strings, and vector store credentials as Phala Cloud environment variables or secrets.
5. Add authentication before exposing query, SQL generation, or SQL execution endpoints to users.
6. Review generated SQL, query cost, row-level permissions, prompt-injection risks, and data retention before allowing execution against private data.

Do not put real API keys, database URLs with passwords, private schemas, training data, or generated secrets in this template directory.

## Security Notes

- The demo exposes unauthenticated JSON endpoints. Add authentication or an authenticated reverse proxy before exposing private data, SQL generation, SQL execution, provider-backed chat, or database-backed workflows.
- The container does not request GPU access, privileged mode, host networking, host IPC, host bind mounts, external databases, vector stores, or Docker socket access.
- The service process runs as a non-root user, and `/tmp` is backed by tmpfs for transient scratch data.
- The demo does not consume provider or database credentials even if they are present in the surrounding environment.
- Review upstream Vanna documentation, provider terms, database permissions, SQL execution controls, data retention, and model cost before adapting this into a real Text-to-SQL service.

## Cleanup

Local cleanup:

```bash
docker compose -f templates/prebuilt/vanna/docker-compose.yml down --remove-orphans
docker image rm phala-vanna-demo:2.0.2
```

On Phala Cloud, stop or delete the deployment when the demo is no longer needed. Remove any provider or database credentials you added while experimenting with real Vanna workflows.
