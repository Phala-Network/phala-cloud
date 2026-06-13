# sveltejs/svelte

Deploy a CPU-safe Svelte compiler and server-render verifier on Phala Cloud.

## Metadata

- Template id: `svelte`
- Display name: `sveltejs/svelte`
- Category: AI Apps & Workflows
- Description: web development for the rest of us
- Upstream repository: https://github.com/sveltejs/svelte
- Upstream documentation: https://svelte.dev/docs/svelte/overview
- Runtime/deployment documentation inspected: https://svelte.dev/docs/kit/adapter-node
- JavaScript package: `svelte`, installed from npm at container startup
- Icon source: `svelte.png` is copied from the upstream repository file `playgrounds/sandbox/favicon.png`
- Upstream author: `sveltejs`, via the `sveltejs/svelte` GitHub repository

## Overview

Svelte is a compiler for building web user interfaces. The upstream README describes Svelte as a compiler that turns declarative components into efficient JavaScript, while the official docs point production web applications toward SvelteKit and deployment adapters such as `@sveltejs/adapter-node`.

This Phala Cloud template intentionally does not scaffold a full application from a host checkout. Instead, it runs a small no-credential HTTP verifier on `node:22-alpine`. At startup it installs the real `svelte` package, imports `svelte/compiler`, `svelte/server`, and `svelte/store`, compiles a local `.svelte` component, server-renders it, and exposes deterministic health, demo, and OpenAI-compatible model-list endpoints.

The default service is suitable for `tdx.small` because it does not use a browser, external LLM or model provider, GPU, database, private package registry, model weights, or credentials.

## Service

- `app`: Node.js HTTP verifier exposed on container port `8080`.

## Port

- `8080`: Public HTTP endpoint for health, Svelte compile/render demo output, rendered demo HTML, and `/v1/models`.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SVELTE_VERSION` | No | `5.56.3` | Svelte npm package version installed at container startup. The default is the npm release inspected for this template. |
| `SVELTE_DEMO_NAME` | No | `Phala Cloud` | Name rendered by the deterministic Svelte demo component. |

## Deploy

1. Deploy the `svelte` template on Phala Cloud.
2. Keep the default CPU-only resource profile unless you extend it into a larger SvelteKit app.
3. Optionally set `SVELTE_VERSION` to another compatible published Svelte version.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the public Svelte npm package. After that, all verifier endpoints run locally and deterministically inside the container.

## Endpoints

- `GET /healthz`: Returns `200` when the Svelte package imports, the component compiles, and a local render succeeds.
- `GET /`: Same readiness payload as `/healthz`.
- `GET /demo`: Returns JSON with rendered component HTML, head content, scoped CSS, compiler metadata, source hash, and a small `svelte/store` trace.
- `GET /demo?name=<name>`: Runs the same deterministic render with a custom component prop.
- `GET /demo.html`: Returns a browser-viewable HTML page assembled from the Svelte server-render output and compiled CSS.
- `GET /v1/models`: Returns an OpenAI-compatible model-list shape describing the local Svelte compiler verifier.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS "https://<your-app-domain>/demo?name=Confidential%20UI"
curl -fsS https://<your-app-domain>/demo.html
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "credentials_required": false,
  "remote_model_calls": false,
  "model_downloaded": false,
  "package": {
    "name": "svelte",
    "version": "5.56.3"
  },
  "compiler": {
    "ast_type": "Root",
    "has_css": true
  },
  "demo": {
    "store_trace": [0, 1, 11]
  }
}
```

The final value in `store_trace` is the rendered name length, so it changes when you pass a custom `name` query parameter.

## Smoke Verification

Use these commands to verify the template locally without provider credentials:

Run locally from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/svelte/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/svelte/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/demo.html
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/svelte/docker-compose.yml down
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/svelte/docker-compose.yml config >/dev/null
```

If your local environment does not provide a `python` executable, run the same validation with `python3 templates/validate.py`.

## Production Notes

- The default service is a verifier for the upstream Svelte package and compiler/runtime primitives. It is not a full SvelteKit production application.
- For production SvelteKit apps on a Node server, follow the upstream `@sveltejs/adapter-node` documentation, build your app with your own source tree, and run the generated server output.
- Add authentication before exposing private demos, application state, or internal build metadata.
- Pin `SVELTE_VERSION` for reproducible deployments and review npm package supply-chain controls before production use.
- Keep application secrets in Phala Cloud environment variables or a dedicated secret manager. Do not hardcode API keys, tokens, private keys, OTPs, or passwords in Compose files or READMEs.
- The compose file intentionally avoids host bind mounts, `env_file`, external build context, privileged mode, host networking, host IPC, Docker socket access, GPU devices, real secrets, browser authentication, hosted model calls, and model-weight downloads.

## Cleanup

For a local test run from the parent monorepo worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/svelte/docker-compose.yml down
```
