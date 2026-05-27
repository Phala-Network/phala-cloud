# TabbyML/tabby on Phala Cloud

Deploy a CPU-safe Tabby source and release verifier on Phala Cloud.

## Metadata

- Template id: `tabby`
- Category: LLM Inference & Model Serving
- Template repository: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/tabby
- Upstream repository: https://github.com/TabbyML/tabby
- Upstream documentation: https://tabby.tabbyml.com/docs/welcome/
- Default source ref: `v0.32.0`
- Icon source: `tabby.png` is copied from the upstream repository asset `ee/tabby-ui/assets/tabby.png` at https://github.com/TabbyML/tabby/blob/v0.32.0/ee/tabby-ui/assets/tabby.png

## What This Template Runs

Tabby is a self-hosted AI coding assistant and open-source, on-premises alternative to GitHub Copilot. Upstream Tabby serves code completion and chat APIs, integrates with IDE extensions, and supports local model serving through the Tabby runtime.

The upstream Docker and Docker Compose quick-start paths are designed for full Tabby serving with selected completion and chat models. They use model identifiers such as `StarCoder-1B` and `Qwen2-1.5B-Instruct`, request GPU devices in the documented CUDA path, and mount `/data` for Tabby state and model data.

This Phala prebuilt template intentionally keeps the default deployment safe for a CPU-only `tdx.small` smoke test. It starts a small Python HTTP service on the public `python:3.11-slim-bookworm` image, fetches a pinned Tabby source ref from GitHub, verifies Tabby CLI, HTTP route, model-download, Docker, and release markers, then exposes JSON endpoints for health and inspection.

The demo does not start the full Tabby server, run `tabby serve`, download model weights, load a model, require hosted provider credentials, request GPU devices, use host bind mounts, or require privileged container features.

## Services

- `app`: Python HTTP source and release verifier exposed on container port `8080`.

## Ports

- `8080`: Public HTTP endpoint for health, demo metadata, and an OpenAI-compatible model-list stub.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `TABBY_REF` | No | `v0.32.0` | Tabby Git release tag, commit, or simple branch ref used for source checks. Release asset checks run when this is a `v*` release tag. |

If you adapt this template for real Tabby inference, add only the variables required by your deployment, models, and access policy. For private repositories, hosted model providers, or gated model downloads, use Phala Cloud secrets or required environment variables. Do not hardcode tokens in `docker-compose.yml` or this README.

## Deploy

1. Deploy the `tabby` prebuilt template on Phala Cloud.
2. Keep the default CPU-only resources for the source and release verifier.
3. Optionally set `TABBY_REF` to another public Tabby release tag, commit, or simple branch ref.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup fetches a small set of public Tabby source files and release metadata from GitHub. No private models, paid credentials, GPU devices, host mounts, Docker socket access, host networking, or privileged container features are required.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the pinned Tabby source files and expected source/release markers were verified.
- `GET /demo`: Returns upstream source metadata and confirms that no Tabby inference server, model download, or model load is running.
- `GET /v1/models`: Returns an OpenAI-compatible model-list shape with an empty `data` array because no model server is running.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "check": "Fetch a pinned Tabby release/source ref and verify CLI, HTTP route, model-download, Docker, and release markers.",
  "cpu_only": true,
  "model_downloaded": false,
  "model_loaded": false,
  "inference_started": false,
  "tabby_server_started": false
}
```

## Smoke Verification

Run locally from the monorepo worktree:

```bash
docker compose -f templates/prebuilt/tabby/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/tabby/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/tabby/docker-compose.yml down
```

Template validation commands from the monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/tabby/docker-compose.yml config >/dev/null
```

## Extending To Real Tabby Serving

For production Tabby, replace the verifier service with an upstream Tabby serving image or binary and size the deployment around the chosen models:

```bash
tabby serve \
  --host 0.0.0.0 \
  --port 8080 \
  --model StarCoder-1B \
  --chat-model Qwen2-1.5B-Instruct \
  --device cuda
```

The upstream Docker documentation uses `registry.tabbyml.com/tabbyml/tabby` and a persistent `/data` mount for full serving. On Phala Cloud, replace host bind mounts with named volumes, pin the image or release version, and add GPU resources only when the selected Phala deployment target supports them.

Before enabling real inference, review:

- Completion model and chat model licenses.
- Model download size and disk requirements.
- CPU latency or GPU memory requirements.
- Whether private or gated model access requires credentials.
- Whether the deployment needs authentication before exposing IDE, chat, or API access.

After a real Tabby server is running, useful upstream endpoints include:

```text
https://<your-app-domain>/v1/health
https://<your-app-domain>/v1beta/models
```

Tabby also exposes completion and chat endpoints when the corresponding models are configured and loaded.

## Security Notes

- The default verifier exposes unauthenticated health and metadata endpoints. Add authentication before exposing real model inference, private repositories, or user data.
- Do not put secrets in `docker-compose.yml`. Use Phala Cloud environment variables or secret handling for credentials.
- The container does not request GPU access, privileged mode, host networking, host IPC, host bind mounts, external build contexts, or Docker socket access.
- Pin `TABBY_REF` to a release tag or commit for reproducible deployments.

## Cleanup

For local Docker Compose testing:

```bash
docker compose -f templates/prebuilt/tabby/docker-compose.yml down
```

The default verifier does not create named volumes. In Phala Cloud, delete the deployment when you no longer need the CVM.
