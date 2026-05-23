# QuivrHQ/quivr On Phala Cloud

Deploy a CPU-safe Quivr source and runtime verifier on Phala Cloud.

## Overview

Quivr is a RAG and knowledge-assistant project from QuivrHQ. The current upstream repository at https://github.com/QuivrHQ/quivr is centered on `quivr-core`, a Python package for building "brain" style RAG workflows over files. The upstream README and docs show provider-backed usage with OpenAI, Anthropic, Mistral, and Ollama-compatible local models.

This Phala Cloud template intentionally does not start a full Quivr RAG application. Instead, it runs a small HTTP verifier on port `8000` that pins the upstream `main` source commit `947a785415c6c35ab2ae8157222b4720b0710b4d`, verifies selected upstream files by SHA256, checks source markers for the package, docs, provider requirements, and example UI, and exposes smoke-testable JSON endpoints.

The demo downloads no model weights, installs no Quivr package, starts no vector database, starts no Chainlit UI, requires no GPU, and requires no provider credentials.

## Metadata

- Template id: `quivr`
- Display name: `QuivrHQ/quivr`
- Category: RAG and knowledge-assistant framework
- Upstream repository: https://github.com/QuivrHQ/quivr
- Pinned upstream ref: `main`
- Pinned upstream commit: `947a785415c6c35ab2ae8157222b4720b0710b4d`
- Latest upstream release inspected: `core-0.0.33`
- Release page: https://github.com/QuivrHQ/quivr/releases/tag/core-0.0.33
- Upstream license: Apache-2.0
- Icon source: `quivr.png` is copied from the upstream README logo file `logo.png` at https://raw.githubusercontent.com/QuivrHQ/quivr/947a785415c6c35ab2ae8157222b4720b0710b4d/logo.png

## What This Template Runs

- `app`: a Python `3.12-slim-bookworm` HTTP service exposed on container and host port `8000`.

At startup the service launches a background verifier that fetches these pinned upstream files:

- `README.md`
- `core/pyproject.toml`
- `docs/docs/quickstart.md`
- `core/quivr_core/brain/brain_defaults.py`
- `examples/chatbot/README.md`

For each file it checks the expected SHA256 digest and specific markers, including the `quivr-core` package version, Python version requirement, LangChain and FAISS CPU dependencies, default OpenAI embedding and LLM configuration, documented provider requirements, Ollama support, and the Chainlit example's API-key requirement.

## Why This Is A Demo

The current upstream Quivr repository is not a single production Docker Compose application. Its root tree is a Python RAG package, documentation, and examples. The documented quickstart asks users to add API keys before creating a `Brain`, and the package defaults include `OpenAIEmbeddings`, an OpenAI `gpt-4o` LLM endpoint, FAISS CPU vector storage, and optional integrations for Anthropic, Mistral, Gemini, Groq, Cohere, LangFuse, Megaparse, and Ollama-style local models.

Running a real Quivr assistant therefore means choosing model providers or local inference, supplying credentials or model infrastructure, handling document ingestion, and sizing memory and storage for embeddings, vector indexes, parsers, and UI/runtime services. That is not an honest default for a `tdx.small` smoke deployment. This template is therefore a verifier demo: it proves the pinned upstream source and runtime facts without pretending to operate production Quivr.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `quivr` prebuilt template.
2. Keep the default small resources for the verifier demo.
3. Deploy the CVM and open the generated public endpoint for port `8000`.
4. Check `https://<your-app-domain>/healthz` and `https://<your-app-domain>/demo`.

The first startup only pulls the Python base image and fetches small public text files from GitHub for verification. No private credentials, model downloads, GPU devices, host mounts, host networking, host IPC, privileged mode, external build context, `env_file`, or Docker socket access are required.

## Environment Variables

No user-supplied environment variables are required.

The compose file sets only non-secret verifier constants:

- `QUIVR_UPSTREAM`: upstream repository URL.
- `QUIVR_REF_NAME`: human-readable upstream ref label, currently `main`.
- `QUIVR_REF`: pinned upstream commit used for raw source verification.
- `QUIVR_LATEST_RELEASE`: latest upstream release inspected, currently `core-0.0.33`.
- `QUIVR_LATEST_RELEASE_PUBLISHED_AT`: upstream release timestamp.
- `VERIFY_TIMEOUT_SECONDS`: timeout for each small upstream file fetch.

Do not add API keys, database passwords, object storage credentials, model-provider credentials, session tokens, or OAuth secrets to this demo unless you are converting it into a real production deployment. If you do convert it, define credential-like variables as required Phala Cloud environment variables or secrets and avoid hardcoding values in `docker-compose.yml`.

## Endpoints/Usage

- `GET /healthz`: readiness JSON for Phala smoke testing. It returns HTTP `200` while reporting the background verifier status.
- `GET /demo`: verifier details, pinned upstream metadata, SHA256 results, runtime facts, and an explicit statement that production Quivr is not running.
- `GET /v1/models`: OpenAI-compatible model-list shape with an empty `data` array because no model provider or inference server is running.
- `GET /`: same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "demo": {
    "mode": "cpu-safe Quivr source and runtime verifier",
    "full_stack_started": false,
    "model_weights_downloaded": false,
    "gpu_required": false,
    "provider_credentials_required": false,
    "safe_for_tdx_small_smoke": true
  }
}
```

## Verification Commands

From the monorepo root:

```bash
python3 templates/validate.py
docker compose -f templates/prebuilt/quivr/docker-compose.yml config
git diff --check origin/main...HEAD
```

Optional local smoke test:

```bash
docker compose -f templates/prebuilt/quivr/docker-compose.yml up -d
curl -fsS http://localhost:8000/healthz
curl -fsS http://localhost:8000/demo
curl -fsS http://localhost:8000/v1/models
docker compose -f templates/prebuilt/quivr/docker-compose.yml down
```

Static audit commands:

```bash
test -f templates/icons/quivr.png
rg -n "env_file|privileged: true|network_mode: host|docker\\.sock|build:" templates/prebuilt/quivr/docker-compose.yml templates/config.json
rg -n "OPENAI_API_KEY=.*[^ >-]|ANTHROPIC_API_KEY=.*[^ >-]|MISTRAL_API_KEY=.*[^ >-]|password|secret|token" templates/prebuilt/quivr templates/config.json
```

The first `rg` command should produce no matches. The second command may find explanatory prose, but it should not find real credential values.

## Resource Expectations

The verifier demo is small and intended for `tdx.small`-class smoke testing. It runs one Python HTTP process, performs a few small HTTPS fetches, and does not keep a database, vector index, document parser, UI service, or model runtime in memory.

Production Quivr sizing depends on the selected model providers, local model runtimes, parser stack, document volume, embedding throughput, vector storage, and UI/API shape. Plan resources around real ingestion and retrieval workloads rather than this verifier.

## Security Notes

- The demo exposes unauthenticated health and metadata endpoints. This is acceptable for smoke testing, but not for private document search or real RAG workloads.
- The compose file contains no real credentials and no credential-like environment variables.
- The demo does not use `env_file`, host bind mounts, external build contexts, privileged mode, host networking, host IPC, or Docker socket access.
- The verifier fetches public upstream files from GitHub. If outbound access is unavailable, endpoints still return non-5xx JSON and report the verification failure.
- Add authentication, TLS routing, secret management, private network controls, and data-retention policies before exposing production Quivr APIs, UIs, uploaded documents, or generated answers.

## Moving To Production/Full Quivr Guidance

Use this template as a Phala smoke-safe upstream verifier, not as the production Quivr deployment.

To deploy a real Quivr application:

1. Start from the official upstream repository and release-matched source at https://github.com/QuivrHQ/quivr.
2. Decide whether you are building directly on the `quivr-core` Python package or adapting one of the upstream Chainlit examples.
3. Choose LLM, embedding, reranking, parsing, and optional local model backends explicitly. The upstream docs mention OpenAI, Anthropic, Mistral, and Ollama-style local models.
4. Provide required credentials, such as provider API keys, as Phala Cloud secrets or required environment variables. Do not hardcode them in Compose.
5. Size CPU, memory, disk, and any external services for your document corpus, parser needs, embedding throughput, FAISS or other vector storage, and UI/API concurrency.
6. Add authentication and authorization before allowing users to upload private documents or query private knowledge bases.
7. Replace this verifier's `/demo` endpoint with the real Quivr UI/API health and readiness checks once your production stack is defined.
