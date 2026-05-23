# pathwaycom/llm-app

Deploy a CPU-safe Pathway AI Pipelines verifier on Phala Cloud.

## Metadata

- Template id: `llm-app`
- Display name: `pathwaycom/llm-app`
- Category: RAG (Retrieval-Augmented Generation) Platforms & Engines
- Template repository: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/llm-app
- Upstream repository: https://github.com/pathwaycom/llm-app
- Upstream owner: `pathwaycom`
- Upstream license: MIT
- Public base image: `python:3.11-slim-bookworm`
- Runtime package verified by this template: `pathway==0.30.1` by default
- Icon source: `templates/question_answering_rag/ui/static/pathway-logo-black.png` from the upstream repository.

## What This Template Runs

`pathwaycom/llm-app` is Pathway's collection of ready-to-run AI Pipeline templates for RAG, enterprise search, live document indexing, adaptive RAG, multimodal RAG, private RAG, and SQL question answering. The upstream templates use Pathway for live data synchronization and built-in indexing over sources such as file systems, Google Drive, SharePoint, S3, Kafka, PostgreSQL, and real-time APIs.

This Phala template intentionally runs a small verifier/demo, not the full upstream production stack.

The verifier:

- Installs and imports the real `pathway` Python package.
- Serves deterministic JSON endpoints over HTTP.
- Runs a local RAG-style retrieval demo over a bundled set of upstream llm-app facts.
- Uses no GPU, model downloads, external vector database, host bind mounts, provider credentials, or private data.
- Fits a `tdx.small` style CPU-only deployment.

The full upstream question-answering, multimodal, private RAG, and connector-backed templates require additional configuration such as documents, provider credentials, model runtimes, local data/cache paths, or heavier parsing dependencies. Those are documented below as production extension notes.

## Architecture

- `app`: a Python HTTP service built inline from `python:3.11-slim-bookworm`.
- The image installs `pathway==$PATHWAY_PACKAGE_VERSION` during build and verifies that it can be imported.
- The server code is delivered through the Compose `configs` section at `/app/server.py`.
- The service runs as a non-root user, exposes port `8080`, and uses a tmpfs-backed `/tmp`.

No extra database, queue, Streamlit UI, Ollama service, Docker socket, privileged mode, GPU device, or host-mounted source directory is started by default.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PATHWAY_PACKAGE_VERSION` | No | `0.30.1` | Pathway package version installed during the inline image build. Changing it requires rebuilding the image. |
| `LLM_APP_DEMO_TITLE` | No | `Pathway llm-app CPU demo` | Label returned by `/healthz` and `/demo`. |
| `LLM_APP_DEMO_TOP_K` | No | `2` | Number of local context records returned by `/demo`. Values are clamped to the bundled demo corpus size. |

Production extensions of the upstream templates may need environment variables such as these, depending on the template you adapt:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Provider key for upstream OpenAI chat and embedding examples. |
| `PATHWAY_LICENSE_KEY` | Optional Pathway license key if you choose to use licensed Pathway features. |
| `SHAREPOINT_URL`, `SHAREPOINT_TENANT`, `SHAREPOINT_CLIENT_ID`, `SHAREPOINT_THUMBPRINT`, `SHAREPOINT_ROOT` | SharePoint connector configuration. |
| `DRIVE_ID` and Google service account credentials | Google Drive connector configuration. Store credential JSON as a secret or mounted private asset when extending the stack. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET` | S3 connector configuration for a custom production version. |
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Local/private RAG model endpoint and model name if you add an Ollama service. |

Do not put real API keys, service account JSON, certificates, private documents, or generated secrets in this template directory.

## Deploy On Phala Cloud

1. Select the `llm-app` prebuilt template.
2. Keep the default CPU-only resource sizing for the verifier.
3. Leave provider credentials unset for the default deployment.
4. Deploy the CVM and wait for the image build and health check to complete.
5. Open `https://<your-app-domain>/healthz`.

The template repository used by Phala's public UI is:

```text
https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/llm-app
```

## Usage

Health check:

```bash
curl -fsS https://<your-app-domain>/healthz
```

Run the bundled deterministic retrieval demo:

```bash
curl -fsS "https://<your-app-domain>/demo?q=live%20RAG%20data%20sources"
```

List the local verifier model metadata:

```bash
curl -fsS https://<your-app-domain>/v1/models
```

Useful endpoints:

- `GET /healthz`: returns package import status, upstream repository metadata, runtime details, and whether external calls or credentials are used.
- `GET /demo`: ranks bundled upstream facts with the default query.
- `GET /demo?q=<query>&top_k=<n>`: runs the same deterministic local retrieval with a custom query and result count.
- `GET /v1/models`: returns OpenAI-style metadata for the local deterministic verifier.
- `GET /`: same readiness payload as `/healthz`.

Expected `/demo` fields include:

```json
{
  "ok": true,
  "service": "llm-app-pathway-verifier",
  "full_upstream_stack": false,
  "external_calls": false,
  "credentials_used": false,
  "demo": {
    "model": "llm-app-pathway-local-verifier",
    "retrieval": {
      "top_k": 2,
      "contexts": [
        {
          "id": "live-data"
        }
      ]
    }
  }
}
```

## Local Smoke Verification

From the public `phala-cloud` repository root:

```bash
docker compose -f templates/prebuilt/llm-app/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/llm-app/docker-compose.yml up -d --build
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS "http://127.0.0.1:8080/demo?q=pathway%20rag%20indexing"
curl -fsS http://127.0.0.1:8080/v1/models
docker compose -f templates/prebuilt/llm-app/docker-compose.yml down --remove-orphans
```

Template validation commands from this monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/llm-app/docker-compose.yml config >/dev/null
```

## Production Notes

Use this template as a deployable package/runtime verifier and as a starting point for a custom Pathway RAG service. It is not a replacement for the full upstream templates.

To adapt it into a full `pathwaycom/llm-app` production deployment:

1. Choose one upstream template, such as `templates/question_answering_rag`, `templates/document_indexing`, `templates/private_rag`, or `templates/multimodal_rag`.
2. Review that template's `README.md`, `app.py`, `app.yaml`, `Dockerfile`, and connector requirements.
3. Replace the bundled verifier server with the upstream application code you intend to run.
4. Add persistent storage intentionally for source documents, generated indexes, and caches. Avoid broad host bind mounts in a reusable public template.
5. Add provider credentials through Phala Cloud secrets or environment variables only after reviewing data handling, retention, and model costs.
6. If using local/private RAG, budget for Ollama or another model runtime and the model download size. The default verifier does not start Ollama or download any embedding or LLM model.
7. Add authentication before exposing document search, question-answering, or connector-backed APIs containing private data.

The upstream `question_answering_rag` example uses OpenAI chat and embedding components and expects `OPENAI_API_KEY`. The upstream `private_rag` example targets Ollama plus sentence-transformer embeddings. The upstream Compose files also use local data/cache mounts and, for some templates, an optional Streamlit UI. Those choices are useful for application development, but this Phala template avoids them so the default deployment remains small, credential-free, and smoke-testable.

## Security Notes

- The default verifier exposes unauthenticated JSON endpoints and contains only public upstream facts.
- No real provider secret is read or required by the default service.
- No external database, vector store, Docker socket, host networking, privileged mode, GPU access, or host bind mount is used.
- The container process runs as a non-root user.
- Add authentication, secret management, persistent storage policies, and connector-specific access controls before adapting this into a production RAG service.

## Cleanup

For a local run:

```bash
docker compose -f templates/prebuilt/llm-app/docker-compose.yml down --remove-orphans
docker image rm phala-llm-app-verifier:0.30.1
```

On Phala Cloud, stop or delete the deployment when it is no longer needed. Remove any provider credentials or connector secrets you added while experimenting with a production extension.
