# openai/plugins on Phala Cloud

Deploy a CPU-safe verifier for the `openai/plugins` Codex plugin collection on Phala Cloud.

## Overview

`openai/plugins` is not a standalone inference server, hosted SaaS client, or deployable web app. The upstream README describes a curated collection of Codex plugin examples where each plugin lives under `plugins/<name>/` with a required `.codex-plugin/plugin.json` manifest and optional surfaces such as `skills/`, `.app.json`, `.mcp.json`, plugin-level `agents/`, `commands/`, `hooks.json`, `assets/`, and supporting files.

This template runs a deterministic HTTP verifier. At startup it downloads the real upstream GitHub source tarball pinned by `OPENAI_PLUGINS_REF`, extracts it inside the container, scans top-level Codex plugin manifests, and exposes JSON inventory endpoints. It does not install plugins into a Codex or IDE profile, does not perform browser auth, does not call OpenAI or other model providers, does not download model weights, and does not require credentials.

## Metadata

- Template id: `plugins`
- Display name: `openai/plugins`
- Description: OpenAI Plugins
- Category: AI Apps & Workflows
- Upstream repository: https://github.com/openai/plugins
- Inspected upstream commit: `2cb26e7b390c98465211b3083e84d23945c1ae3e`
- Runtime source artifact: `https://codeload.github.com/openai/plugins/tar.gz/<OPENAI_PLUGINS_REF>`
- Runtime image: `python:3.12-slim-bookworm`
- Icon source: upstream `plugins/openai-developers/assets/openai-platform.png` from `openai/plugins` commit `2cb26e7b390c98465211b3083e84d23945c1ae3e`
- Phala prebuilt source: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/plugins
- Upstream author: OpenAI, via the `openai/plugins` GitHub repository

## What This Template Runs

The compose file starts two services:

- `app`: internal Python HTTP service on port `8000`. It downloads and extracts the upstream source tarball, parses `plugins/*/.codex-plugin/plugin.json`, summarizes plugin categories, authors, licenses, capabilities, and optional surfaces, then serves JSON endpoints.
- `proxy`: public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

The verifier checks:

- The upstream source tarball downloads successfully.
- The root upstream README exists.
- Top-level plugin directories under `plugins/` contain valid `.codex-plugin/plugin.json` manifests.
- Fixture manifests inside `plugins/plugin-eval/fixtures/` are detected separately and are not counted as top-level installable plugin bundles.
- Highlighted examples from the upstream README, such as `figma`, `notion`, `build-ios-apps`, `build-macos-apps`, `build-web-apps`, `expo`, `netlify`, and `remotion`, are present when available in the selected ref.

## What This Template Does Not Run

The default deployment does not require or use:

- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, or other model-provider credentials
- Browser login, OAuth, marketplace, or IDE profile authentication
- Hosted LLM calls
- Model downloads or local model weights
- GPU access
- Host bind mounts
- Docker socket access
- Privileged mode, host networking, or host IPC
- `env_file`
- Real API keys, tokens, private keys, OTPs, or passwords

The only network access needed by the default startup path is downloading the pinned upstream GitHub source tarball.

## Endpoints

The public HTTP API is available through Caddy on port `8080`.

- `GET /healthz`: Returns `200` when the upstream source artifact downloaded and the manifest scan passed.
- `GET /demo`: Returns deterministic local plugin inventory, highlighted examples, OpenAI-authored samples, manifest statistics, and safety flags.
- `GET /plugins`: Returns top-level plugin manifest summaries. Optional query params: `limit` from `1` to `200`, and `offset` from `0`.
- `GET /v1/models`: Returns an OpenAI-shaped model-list response with one metadata-only id, `openai-plugins/no-model-source-verifier`. It does not represent a hosted model.
- `GET /upstream`: Returns upstream attribution, inspected commit, runtime ref, icon source, README summary, and production notes.
- `GET /`: Same readiness payload as `/healthz`.

Example endpoint checks:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/plugins?limit=10
curl -fsS https://<your-app-domain>/v1/models
curl -fsS https://<your-app-domain>/upstream
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "mode": "local-deterministic-codex-plugin-manifest-scan",
  "checks": {
    "source_artifact_downloaded": true,
    "provider_credentials_read": false,
    "provider_request_attempted": false,
    "plugin_installation_attempted": false
  },
  "safety": {
    "cpu_only": true,
    "credentials_required": false,
    "model_provider_calls": false,
    "model_downloads": false
  }
}
```

Expected `/v1/models` shape:

```json
{
  "object": "list",
  "data": [
    {
      "id": "openai-plugins/no-model-source-verifier",
      "object": "model",
      "owned_by": "openai"
    }
  ]
}
```

## Environment Variables

No credentials are required for the bundled verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `OPENAI_PLUGINS_REF` | No | `2cb26e7b390c98465211b3083e84d23945c1ae3e` | Upstream git commit, branch, or tag used to download the `openai/plugins` source tarball at startup. The default pins the inspected upstream commit. |
| `APP_PORT` | No | `8000` | Internal app port. Caddy proxies to this port; the host only exposes `8080:80`. |

Provider keys and browser session tokens are intentionally not defined or consumed by this verifier. Add secrets only if you replace the verifier with a custom service that deliberately installs or runs credentialed plugin workflows.

## Deploy

1. Deploy the `plugins` prebuilt template on Phala Cloud.
2. Keep the default CPU-only resource profile for the verifier: 1 vCPU, 1024 MB memory, and 10 GB disk.
3. Optionally set `OPENAI_PLUGINS_REF` to another reviewed upstream commit, branch, or tag.
4. Wait for startup to complete while the container downloads and scans the upstream source artifact.
5. Open `https://<your-app-domain>/healthz`, `https://<your-app-domain>/demo`, and `https://<your-app-domain>/v1/models`.

The first startup can take a few minutes because the source artifact contains many plugin bundles and reference files. No model weights or datasets are downloaded.

## Smoke Verification Commands

Run these commands from the parent monorepo worktree to verify the template metadata, compose syntax, and source-verifier endpoints:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/plugins/docker-compose.yml config >/dev/null
```

If Docker Engine is available locally, run the endpoint smoke test:

```bash
docker compose -f templates/prebuilt/plugins/docker-compose.yml up -d
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo | jq '.ok, .checks.top_level_manifests_scanned, .checks.provider_request_attempted'
curl -fsS 'http://localhost:8080/plugins?limit=5' | jq '.total, .data[].id'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
docker compose -f templates/prebuilt/plugins/docker-compose.yml down
```

Expected results:

- `/healthz` returns `200 OK`.
- `/demo` reports `source_artifact_downloaded: true`.
- `/demo` reports `provider_request_attempted: false`.
- `/demo` reports `plugin_installation_attempted: false`.
- `/v1/models` includes `openai-plugins/no-model-source-verifier`.

## Production Notes

- This is a source verifier, not a Codex plugin marketplace, plugin installer, hosted agent runtime, or inference server.
- Real plugin usage happens inside Codex or another supported agent environment after installing a plugin bundle into that environment.
- Many upstream plugins expose app connectors, MCP servers, skills, hooks, or workflow instructions that may require credentials or browser/service authentication when used for real work.
- The verifier proves that the selected upstream source artifact is reachable and contains valid top-level Codex plugin manifests. It does not prove that any individual plugin's external service credentials, connector runtime, or desktop integration works.
- The demo API is unauthenticated. Add an authenticated reverse proxy or application-level auth before adapting it for private source analysis or internal plugin inventories.
- Pin `OPENAI_PLUGINS_REF` to a reviewed commit for reproducible production checks.
- Do not hard-code real API keys, tokens, private keys, OTPs, passwords, or browser cookies in the compose file, README, or application code.
- The compose file does not mount host paths, use `env_file`, request privileged mode, use host networking or host IPC, mount the Docker socket, define GPUs, or include credentials.

## Upstream Attribution

OpenAI Plugins is developed in the `openai/plugins` repository: https://github.com/openai/plugins.

The icon saved as `templates/icons/plugins.png` is the upstream `plugins/openai-developers/assets/openai-platform.png` file from commit `2cb26e7b390c98465211b3083e84d23945c1ae3e`. The upstream README and `plugins/openai-developers/README.md` were inspected to confirm that this repository is a Codex plugin collection rather than a standalone deployable server.
