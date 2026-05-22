# mozilla-ai/llamafile

Deploy a CPU-safe llamafile inference server on Phala Cloud.

This template runs Mozilla.ai's `llamafile` HTTP server in demo mode behind a Caddy reverse proxy. At startup it downloads the official `llamafile-0.10.1-thin` runtime and a tiny public GGUF smoke-test model into a named Docker volume, then starts the llama.cpp-compatible server on internal port `8080`. Caddy publishes the public HTTP app endpoint on host port `8080` and proxies to the internal llamafile service.

The default model is intentionally tiny so it can start on small CPU-only CVMs. It is useful for deployment verification, not assistant-quality inference. For a real model, replace `MODEL_URL` and `MODEL_FILE` together, or point `LLAMAFILE_URL` and `LLAMAFILE_BIN` at a prebuilt bundled `.llamafile`.

## Upstream

- Project: [mozilla-ai/llamafile](https://github.com/mozilla-ai/llamafile)
- Documentation: [docs.mozilla.ai/llamafile](https://docs.mozilla.ai/llamafile)
- Runtime binary: [`llamafile-0.10.1-thin`](https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/main/llamafile-0.10.1-thin)
- Default demo model: [`stories260K-f32.gguf`](https://huggingface.co/ggml-org/test-model-stories260K/resolve/main/stories260K-f32.gguf)
- Template id: `llamafile`
- Category: `LLM Inference & Model Serving`

`llamafile` is a Mozilla Builders / Mozilla.ai project that packages llama.cpp-style model serving into portable single-file executables.

## Services

- `llamafile`: Downloads the configured runtime and model into `llamafile_data`, then runs `llamafile --server`.
- `proxy`: Publishes the app through Caddy on port `8080` and reverse proxies to `llamafile`.

## Environment Variables

All variables are optional for the default smoke-test deployment.

| Variable | Default | Description |
| --- | --- | --- |
| `LLAMAFILE_URL` | `https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/main/llamafile-0.10.1-thin` | Public HTTPS URL for the llamafile runtime or bundled `.llamafile` downloaded at startup. |
| `LLAMAFILE_BIN` | `llamafile-0.10.1-thin` | Plain file name used inside `/data` for the downloaded runtime. Use only a file name, not a path. |
| `MODEL_URL` | `https://huggingface.co/ggml-org/test-model-stories260K/resolve/main/stories260K-f32.gguf` | Public HTTPS URL for the GGUF model downloaded at startup. Set both `MODEL_URL` and `MODEL_FILE` to empty strings when `LLAMAFILE_URL` points to a bundled `.llamafile` that already contains weights. |
| `MODEL_FILE` | `stories260K-f32.gguf` | Plain file name used inside `/data` for the downloaded model. Use only a file name, not a path. Set both `MODEL_URL` and `MODEL_FILE` to empty strings for bundled `.llamafile` model executables. |
| `HOST` | `0.0.0.0` | Listen address inside the container. Keep this default on Phala Cloud. |
| `PORT` | `8080` | Internal llamafile HTTP server port. Caddy proxies to this port; the public app endpoint is published by the proxy on host port `8080`. |
| `CTX_SIZE` | `512` | Context size for the demo server. Increase only when the selected model and CVM memory can support it. |
| `THREADS` | `1` | CPU worker threads. The default is conservative for small CVMs. |
| `N_PREDICT` | `64` | Default generation limit for requests that do not specify their own limit. |

The template does not require API keys or private credentials. If you use private model hosting, do not paste tokens into these URLs; use public, license-compatible model artifacts for shared template deployments.

## Deploy on Phala Cloud

1. Create a new Phala Cloud deployment from this template.
2. Keep the default environment variables for the first smoke test.
3. Deploy the CVM.
4. Wait for the `llamafile` container to download the runtime and model and for the `proxy` service to start.
5. Open `https://<your-app-domain>` or send API requests to that domain.

## Usage

The service exposes the llama.cpp web UI and HTTP APIs. The OpenAI-compatible base URL is:

```text
https://<your-app-domain>/v1
```

List the loaded model:

```bash
curl -fsS https://<your-app-domain>/v1/models
```

Send an OpenAI-compatible chat request:

```bash
curl -fsS https://<your-app-domain>/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "LLaMA_CPP",
    "messages": [
      {
        "role": "user",
        "content": "Say hello from llamafile in one short sentence."
      }
    ],
    "max_tokens": 24,
    "temperature": 0.2
  }'
```

Native llama.cpp completion requests also work:

```bash
curl -fsS https://<your-app-domain>/completion \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Once upon a time",
    "n_predict": 16,
    "temperature": 0.2
  }'
```

## Verify

Concrete smoke check after deployment:

```bash
curl -fsS https://<your-app-domain>/health
```

Expected result: a successful HTTP response through the Caddy proxy to the llamafile server. You can then run the `/v1/models` command above to confirm the model endpoint is responding.

## Using Another Model

The default runtime uses `llamafile-0.10.1-thin` plus external GGUF weights. To use Mozilla.ai's smallest current prebuilt bundled llamafile instead, set:

| Variable | Value |
| --- | --- |
| `LLAMAFILE_URL` | `https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/main/Qwen3.5-0.8B-Q8_0.llamafile` |
| `LLAMAFILE_BIN` | `Qwen3.5-0.8B-Q8_0.llamafile` |
| `MODEL_URL` | empty string |
| `MODEL_FILE` | empty string |

To use the thin runtime with larger external GGUF weights, keep `LLAMAFILE_URL` as the default and set `MODEL_URL` plus `MODEL_FILE` to the public GGUF artifact you want. Increase CPU, memory, and disk before deploying larger models.

## Security Notes

- The HTTP API is unauthenticated by default. Add access control at your ingress layer before exposing useful models or sensitive prompts.
- Use only public model URLs you trust, and review model licenses before production use.
- Do not store API keys, tokens, passwords, private keys, or signed private download URLs in template variables.
- Larger models can exhaust memory or disk on small CVMs. Scale resources together with model size and context length.

## Persistent Data

- `llamafile_data`: Named Docker volume mounted at `/data`. It stores the downloaded runtime and model across container restarts.

## Icon Source

The template icon is `llamafile.png`, copied from the upstream repository image [`docs/images/llamafile-640x640.png`](https://github.com/mozilla-ai/llamafile/blob/main/docs/images/llamafile-640x640.png).
