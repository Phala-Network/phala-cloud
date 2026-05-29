# Significant-Gravitas/AutoGPT on Phala Cloud

Deploy a CPU-safe AutoGPT upstream verifier and deterministic workflow demo API on Phala Cloud.

## Metadata

- Template id: `autogpt`
- Category: autonomous agents and workflow automation
- Phala template source: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/autogpt
- Upstream repository: https://github.com/Significant-Gravitas/AutoGPT
- Upstream project: AutoGPT by `Significant-Gravitas`
- Pinned upstream release: `autogpt-platform-beta-v0.6.62`
- Pinned upstream commit: `c194ab1b71839ef1fdb769f8343249c9e4f86abf`
- Upstream release published: `2026-05-28T02:12:41Z`
- Upstream license notes: the `autogpt_platform` folder uses the Polyform Shield License; the classic AutoGPT code outside that folder is MIT-licensed. Review upstream licensing before shipping derivative production services.
- Icon source: `autogpt.png` is copied from upstream `assets/gpt_dark_RGB.png`.

## What This Template Runs

AutoGPT is a platform for building, deploying, and running continuous AI agents and automation workflows. The full upstream platform includes a frontend, backend, database, Redis, Supabase integrations, authentication, marketplace workflows, and provider-backed agent execution.

This Phala Cloud template intentionally starts in demo mode. It runs:

- `app`: a Python standard-library HTTP service on port `8080`.
- `proxy`: Caddy on public port `8080`, reverse-proxying to the app service.

The app verifies pinned public upstream AutoGPT files by byte length, SHA-256, and source markers. It also exposes a deterministic local workflow demo that describes an AutoGPT-style trigger/planner/executor flow without launching provider-backed agents.

The default deployment does not start the full AutoGPT platform, does not call an LLM provider, does not use browser automation, does not download model weights, does not mount a Docker socket, does not use host bind mounts, and does not require GPU access or credentials.

The service uses only `/tmp` as tmpfs, keeps `no-new-privileges`, and mounts the server code through a Docker Compose config. It does not set Compose `read_only` because Phala/dstack container creation can fail when inline Compose configs are mounted into a read-only rootfs.

## Why This Is A Demo

The upstream AutoGPT Platform is production-heavy for a conservative `tdx.small` prebuilt template smoke test. Its documented self-hosted stack expects multiple services and real operational dependencies such as database state, auth, frontend/backend coordination, provider credentials, and integration configuration.

Those are appropriate for a user-owned full AutoGPT deployment, but they are not safe defaults for a public Phala prebuilt template. This template therefore provides a credential-free verifier and local workflow demo that honestly starts on a small CPU-only deployment while preserving clear guidance for extending it into the full upstream stack.

## Environment Variables

No credentials are required for the default verifier and demo.

- `AUTOGPT_VERIFY_TIMEOUT_SECONDS`: Optional timeout for each small upstream metadata fetch. Default: `8`.
- `OPENAI_API_KEY`: Optional. Leave empty for the default demo. Set only if you replace or extend the service with provider-backed AutoGPT agent execution.
- `ANTHROPIC_API_KEY`: Optional. Leave empty for the default demo. Set only if you replace or extend the service with provider-backed AutoGPT agent execution.

The compose file also sets non-secret verifier constants:

- `AUTOGPT_UPSTREAM`: upstream repository URL.
- `AUTOGPT_RELEASE`: pinned GitHub release tag.
- `AUTOGPT_COMMIT`: pinned release commit.
- `AUTOGPT_RELEASE_PUBLISHED_AT`: pinned release publication timestamp.

Do not put real API keys, private keys, passwords, OAuth tokens, session cookies, or provider tokens into this README or `docker-compose.yml`. Use Phala Cloud environment variables or secret handling for any full AutoGPT deployment.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `autogpt` prebuilt template.
2. Keep the default CPU-only resources for the verifier demo.
3. Leave provider API keys empty unless you are modifying the template to run real AutoGPT agents.
4. Deploy the CVM and open the generated public endpoint for port `8080`.
5. Check `https://<your-app-domain>/healthz`, `https://<your-app-domain>/demo`, and `https://<your-app-domain>/upstream`.

The first startup pulls Python and Caddy images and fetches small public files from GitHub for verification. If outbound GitHub metadata fetches are temporarily unavailable, `/healthz` still proves that the local service is up, while `/upstream` reports the verification failure explicitly.

## Usage

Health check:

```bash
curl -fsS https://<your-app-domain>/healthz
```

Run the deterministic local workflow demo:

```bash
curl -fsS "https://<your-app-domain>/demo?goal=summarize%20AutoGPT%20on%20Phala%20Cloud"
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
  "service": "autogpt-source-verifier",
  "demo": {
    "mode": "deterministic local AutoGPT workflow demo",
    "external_llm_calls": false,
    "external_provider_calls": false,
    "browser_automation": false,
    "model_downloaded": false,
    "gpu_required": false
  }
}
```

## Verification And Smoke Checks

From the template repository root:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/autogpt/docker-compose.yml config >/dev/null
```

Optional local smoke test:

```bash
docker compose -f templates/prebuilt/autogpt/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/upstream
docker compose -f templates/prebuilt/autogpt/docker-compose.yml down
```

## Extending To Full AutoGPT

Use this template as a Phala smoke-safe starting point, not as the full upstream AutoGPT Platform.

To run real AutoGPT workloads, replace the verifier with the upstream platform services or your own AutoGPT-derived app, then review the upstream `autogpt_platform/docker-compose.yml`, backend/frontend docs, database requirements, authentication model, and provider/integration secrets. Common full-use additions include:

- A managed database and persistent Redis/Supabase-compatible state.
- Auth configuration for users, workspaces, and API access.
- LLM provider credentials and model routing.
- Integration credentials for the external systems that AutoGPT workflows call.
- Persistent storage for workflow definitions, execution history, and artifacts.

Before enabling full agent execution, review memory, disk, CPU latency, outbound network policy, authentication, billing controls, audit logging, prompt/data privacy, and provider terms. Keep host bind mounts, Docker socket access, privileged mode, host networking, and real secrets out of a public prebuilt template.

## Security Notes

- The default demo exposes unauthenticated health and metadata endpoints. Add authentication before exposing real agent execution, workflow editing, private data, or provider-backed operations.
- The compose file contains no real credentials and no secret defaults.
- The default service does not use `env_file`, host bind mounts, external build contexts, privileged mode, host networking, host IPC, Docker socket access, GPU devices, browser automation, or model downloads.
- The verifier fetches public GitHub source files only. It never sends configured credential values to those endpoints and never prints credential values in responses.
