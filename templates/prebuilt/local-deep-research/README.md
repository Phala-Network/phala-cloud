# LearningCircuit/local-deep-research On Phala Cloud

Deploy a CPU-safe Local Deep Research verifier and deterministic demo API on Phala Cloud.

## Metadata

- Template id: `local-deep-research`
- Display name: `LearningCircuit/local-deep-research`
- Category: AI Apps & Workflows
- Phala template source: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/local-deep-research
- Upstream repository: https://github.com/LearningCircuit/local-deep-research
- Upstream project: Local Deep Research by `LearningCircuit`
- Pinned upstream commit: `b0d5dd236f717a25c837e549a3b893311755d819`
- Pinned upstream source version: `1.7.0`
- Pinned PyPI package metadata: `local-deep-research==1.6.13`
- Icon source: `local-deep-research.png` uses the GitHub owner avatar from https://github.com/LearningCircuit.png because the upstream tree does not include a dedicated logo, icon, or favicon. The upstream image assets found during inspection were feature screenshots under `docs/images/`.

## Overview

Local Deep Research is an AI research assistant for deep, agentic research with citations. The upstream README describes local and cloud LLM support, including Ollama, llama.cpp, LM Studio, OpenAI-compatible endpoints, Google Gemini, Anthropic, and other providers. It also highlights academic and web search sources such as arXiv, PubMed, Semantic Scholar, Wikipedia, SearXNG, and private document collections, with per-user SQLCipher-encrypted databases.

The full upstream application is most useful after a user selects a model provider, configures search, creates a user account, and optionally builds a private document library. The upstream Docker Compose stack includes the LDR web app, Ollama, and SearXNG, and real research can require multi-GB model downloads, sidecar services, provider credentials, browser-capable content extraction, and larger persistent storage.

This Phala template intentionally starts in verifier mode. It runs a small Python HTTP service on port `8080` using only the Python standard library. The service verifies pinned upstream source files and PyPI metadata, then serves deterministic local endpoints for smoke testing. It does not start the full upstream web UI, call an LLM provider, call a search provider, run browser automation, download model weights, require GPU access, or require credentials.

## Services

- `app`: Python `3.12-slim-bookworm` HTTP server exposed on container and host port `8080`.

The service mounts its code through a Docker Compose config, runs as UID/GID `65532`, drops Linux capabilities, uses a tmpfs `/tmp`, and sets `no-new-privileges`. It does not use host bind mounts, `env_file`, external build contexts, privileged mode, host networking, host IPC, Docker socket access, or real secrets.

## Environment Variables

No credentials are required for the default verifier and demo.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `LDR_DEMO_MAX_SOURCES` | No | `3` | Number of bundled local demo source summaries returned by `/demo`. Values are clamped from 1 to 5. |
| `LDR_VERIFY_TIMEOUT_SECONDS` | No | `8` | Timeout in seconds for each public GitHub or PyPI metadata verification request. |

The compose file also sets non-secret verifier constants for the pinned upstream repository, commit, source version, and PyPI wheel hash. Do not add API keys, private keys, passwords, OTPs, session tokens, cookies, or provider tokens to this template.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `local-deep-research` prebuilt template.
2. Keep the default CPU-only resources for the verifier demo.
3. Leave provider and search credentials unset; the default service does not consume them.
4. Deploy the CVM and open the generated public endpoint for port `8080`.
5. Check `https://<your-app-domain>/healthz` and `https://<your-app-domain>/demo`.

The first startup pulls the Python base image and fetches small public text or JSON files from GitHub and PyPI for upstream verification. If outbound metadata fetches are unavailable, the service still starts and reports verifier errors through `/healthz` and `/upstream`; the deterministic `/demo` endpoint remains usable.

## Usage Endpoints

- `GET /healthz`: readiness JSON for Phala smoke testing. It reports service status, pinned upstream metadata, and source verification summary.
- `GET /demo`: deterministic local research-style response over bundled context records. Optional query parameter: `query`.
- `GET /v1/models`: OpenAI-shaped model-list response with a metadata-only `local-deep-research/no-llm-demo` placeholder. The template does not host or call an LLM.
- `GET /upstream`: detailed source and PyPI verification results.
- `GET /`: same readiness payload as `/healthz`.

Examples:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS "https://<your-app-domain>/demo?query=private%20local%20research"
curl -fsS https://<your-app-domain>/v1/models
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

## Smoke Verification

Run template validation from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/local-deep-research/docker-compose.yml config >/dev/null
```

Optional local smoke test from the parent worktree:

```bash
docker compose -f templates/prebuilt/local-deep-research/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/upstream
docker compose -f templates/prebuilt/local-deep-research/docker-compose.yml down
```

## Production Notes

Use this template as a Phala smoke-safe starting point, not as the full upstream Local Deep Research deployment.

For real research workloads, replace the verifier with the upstream `localdeepresearch/local-deep-research` service or a pinned custom image, then decide whether to add managed or sidecar services for LLM inference and search. Common production choices include:

- Ollama, llama.cpp, LM Studio, LocalAI, or another local/OpenAI-compatible model endpoint.
- SearXNG for private metasearch, plus optional external search APIs such as Serper, SerpAPI, Brave, or Google Programmable Search Engine.
- Persistent storage for `/data`, user databases, uploaded private documents, generated reports, search indexes, and any local model data.
- User registration policy, authentication, HTTPS termination, backup strategy, resource limits, and outbound network policy.
- Provider credentials or search API credentials supplied only through deployment-time environment variables, Phala secrets, or the upstream encrypted settings UI.

Before enabling full LDR, review the upstream Docker Compose guide, API quick start, configuration docs, and SQLCipher notes. The full app requires user authentication for API access, CSRF handling for state-changing HTTP calls, and per-user encrypted databases. Do not use host bind mounts, host networking, privileged mode, host IPC, Docker socket access, or hardcoded secrets in a public prebuilt template.

## Security Notes

- The default demo exposes unauthenticated health and metadata endpoints. Add authentication before exposing real research tasks, private documents, saved outputs, or provider-backed workflows.
- The compose file contains no real credentials and no secret defaults.
- The default service does not call model providers, search providers, browser automation, or local inference servers.
- The verifier fetches public GitHub and PyPI metadata only. It never sends configured credential values because the default template has no credential variables.
- Pin image tags, source commits, package versions, and provider endpoints for reproducible production deployments.
