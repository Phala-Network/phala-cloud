# assafelovic/gpt-researcher on Phala Cloud

Deploy a CPU-safe GPT Researcher upstream verifier and deterministic demo API on Phala Cloud.

## Metadata

- Template id: `gpt-researcher`
- Category: AI research agents and web data search
- Phala template source: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/gpt-researcher
- Upstream repository: https://github.com/assafelovic/gpt-researcher
- Upstream project: GPT Researcher by Assaf Elovic / `assafelovic`
- Pinned upstream release: `v3.4.4`
- Pinned upstream commit: `27abde0bd9c682853f09754cc8172e3b516b95f2`
- Pinned PyPI package: `gpt-researcher==0.14.8`
- Upstream license: MIT
- Icon source: `gpt-researcher.png` is copied from the logo image in the upstream README, served by GitHub at https://github.com/assafelovic/gpt-researcher/assets/13554167/20af8286-b386-44a5-9a83-3be1365139c3

## What This Template Runs

GPT Researcher is an open deep research agent for web and local research. The full upstream application can plan research tasks, gather sources, summarize evidence, track citations, and publish reports.

This Phala Cloud template intentionally starts in demo mode. It runs a small Python HTTP service on port `8080` using only the Python standard library. The service verifies pinned upstream release files and the pinned PyPI package metadata, then exposes smoke-testable JSON endpoints for health, deterministic demo output, and API surface discovery.

The default deployment does not start the upstream backend or NextJS frontend, does not run browser automation, does not call an LLM provider, does not call a search API, does not download model weights, does not mount host document folders, and does not require GPU access or credentials.

## Why This Is A Demo

GPT Researcher is useful when it can call an LLM provider and a retriever or search provider. The upstream README and `.env.example` use variables such as `OPENAI_API_KEY` and `TAVILY_API_KEY`, and the upstream Docker Compose file includes host bind mounts for documents, outputs, and logs.

Those are reasonable for a user-owned full GPT Researcher deployment, but they are not safe defaults for a Phala prebuilt template smoke test. This template therefore ships a credential-free verifier and deterministic local demo that honestly starts on a small CPU-only deployment.

## Services

- `app`: Python `3.12-slim-bookworm` HTTP server exposed on container and host port `8080`.

The service uses only `/tmp` as tmpfs, keeps `no-new-privileges`, and mounts the server code through a Docker Compose config. It does not set Compose `read_only` because Phala/dstack config mounts to rootfs paths such as `/server.py` can fail when the container rootfs is marked read-only.

## Environment Variables

No credentials are required for the default verifier and demo.

- `GPTR_DEMO_MAX_SOURCES`: Optional number of bundled demo source summaries returned by `/demo`. Default: `3`.
- `OPENAI_API_KEY`: Optional. Leave empty for the default demo. Set only when you replace or extend the demo with full GPT Researcher LLM calls.
- `TAVILY_API_KEY`: Optional. Leave empty for the default demo. Set only when you replace or extend the demo with full GPT Researcher web retrieval.
- `OPENAI_BASE_URL`: Optional OpenAI-compatible API base URL for full research deployments that use a custom provider. The default demo does not call it.

The compose file also sets non-secret verifier constants:

- `GPTR_UPSTREAM`: upstream repository URL.
- `GPTR_RELEASE`: pinned GitHub release tag.
- `GPTR_COMMIT`: pinned release commit.
- `GPTR_RELEASE_PUBLISHED_AT`: pinned release publication timestamp.
- `GPTR_PYPI_VERSION`: pinned PyPI package version.
- `VERIFY_TIMEOUT_SECONDS`: timeout for each small public metadata fetch.

Do not put real API keys, private keys, passwords, OTP secrets, session tokens, or provider tokens into this README or `docker-compose.yml`. Use Phala Cloud environment variables or secret handling for any full research deployment.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `gpt-researcher` prebuilt template.
2. Keep the default CPU-only resources for the verifier demo.
3. Leave `OPENAI_API_KEY`, `TAVILY_API_KEY`, and `OPENAI_BASE_URL` empty unless you are modifying the template to run full GPT Researcher.
4. Deploy the CVM and open the generated public endpoint for port `8080`.
5. Check `https://<your-app-domain>/healthz` and `https://<your-app-domain>/demo`.

The first startup pulls the Python base image and fetches small public text or JSON files from GitHub and PyPI for verification. If outbound metadata fetches are unavailable, the service still starts and reports the verifier failure at `/upstream`; health and demo endpoints remain usable.

## Usage

Health check:

```bash
curl -fsS https://<your-app-domain>/healthz
```

Run the deterministic local research-flow demo:

```bash
curl -fsS "https://<your-app-domain>/demo?query=How%20does%20GPT%20Researcher%20use%20credentials"
```

List the API-compatible demo surface:

```bash
curl -fsS https://<your-app-domain>/v1/models
```

Inspect pinned upstream verification:

```bash
curl -fsS https://<your-app-domain>/upstream
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "credential_free_by_default": true,
  "demo": {
    "mode": "deterministic local demo",
    "external_llm_calls": false,
    "external_search_calls": false,
    "browser_automation": false,
    "model_downloaded": false,
    "gpu_required": false
  }
}
```

## Verification And Smoke Checks

From the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/gpt-researcher/docker-compose.yml config >/dev/null
```

Optional local smoke test:

```bash
docker compose -f templates/prebuilt/gpt-researcher/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/upstream
docker compose -f templates/prebuilt/gpt-researcher/docker-compose.yml down
```

## Extending To Full GPT Researcher

Use this template as a Phala smoke-safe starting point, not as the full upstream GPT Researcher app.

To run real research workloads, replace the demo server with the upstream backend or your own GPT Researcher application code, review the upstream Dockerfile and Compose file, and provide required provider credentials through Phala Cloud variables or secrets. Common full-use settings include:

- `OPENAI_API_KEY` for OpenAI or an OpenAI-compatible LLM provider.
- `OPENAI_BASE_URL` when using a custom OpenAI-compatible endpoint.
- `TAVILY_API_KEY` or another retriever/search provider credential.
- `LANGCHAIN_API_KEY` and LangSmith tracing variables only if you enable tracing.
- `GOOGLE_API_KEY` only if you enable upstream image generation features.
- `DOC_PATH` only if your full deployment includes a safe document storage strategy.

Before enabling full research, check memory, disk, CPU latency, outbound network policy, browser automation requirements, document privacy, report storage, authentication, and any model or search provider terms. Keep host bind mounts, Docker socket access, privileged mode, host networking, and real secrets out of a prebuilt public template.

## Security Notes

- The default demo exposes unauthenticated health and metadata endpoints. Add authentication before exposing real research tasks, private documents, outputs, or provider-backed workflows.
- The compose file contains no real credentials and no secret defaults.
- The default service does not use `env_file`, host bind mounts, external build contexts, privileged mode, host networking, host IPC, Docker socket access, GPU devices, browser automation, or model downloads.
- The verifier fetches public GitHub and PyPI metadata only. It never sends configured credential values to those endpoints and never prints credential values in responses.
