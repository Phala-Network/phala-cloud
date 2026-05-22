# microsoft/JARVIS on Phala Cloud

## Metadata

- Template ID: `jarvis`
- Display name: `microsoft/JARVIS`
- Category: Agent Frameworks & Orchestration
- Upstream repository: `https://github.com/microsoft/JARVIS`
- Description: HuggingGPT/JARVIS connects LLMs with Hugging Face models as tools.
- Default resources: 2 vCPU, 4096 MB memory, 40 GB disk

## What This Template Runs

This template runs a CPU-safe HTTP demo for JARVIS/HuggingGPT. It does not start the full JARVIS inference stack, does not download Hugging Face models, does not require a GPU, and does not require OpenAI or Hugging Face credentials for the default smoke path.

At startup, the container fetches selected files from the upstream `microsoft/JARVIS` repository at the pinned commit `7624cf388b47334ff8a0868e7d862dde18cfda86` and verifies their SHA-256 hashes and JARVIS-specific content markers:

- `README.md`
- `hugginggpt/server/awesome_chat.py`
- `hugginggpt/server/configs/config.lite.yaml`
- `hugginggpt/server/requirements.txt`

The HTTP API then exposes a small verification surface that is suitable for a Phala Cloud `tdx.small` deployment.

## Services And Ports

- `jarvis`: Python 3.11 stdlib HTTP server and upstream source verifier.
- Public port: `8080`
- Container port: `8080`

No proxy sidecar is used because the demo exposes one small HTTP service directly on port `8080`.

## Environment Variables

The default demo has no required secrets.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `JARVIS_REF` | No | `7624cf388b47334ff8a0868e7d862dde18cfda86` | Git ref fetched from `microsoft/JARVIS`. The default pinned commit is verified with strict SHA-256 hashes. Other refs are checked for expected JARVIS content markers. |
| `OPENAI_API_KEY` | No | empty | Not used by the default demo. Add a real value only when extending this template to run real JARVIS/HuggingGPT. |
| `HUGGINGFACE_ACCESS_TOKEN` | No | empty | Not used by the default demo. Add a real value only when extending this template to call Hugging Face provider endpoints or gated models. |

Never place real secrets directly in `docker-compose.yml` or this README. Use Phala Cloud environment variables or another secret-management path.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `jarvis` prebuilt template.
2. Keep the default resources unless you are replacing the demo with a real JARVIS deployment.
3. Leave `OPENAI_API_KEY` and `HUGGINGFACE_ACCESS_TOKEN` empty for the default verifier demo.
4. Deploy the CVM.
5. Open the generated public endpoint for port `8080`.

The first startup performs small GitHub raw-file downloads and should complete quickly. It does not install Python packages or model weights.

## Usage Endpoints

Set the base URL to your Phala Cloud endpoint or local Docker endpoint:

```bash
export JARVIS_URL=https://<your-app-domain>
```

Health check:

```bash
curl -sS "$JARVIS_URL/healthz"
```

Demo and upstream verification report:

```bash
curl -sS "$JARVIS_URL/demo"
```

OpenAI-compatible model-list shape for smoke testing clients:

```bash
curl -sS "$JARVIS_URL/v1/models"
```

Expected `/v1/models` response shape:

```json
{
  "object": "list",
  "data": [
    {
      "id": "microsoft-jarvis-upstream-verifier",
      "object": "model",
      "owned_by": "microsoft/JARVIS"
    }
  ]
}
```

This endpoint is a compatibility smoke response only. It does not provide chat completions or model inference.

## Local Smoke Verification

From this template directory:

```bash
docker compose config
docker compose up -d
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS http://127.0.0.1:8080/demo
curl -fsS http://127.0.0.1:8080/v1/models
docker compose down
```

A healthy deployment returns HTTP `200` from all three endpoints. `/demo` should show `strict_hashes: true` when using the default pinned upstream commit.

## Phala Smoke Verification

After deployment, replace `<your-app-domain>` with the Phala-assigned public URL:

```bash
curl -i https://<your-app-domain>/healthz
curl -i https://<your-app-domain>/demo
curl -i https://<your-app-domain>/v1/models
```

If the container is still starting, retry after a few seconds. If GitHub raw-file access is blocked, startup verification will fail and the container will restart rather than presenting an unverified demo.

## Security Notes

- The default compose file uses the public `python:3.11-slim-bookworm` image.
- The template uses no host bind mounts, privileged mode, host networking, Docker socket, `env_file`, or external build context.
- The demo drops `NET_RAW` and `NET_ADMIN` and sets `no-new-privileges`.
- The public API does not echo secret values or report whether optional credential variables are set.
- The default demo downloads only small source and documentation files from GitHub raw content. It does not download model weights.
- Real JARVIS mode may call OpenAI, Azure OpenAI, Hugging Face Inference Endpoints, or local model servers depending on the upstream configuration you choose.

## Extending To Real JARVIS

The upstream JARVIS/HuggingGPT README documents several modes:

- `config.lite.yaml`: no local expert-model downloads, but still requires an OpenAI key and a Hugging Face token to run the real planner and remote model calls.
- `config.default.yaml`: can require local or hybrid model deployments.
- Local and hybrid deployments can require substantial GPU, memory, disk, model downloads, and provider credentials.

To turn this demo into a real JARVIS deployment, replace the inline verifier command with a JARVIS runtime that installs the upstream server dependencies, provides a real upstream config, and starts `hugginggpt/server/awesome_chat.py` or the appropriate web/Gradio entrypoint. Provide credentials through environment variables such as:

```bash
OPENAI_API_KEY=<your-openai-api-key>
HUGGINGFACE_ACCESS_TOKEN=<your-hugging-face-token>
```

For local or hybrid inference, increase resources based on the selected model set. The upstream README lists examples requiring 24 GB or more VRAM, more than 12 GB RAM, and hundreds of GB of disk for the default local model downloads.

## Cleanup

Local cleanup:

```bash
docker compose down
```

No named Docker volumes are created by the default demo.

## Attribution

- Upstream project: `microsoft/JARVIS`, MIT licensed, maintained by Microsoft.
- Icon: `jarvis.png`, downloaded from the upstream repository asset `hugginggpt/assets/logo.png` and stored locally in `templates/icons/jarvis.png`.
