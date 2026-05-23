# bolt.diy on Phala Cloud

## Overview

This template deploys a CPU-safe HTTP metadata verifier for [stackblitz-labs/bolt.diy](https://github.com/stackblitz-labs/bolt.diy), the open-source AI full-stack app builder from the bolt.diy community.

The default service does not run the full Remix/Cloudflare bolt.diy application. That upstream app is useful, but the production path is heavier and real chat/build workflows normally need provider configuration. Instead, this template starts a small Node.js service that fetches the real upstream repository files for a pinned ref, verifies the package manifest and key runtime source files, and exposes deterministic JSON endpoints for Phala Cloud smoke testing.

No LLM provider credentials, model downloads, GPU access, privileged mode, host bind mounts, external build contexts, or `env_file` are required for the default smoke path.

## Metadata

- Template id: `bolt-diy`
- Display name: `stackblitz-labs/bolt.diy`
- Upstream repository: https://github.com/stackblitz-labs/bolt.diy
- Upstream documentation: https://stackblitz-labs.github.io/bolt.diy/
- Upstream author: `stackblitz-labs` and the bolt.diy team
- Default inspected ref: `2e254ac19a696394030601bc602f54945b12bfc4`
- Runtime image: `node:22-bookworm-slim`
- Icon source: upstream `public/favicon.svg` from `stackblitz-labs/bolt.diy`, inspected on the `main` branch where the README and repository tree also expose `public/logo.svg`, `icons/logo.svg`, and related public logo assets.

## What This Template Runs

The `app` service listens on port `8080`. On startup it uses Node's built-in `fetch` to retrieve upstream files from GitHub for `BOLT_DIY_REF`, then checks:

- `package.json` name, module type, Node engine, pnpm package manager, required scripts, and important dependencies.
- The AI chat route at `app/routes/api.chat.ts`.
- The LLM runtime directory at `app/lib/.server/llm`.
- The WebContainer runtime at `app/lib/webcontainer/index.ts`.
- The action parser runtime at `app/lib/runtime/message-parser.ts`.
- Public assets such as `favicon.svg` and `logo.svg`.

This is intentionally a verifier and metadata API. It confirms the real upstream source/runtime surface is reachable and shaped as expected, but it does not build bolt.diy, serve the full browser UI, run WebContainers, or call a model provider.

## Deploy

Deploy the `bolt-diy` prebuilt template on Phala Cloud and keep the default resource size for the smoke verifier. The service publishes HTTP on port `8080`.

For a local smoke run from the monorepo root:

```bash
docker compose -f templates/prebuilt/bolt-diy/docker-compose.yml up -d
```

After startup, open:

```text
http://localhost:8080/healthz
```

The first health check depends on outbound access to GitHub raw/API endpoints because the verifier checks the upstream repository at runtime.

## Usage

Use the public Phala Cloud app URL or local port `8080`:

```bash
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
```

Endpoints:

- `GET /healthz`: Returns HTTP 200 when the upstream source checks pass. Returns HTTP 503 with a concrete error if GitHub fetches or checks fail.
- `GET /demo`: Returns the complete metadata verifier report, including checked files, dependency metadata, and confirmation that no LLM provider calls are made.
- `GET /v1/models`: Returns an OpenAI-shaped metadata list with `bolt-diy/no-llm-metadata-demo`. This is not a hosted model.
- `GET /`: Same readiness payload as `/healthz`.

## Environment Variables

The default template requires no credentials.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `BOLT_DIY_REF` | No | `2e254ac19a696394030601bc602f54945b12bfc4` | Git branch, tag, or commit from `stackblitz-labs/bolt.diy` to verify. Pin a commit for reproducible deployments. Use `stable` or a release tag only when you intentionally want to track upstream movement. |

Provider variables are intentionally not consumed by this metadata verifier. If you replace this verifier with the full upstream bolt.diy app, pass provider credentials only as deployment-time environment variables, using placeholders like:

| Variable | Placeholder | Notes |
| --- | --- | --- |
| `OPENAI_API_KEY` | `<your-openai-key>` | Optional for a custom full bolt.diy app using OpenAI. Not read by this template. |
| `ANTHROPIC_API_KEY` | `<your-anthropic-key>` | Optional for a custom full bolt.diy app using Anthropic. Not read by this template. |
| `OPEN_ROUTER_API_KEY` | `<your-openrouter-key>` | Optional for a custom full bolt.diy app using OpenRouter. Not read by this template. |
| `OLLAMA_API_BASE_URL` | `http://<ollama-host>:11434` | Optional for a custom full bolt.diy app that connects to an Ollama endpoint. Not read by this template. |

Do not place real provider values in `docker-compose.yml` or in template files.

## Verification

Run the repository validations from the monorepo root:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/bolt-diy/docker-compose.yml config >/dev/null
```

Local runtime smoke:

```bash
docker compose -f templates/prebuilt/bolt-diy/docker-compose.yml up -d
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/bolt-diy/docker-compose.yml down
```

Expected results:

- `GET /healthz` returns `200 OK` after upstream checks complete.
- The payload includes `"ok": true`, `"credentials_required": false`, `"llm_provider_calls": false`, and `"model_downloaded": false`.
- `/demo` reports verified source paths such as `app/routes/api.chat.ts`, `app/lib/.server/llm`, and `app/lib/webcontainer/index.ts`.
- `/v1/models` includes `bolt-diy/no-llm-metadata-demo`.

## Production Notes And Caveats

- This template is a Phala Cloud smoke-testable verifier for bolt.diy, not a production bolt.diy UI deployment.
- The full upstream app is a Remix/Cloudflare/Wrangler application with a WebContainer browser runtime and many provider integrations. Running it directly may need more CPU/memory, a full build, and carefully managed provider credentials.
- The default verifier is unauthenticated. It exposes only metadata, but add authentication or a protected reverse proxy before adapting it for private operational data.
- The verifier performs outbound GitHub source fetches at startup. Pin `BOLT_DIY_REF` to a commit for stable production checks.
- The compose file uses a public Node image, one HTTP service, no host bind mounts, no `env_file`, no privileged mode, no Docker socket, and no GPU requirements.

## Cleanup

For a local run:

```bash
docker compose -f templates/prebuilt/bolt-diy/docker-compose.yml down
```
