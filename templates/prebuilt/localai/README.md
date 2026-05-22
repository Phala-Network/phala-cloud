# mudler/LocalAI on Phala Cloud

Deploy LocalAI on Phala Cloud using the official CPU-only `localai/localai:latest-cpu` container image.

Upstream project: [mudler/LocalAI](https://github.com/mudler/LocalAI). LocalAI provides an OpenAI-compatible API and built-in web interface for running local models without external API services.

This template is designed for a CPU-only `tdx.small` smoke test. It downloads a tiny public GGUF test model and registers it as `localai-smoke` so `GET /v1/models` works without API keys, private model URLs, or external secrets.

## Services

- `model-init`: Downloads the tiny public GGUF smoke-test model into the `localai_models` volume.
- `localai`: Runs LocalAI with the CPU image and exposes the OpenAI-compatible API and web UI.

## Ports

- `8080`: LocalAI HTTP server, including the OpenAI-compatible `/v1/*` API and web interface.

## Model setup

The compose file creates an inline LocalAI model configuration:

- Model name: `localai-smoke`
- Backend: `llama-cpp`
- Model file: `stories260K-f32.gguf`
- Context size: `512`
- Threads: `1`

The default model comes from the public [ggml-org/test-model-stories260K](https://huggingface.co/ggml-org/test-model-stories260K) repository. It is only intended to verify deployment wiring and endpoint availability, not to serve useful assistant responses.

## Persistent data

The template creates one named Docker volume:

- `localai_models`: mounted at `/models` for the downloaded GGUF model and model data.

No host bind mounts are used.

## Deploy

1. Deploy the prebuilt `localai` template on Phala Cloud.
2. Wait for `model-init` to finish downloading the tiny smoke-test model.
3. Wait for the `localai` service to become healthy.
4. Open the public endpoint assigned to port `8080`.

For local Docker Compose testing:

```bash
docker compose -f templates/prebuilt/localai/docker-compose.yml config
docker compose -f templates/prebuilt/localai/docker-compose.yml up -d
```

## Verify

Use the OpenAI-compatible model list endpoint as the lightweight smoke test:

```bash
curl -fsS http://localhost:8080/v1/models
```

For a Phala Cloud deployment, use the public URL assigned to port `8080`:

```bash
curl -fsS https://<your-app-domain>/v1/models
```

The response should include the `localai-smoke` model after LocalAI has started.

You can also check readiness and logs:

```bash
curl -fsS http://localhost:8080/readyz
docker compose -f templates/prebuilt/localai/docker-compose.yml logs localai
```

## OpenAI-compatible usage

After the smoke endpoint is healthy, clients can use the deployment as an OpenAI-compatible API base URL:

```bash
curl -fsS http://localhost:8080/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "localai-smoke",
    "prompt": "Once upon a time",
    "max_tokens": 16,
    "temperature": 0.2
  }'
```

Replace `http://localhost:8080` with `https://<your-app-domain>` when calling a Phala Cloud deployment.

## Operational notes

- The CPU image avoids GPU-specific runtimes and is appropriate for a small CPU-only smoke deployment.
- The default model is intentionally tiny. Replace it with a real GGUF model and increase CVM resources before production inference.
- Larger models can exhaust memory or disk on small CVMs. Size the model, context window, threads, memory, and disk together.
- LocalAI is exposed without authentication by default in this template. Add API keys, LocalAI auth, or ingress access control before exposing it to untrusted traffic.
- Do not place API keys, private model URLs, or other secrets in template examples or shared compose files.

## Icon source

The template icon is `localai.svg`, copied from the upstream LocalAI repository asset [`docs/assets/images/logos/logo.svg`](https://github.com/mudler/LocalAI/blob/master/docs/assets/images/logos/logo.svg).
