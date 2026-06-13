# Egonex-AI/Understand-Anything

Deploy a CPU-safe Understand Anything verifier on Phala Cloud.

## Overview

Understand Anything is an open-source AI coding plugin that turns a codebase, knowledge base, or docs into an interactive knowledge graph that can be explored, searched, and asked questions about. The upstream project targets Claude Code, Codex, Cursor, Copilot, Gemini CLI, OpenCode, Hermes, Cline, Trae, and similar AI coding tools.

This Phala Cloud template is a deterministic verifier, not the full multi-agent plugin workflow. It downloads a pinned upstream source artifact, builds the real `@understand-anything/core` TypeScript workspace package, and serves HTTP endpoints that exercise local core primitives:

- graph schema validation with `validateGraph`
- fuzzy node search with `SearchEngine`
- heuristic guided tour generation with `generateHeuristicTour`
- language concept detection with `detectLanguageConcepts`
- structural fingerprint comparison with `extractFileFingerprint`, `compareFingerprints`, and `classifyUpdate`

The default deployment does not call an LLM provider, does not require browser authentication, does not download model weights, and does not need API keys.

## Metadata

- Template id: `egonex-ai-understand-anything`
- Display name: `Egonex-AI/Understand-Anything`
- Category: AI Apps & Workflows
- Description: Graphs that teach > graphs that impress. Turn any code into an interactive knowledge graph you can explore, search, and ask questions about. Works with Claude Code, Codex, Cursor, Copilot, Gemini CLI, and more.
- Upstream repository: https://github.com/Egonex-AI/Understand-Anything
- Upstream homepage: https://understand-anything.com
- Upstream live demo: https://understand-anything.com/demo/
- Upstream author: Egonex-AI. The upstream README also credits `Lum1104` as the original creator.
- Icon source: upstream `homepage/public/favicon.svg` from https://github.com/Egonex-AI/Understand-Anything/blob/main/homepage/public/favicon.svg

## What This Template Runs

- `app`: a `node:22-bookworm-slim` HTTP service.
- The inline Dockerfile downloads `Egonex-AI/Understand-Anything` from GitHub at `UNDERSTAND_ANYTHING_REF`.
- The image installs upstream's pinned `pnpm@10.6.2`, installs the workspace dependencies needed by `@understand-anything/core`, and builds the core package.
- Runtime serves a small local demo graph over HTTP using the built upstream core modules.

The demo graph is intentionally tiny so it can run on CPU-only `tdx.small` resources and verify the source artifact without credentials or external agent tooling.

## Ports

- `8080`: public HTTP endpoint for health, demo, and model-list checks.

## Environment Variables

No credentials are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `UNDERSTAND_ANYTHING_REF` | No | `09ede1917ffd043e6d5bbc8a80b45760814c2d7f` | Git branch, tag, or commit downloaded from `Egonex-AI/Understand-Anything` at image build time. Redeploy or rebuild the image after changing it. |
| `UNDERSTAND_ANYTHING_DEMO_QUERY` | No | `payment graph onboarding` | Default fuzzy-search query used by the `/demo` endpoint when no `q` query parameter is provided. |

## Deploy

1. Deploy the `egonex-ai-understand-anything` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `UNDERSTAND_ANYTHING_REF` to a reviewed upstream commit, tag, or branch.
4. Open `https://<your-app-domain>/healthz` after the image builds and the container starts.

The first build downloads the upstream source tarball and npm dependencies. Runtime startup is local and does not use external model providers.

## Usage Endpoints

- `GET /healthz`: returns `200` when the upstream core package is built, imported, and the local verifier graph validates.
- `GET /demo`: runs deterministic local checks against a bundled graph and returns validation, search, tour, concept, and fingerprint results.
- `GET /demo?q=<query>`: runs the same demo with a custom fuzzy-search query.
- `GET /v1/models`: returns an OpenAI-style metadata list for compatibility probes. This is not an LLM inference endpoint.
- `GET /`: same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS "https://<your-app-domain>/demo?q=guided%20tour"
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpuOnly": true,
  "credentialsRequired": false,
  "remoteModelCalls": false,
  "modelDownloaded": false,
  "search": {
    "engine": "SearchEngine"
  },
  "graph": {
    "validation": {
      "success": true
    }
  }
}
```

## Smoke Verification

Run locally from the parent worktree:

```bash
docker compose -f templates/prebuilt/egonex-ai-understand-anything/docker-compose.yml up --build -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/egonex-ai-understand-anything/docker-compose.yml down
```

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/egonex-ai-understand-anything/docker-compose.yml config >/dev/null
```

## Production Notes

- The HTTP service in this template is a verifier for the upstream core package, not the full Understand Anything plugin command surface.
- The upstream `/understand` workflow is a multi-agent code analysis pipeline. Running it in production requires installing the plugin into a supported AI coding tool and providing that tool's normal model/provider configuration.
- The default Phala template does not configure Claude Code, Codex, Cursor, Copilot, Gemini CLI, OpenCode, Hermes, Cline, Trae, or Nanobot.
- To analyze a private repository on Phala Cloud, adapt the image or startup command to fetch or include that repository inside the container. Do not rely on host bind mounts.
- Add any future repository or provider credentials only through Phala environment configuration as placeholder variables. Do not write real secrets into Compose files or READMEs.
- Pin `UNDERSTAND_ANYTHING_REF` to a reviewed commit for reproducible deployments.
- The demo endpoints are unauthenticated. Add an authenticated reverse proxy before exposing private code intelligence APIs.

## Cleanup

For a local test run from the parent worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/egonex-ai-understand-anything/docker-compose.yml down
```
