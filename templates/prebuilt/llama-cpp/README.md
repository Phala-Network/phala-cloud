# ggerganov/llama.cpp

Deploy a CPU-safe llama.cpp inference server on Phala Cloud.

This template runs the official `ghcr.io/ggml-org/llama.cpp:server` image and downloads a tiny public GGUF model into a named Docker volume before starting `llama-server`. The service exposes the llama.cpp HTTP API, including OpenAI-compatible endpoints, through a Caddy reverse proxy.

## Upstream

- Project: [ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp)
- Original queued repository: [ggerganov/llama.cpp](https://github.com/ggerganov/llama.cpp)
- Runtime image: `ghcr.io/ggml-org/llama.cpp:server`
- Demo model: [ggml-org/test-model-stories260K](https://huggingface.co/ggml-org/test-model-stories260K)

`llama.cpp` is maintained by ggml-org and originated with Georgi Gerganov (`ggerganov`).

## Services

- `model-init`: Downloads the configured GGUF model into the `llama_models` volume.
- `llama-server`: Runs the llama.cpp HTTP server on the internal Docker network.
- `proxy`: Publishes the server through Caddy on port `8080`.

## Environment Variables

All variables are optional for the smoke-test deployment.

| Variable | Default | Description |
| --- | --- | --- |
| `MODEL_URL` | `https://huggingface.co/ggml-org/test-model-stories260K/resolve/main/stories260K-f32.gguf` | Public HTTPS URL for the GGUF model downloaded at startup. Use only model URLs you trust. |
| `MODEL_FILE` | `stories260K-f32.gguf` | File name used inside the `/models` volume. Use a plain file name, not a path. |
| `LLAMA_ARG_MODEL` | empty | Optional explicit model path passed to `llama-server`. Leave empty to use `/models/$MODEL_FILE`. |
| `LLAMA_ARG_CTX_SIZE` | `512` | Context size for the demo server. Increase only when the model and CVM memory can support it. |
| `LLAMA_ARG_HOST` | `0.0.0.0` | Listen address inside the container. Keep this default on Phala Cloud. |
| `LLAMA_ARG_PORT` | `8080` | Internal llama.cpp server port. Caddy uses the same value for proxying. |
| `LLAMA_ARG_THREADS` | `1` | CPU worker threads. The default is conservative for small CVMs. |
| `LLAMA_ARG_N_PREDICT` | `64` | Default generation limit for llama.cpp requests that do not specify their own limit. |

The defaults are intentionally small so the template can smoke test on a CPU-only deployment. For a real model, set `MODEL_URL`, `MODEL_FILE`, and resource sizing together. If you reuse the same `MODEL_FILE` with a different `MODEL_URL`, clear the `llama_models` volume or use a new file name so the initializer downloads the new model.

## Deploy on Phala Cloud

1. Create a new Phala Cloud deployment from this template.
2. Keep the default environment variables for the first smoke test.
3. Deploy the CVM.
4. Wait for `model-init` to finish and for `llama-server` to become healthy.
5. Open `https://<your-app-domain>` or send API requests to that domain.

## Verify

Health check:

```bash
curl -fsS https://<your-app-domain>/health
```

List the loaded model through the OpenAI-compatible API:

```bash
curl -fsS https://<your-app-domain>/v1/models
```

OpenAI-compatible completion request:

```bash
curl -fsS https://<your-app-domain>/v1/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "local",
    "prompt": "Once upon a time",
    "max_tokens": 16,
    "temperature": 0.2
  }'
```

Native llama.cpp completion request:

```bash
curl -fsS https://<your-app-domain>/completion \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Once upon a time",
    "n_predict": 16,
    "temperature": 0.2
  }'
```

The default model is a tiny test model for deployment verification, not a useful assistant. Replace it with a production GGUF model for real inference.

## Security Notes

- Do not put API keys, private model URLs, tokens, or credentials in examples, screenshots, or shared template settings.
- `MODEL_URL` is fetched by the deployment. Only use models from publishers you trust, and review the model license and provenance before production use.
- The template exposes an unauthenticated HTTP API by default. Add access control at your ingress layer or deploy behind a protected gateway before serving sensitive workloads.
- Treat prompts and completions as application data. Do not send confidential information to a model or endpoint unless your own threat model allows it.
- Larger models can exhaust memory or disk on small CVMs. Increase `defaultResource`-equivalent deployment resources when changing the model.

## Persistent Data

- `llama_models`: Named Docker volume mounted at `/models`. It stores the downloaded GGUF model across container restarts.

## Icon Source

The template icon is `llama-cpp.svg`, copied from the upstream llama.cpp repository asset [`media/llama1-icon-transparent.svg`](https://github.com/ggml-org/llama.cpp/blob/master/media/llama1-icon-transparent.svg).
