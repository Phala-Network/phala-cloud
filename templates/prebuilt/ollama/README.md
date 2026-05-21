# ollama/ollama on Phala Cloud

Deploy Ollama on Phala Cloud using the official public `ollama/ollama:latest` container image.

Upstream project: [ollama/ollama](https://github.com/ollama/ollama). Ollama is a lightweight Go framework for running LLMs locally or on cloud VMs and exposing them through a REST API.

This template starts the Ollama server only. It does not require a GPU, does not pull a model at startup, and is suitable for a CPU-only `tdx.small` smoke test before you add models.

## Services

- `ollama`: Ollama REST API server with persistent model and runtime data.

## Ports

- `11434`: Ollama REST API, mapped to container port `11434`.

The container sets `OLLAMA_HOST=0.0.0.0:11434` so the API listens on all interfaces inside the container.

## Persistent data

The template creates one named Docker volume:

- `ollama`: mounted at `/root/.ollama` for downloaded models, manifests, and Ollama runtime state.

No host bind mounts are used.

## Deploy

1. Deploy the prebuilt `ollama` template on Phala Cloud.
2. Wait for the `ollama` service to start.
3. Open the public endpoint assigned to port `11434`.
4. Run the smoke test below before pulling any models.
5. Pull a model after deployment when you are ready to run inference.

For local Docker Compose testing:

```bash
docker compose config
docker compose up -d
```

## Verify

Use `/api/tags` as the lightweight smoke endpoint:

```bash
curl -fsS http://localhost:11434/api/tags
```

For a Phala Cloud deployment, use the public URL assigned to port `11434`:

```bash
curl -fsS https://<your-app-domain>/api/tags
```

The `/api/tags` endpoint is the lightweight smoke endpoint that works before any model is pulled. On a fresh volume it should return a JSON response with an empty `models` list.

You can also inspect logs:

```bash
docker compose logs ollama
```

## Pull a model after deployment

This template intentionally does not pull a model during startup. Pull models only after the server is healthy, because model downloads can be large and startup should remain fast and CPU-safe.

Example with a small model:

```bash
curl -fsS http://localhost:11434/api/pull \
  -H "Content-Type: application/json" \
  -d '{"name":"llama3.2:1b"}'
```

On Phala Cloud:

```bash
curl -fsS https://<your-app-domain>/api/pull \
  -H "Content-Type: application/json" \
  -d '{"name":"llama3.2:1b"}'
```

After a model is pulled, verify it appears in the tag list:

```bash
curl -fsS http://localhost:11434/api/tags
```

## Usage examples

Generate text after pulling a model:

```bash
curl -fsS http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.2:1b","prompt":"Write one sentence about confidential AI deployments.","stream":false}'
```

OpenAI-compatible chat completions after pulling a model:

```bash
curl -fsS http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.2:1b","messages":[{"role":"user","content":"Reply with a short health check."}]}'
```

Replace `http://localhost:11434` with `https://<your-app-domain>` when calling a Phala Cloud deployment.

## Operational notes

- CPU inference latency depends on model size. Start with a small model on `tdx.small`.
- Keep enough disk space for model files in the named `ollama` volume.
- The Ollama API does not require an API key by default. Add external access controls before exposing it to untrusted traffic.
