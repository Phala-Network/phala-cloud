# withastro/flue on Phala Cloud

Deploy a CPU-safe Flue verifier on Phala Cloud. The template installs the real `@flue/runtime` and `@flue/cli` packages, builds a tiny Flue Node application, then exposes deterministic HTTP endpoints for smoke testing without LLM credentials.

The default service does not call a model provider, does not download model weights, does not require browser authentication, and does not need API keys. It is a deployment verifier for Flue's harness/session/sandbox primitives, not a production agent with an LLM attached.

## Metadata

- Template id: `flue`
- Display name: `withastro/flue`
- Category: AI Agents & Developer Tools
- Upstream repo: `https://github.com/withastro/flue`
- Upstream docs: `https://flueframework.com/docs/`
- Package: `@flue/runtime`
- CLI package: `@flue/cli`
- Default package version: `0.9.1`
- Icon source: upstream favicon at `apps/docs/public/favicon.svg` in `withastro/flue`, inspected at commit `bb9245f01677a2a169dc98d457292c57043dd40b`
- Upstream author: `withastro`

## What This Template Runs

Flue is a TypeScript agent harness framework. Upstream Flue applications can target Node.js and Cloudflare, and the Node deployment guide builds a generated `dist/server.mjs` server from discovered agents, workflows, and optional application routes.

This template follows that Node path. On startup the container:

1. Writes a small `.flue` project from Docker Compose inline configs.
2. Installs `@flue/runtime`, `@flue/cli`, and `hono`.
3. Runs `flue build --target node`.
4. Starts the generated `dist/server.mjs` server on port `3000`.

The built app defines a `sandbox-demo` workflow that creates a Flue agent with `model: false`, initializes a harness and session, then exercises Flue's default virtual sandbox with `session.fs`, `harness.fs`, `session.shell`, and `harness.shell`. It performs file writes, reads, directory listing, existence checks, deletion, stat, and byte-buffer reads. The workflow intentionally avoids `session.prompt`, `session.skill`, and `session.task` because those are model-backed paths.

## Services

- `app`: Node.js 24 service that builds and runs the Flue verifier.

## Ports

- `8080`: Public HTTP endpoint mapped to the generated Flue server on container port `3000`.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `FLUE_PACKAGE_VERSION` | No | `0.9.1` | Version used for both `@flue/runtime` and `@flue/cli` at container startup. Override only when testing a compatible published Flue release. |

Provider keys such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or gateway credentials are intentionally not configured. Add deployment-time secrets only after replacing the verifier workflow with a real Flue agent that calls a model provider.

## Deploy

1. Deploy the `flue` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `FLUE_PACKAGE_VERSION` to another compatible published Flue version.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads npm packages and builds the Flue Node artifact, so it can take a few minutes on a small CPU-only CVM.

## Usage Endpoints

- `GET /healthz`: Returns readiness metadata for the generated Flue demo service.
- `GET /demo`: Invokes the real Flue workflow at `/workflows/sandbox-demo?wait=result` and returns the verifier result.
- `POST /demo`: Same as `GET /demo`; useful for smoke systems that expect a POST target.
- `GET /v1/models`: Returns an OpenAI-shaped model list containing a metadata-only `flue/no-llm-virtual-sandbox-demo` entry.
- `POST /workflows/sandbox-demo?wait=result`: Direct Flue workflow route for the deterministic sandbox verifier.

Examples:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
curl -fsS 'https://<your-app-domain>/workflows/sandbox-demo?wait=result' \
  -H 'Content-Type: application/json' \
  -d '{"source":"manual smoke"}'
```

## Smoke Verification

Use these commands to verify the template locally before deploying it:

Run locally from the `sdks/` directory:

```bash
docker compose -f templates/prebuilt/flue/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/flue/docker-compose.yml down
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "demo": {
    "allPassed": true,
    "credentialsRequired": false,
    "llmProviderCalls": false,
    "modelDownloads": false
  }
}
```

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/flue/docker-compose.yml config >/dev/null
```

## Production Notes

- The default verifier is unauthenticated. Add authentication before exposing real agent, workflow, run, or admin routes that handle private payloads.
- Real Flue agents normally configure a model, for example an Anthropic, OpenAI, OpenRouter, Cloudflare, or compatible provider model. Keep provider credentials in Phala deployment environment variables or a secrets manager, not in the compose file.
- Flue's Node target uses in-memory session state by default unless you configure a session store. Plan persistence separately from sandbox persistence.
- The default virtual sandbox is lightweight and in-memory. Use a remote sandbox connector only when a production agent needs a fuller Linux environment or durable workspace.
- The template does not use privileged mode, host networking, host IPC, Docker socket mounts, host bind mounts, `env_file`, GPUs, or bundled secrets.
- Pin `FLUE_PACKAGE_VERSION` for reproducible deployments.

## Cleanup

For a local test run from `sdks/`, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/flue/docker-compose.yml down
```

No named volumes are created by this template.
