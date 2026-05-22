# FastChat on Phala Cloud

FastChat is the LMSYS open platform for LLM training, serving, and evaluation. It includes a controller, model worker runtime, web interfaces, and an OpenAI-compatible REST API server.

This Phala Cloud template runs a CPU-safe FastChat API demo. By default it starts the real `fschat==0.2.36` Python package with a local FastChat controller and `fastchat.serve.openai_api_server`, but it does not start any model worker. That means the default deployment exposes no private model weights, downloads no model weights, requires no Hugging Face token, and requires no API key.

## Services

- `fastchat`: installs `fschat==0.2.36`, starts the FastChat controller on the container loopback interface, then starts the OpenAI-compatible API server on container port `8000`.
- `proxy`: Caddy reverse proxy that publishes host port `8080` and forwards requests to the FastChat API server.

## Deploy

1. Open Phala Cloud and create a new deployment from the FastChat prebuilt template.
2. Keep the default `tdx.small`-friendly resources unless you plan to add model workers.
3. Deploy the CVM.
4. Open the generated public endpoint for port `8080`.

The first startup installs the pinned FastChat package and its API-server dependencies, so the container can take a few minutes before the API is ready.

## Use

The public endpoint exposes FastChat's OpenAI-compatible API surface through Caddy:

```bash
export FASTCHAT_URL=https://<your-app-domain>
curl -sS "$FASTCHAT_URL/v1/models"
```

Because the default demo has no model worker, the response should be an OpenAI-compatible model list with an empty `data` array:

```json
{
  "object": "list",
  "data": []
}
```

## Verify

Use the public endpoint assigned by Phala Cloud:

```bash
curl -i https://<your-app-domain>/v1/models
```

A healthy demo returns HTTP `200` with a JSON model-list response. If you query immediately after deployment, retry after the FastChat package installation and controller startup finish.

## Extending With Model Workers

For real inference, add one or more FastChat model workers and point them at the controller address used by this template:

```bash
python -m fastchat.serve.model_worker \
  --controller-address http://fastchat:21001 \
  --model-path <model-id-or-local-path>
```

Model-worker requirements depend on the selected model. Large models can require GPUs, more CPU and memory, larger disks, long model downloads, and a Hugging Face token or other provider credentials for gated/private models. Add only the environment variables and volumes required by the model you choose, and avoid placing real tokens or private keys directly in the compose file.

After a worker registers successfully, `/v1/models` should include the served model id and OpenAI-compatible chat/completions calls can target it.

## Environment Variables

The default demo does not define any required or optional environment variables. It requires no API key, no Hugging Face token, and no private model credentials.

## Attribution

- Upstream project: [lm-sys/FastChat](https://github.com/lm-sys/FastChat), maintained by LMSYS Org / lm-sys.
- Icon: `fastchat.jpeg`, sourced from the upstream FastChat repository asset [`assets/vicuna_logo.jpeg`](https://github.com/lm-sys/FastChat/blob/main/assets/vicuna_logo.jpeg), associated with FastChat/Vicuna.
