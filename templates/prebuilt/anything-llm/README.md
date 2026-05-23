# Mintplex-Labs/anything-llm on Phala Cloud

Deploy AnythingLLM on Phala Cloud using the official `mintplexlabs/anythingllm:latest` Docker image.

AnythingLLM is an all-in-one private AI app for workspaces, RAG over documents, agents, multi-user access, and configurable LLM providers. This template starts the web application on a CPU-only `tdx.small` sized deployment without bundling a model, downloading model weights, or requiring hosted provider credentials at startup.

## Upstream

- Upstream repository: [Mintplex-Labs/anything-llm](https://github.com/Mintplex-Labs/anything-llm)
- Upstream Docker guide: [docker/HOW_TO_USE_DOCKER.md](https://github.com/Mintplex-Labs/anything-llm/blob/master/docker/HOW_TO_USE_DOCKER.md)
- Upstream image: `mintplexlabs/anythingllm`
- Category: LLM Application Platforms & Low-Code Builders
- Template icon: `anything-llm.png`, copied from the upstream product asset [`frontend/src/media/logo/anything-llm-icon.png`](https://github.com/Mintplex-Labs/anything-llm/blob/master/frontend/src/media/logo/anything-llm-icon.png)

## Services

- `anything-llm`: AnythingLLM server, frontend, document collector, local LanceDB-backed storage defaults, and provider configuration UI.

## Ports

- `3001`: Public HTTP endpoint for the AnythingLLM web app and API.

## Persistent Data

The template creates one named Docker volume:

- `anythingllm_storage`: mounted at `/app/server/storage` for app data, uploaded documents, vector data, local database files, and the managed AnythingLLM `.env`.

AnythingLLM writes provider settings changed from the UI into `/app/server/.env`. The compose entrypoint stores that file in the named storage volume and symlinks it back into `/app/server/.env`, so UI-based settings survive container replacement without using a host bind mount.

## Environment Variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `SERVER_PORT` | No | `3001` | Fixed by the template so AnythingLLM listens on the exposed container port. |
| `STORAGE_DIR` | No | `/app/server/storage` | Fixed by the template so AnythingLLM persists data in the named volume. |
| `DISABLE_TELEMETRY` | No | `true` | Opts out of AnythingLLM telemetry by default. Set to `false` if you want upstream telemetry enabled. |
| `AUTH_TOKEN` | No | unset | Optional password gate for a remotely hosted instance. Generate a long random value and keep it stable across redeploys. |
| `JWT_SECRET` | No | unset | JWT signing secret used when `AUTH_TOKEN` is enabled. Generate with `openssl rand -hex 32` and keep it stable. |

No LLM provider key is required for the container to start. Add provider credentials after deployment in the AnythingLLM settings UI, or provide supported upstream environment variables in a custom deployment if you want them managed outside the UI.

## Deploy On Phala Cloud

1. Select the prebuilt `anything-llm` template.
2. Keep the default `tdx.small`-safe resources for the first deployment: 2 vCPU, 2 GB memory, and 20 GB disk.
3. Optionally set `AUTH_TOKEN` and `JWT_SECRET` before deploying if the instance will be reachable by untrusted users.
4. Deploy the template.
5. Open `https://<your-app-domain>` and complete AnythingLLM onboarding.
6. Configure an LLM provider from the AnythingLLM settings UI before creating production workspaces or agents.

For local Docker Compose validation from the repository root:

```bash
docker compose -f templates/prebuilt/anything-llm/docker-compose.yml config
```

## Usage

After the web app is reachable:

1. Complete the first-run setup.
2. Open the workspace settings and configure an LLM provider such as OpenAI, Anthropic, Gemini, Ollama, LM Studio, LocalAI, or another provider supported by AnythingLLM.
3. Configure the embedding provider if you do not want AnythingLLM's default local embedding behavior.
4. Create a workspace, upload documents, and use chat, RAG, agent, and workspace features from the web UI.

When connecting AnythingLLM to a provider running outside the container, use a network-reachable URL from inside the Phala CVM. A `localhost` URL normally points back to the AnythingLLM container, not to your laptop or another remote host.

## Verification

Use `/api/ping` as the lightweight smoke endpoint. It does not require an LLM provider or API key.

Local check:

```bash
curl -fsS http://localhost:3001/api/ping
```

Phala Cloud check:

```bash
curl -fsS https://<your-app-domain>/api/ping
```

Expected response:

```json
{"online":true}
```

The compose healthcheck probes the same endpoint inside the container.

## Operational Notes

- This template uses the official upstream image but replaces the upstream host bind mount with a named Docker volume suitable for Phala Cloud prebuilt deployments.
- The default deployment does not download or serve a local LLM model. Size CPU, memory, disk, and provider/model settings together before enabling heavier local workflows.
- AnythingLLM defaults to local LanceDB storage unless you configure another vector database from the UI or environment.
- The template does not request host networking, privileged mode, GPU devices, `env_file`, host-only bind mounts, or an external build context.
- Some advanced browser/collector workflows may need extra Chromium sandbox tuning in custom deployments. The default web app, onboarding, workspace UI, and `/api/ping` smoke endpoint do not require privileged mode.
