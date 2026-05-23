# bentoml/BentoML on Phala Cloud

Deploy a CPU-safe BentoML demo service on Phala Cloud.

## Metadata

- Template id: `bentoml`
- Category: LLM Inference & Model Serving
- Upstream repository: https://github.com/bentoml/BentoML
- Upstream project: BentoML by the BentoML team / `bentoml`
- Phala prebuilt template: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/bentoml
- Python package: https://pypi.org/project/bentoml/
- Icon source: `bentoml.png` is copied from the upstream repository asset [`docs/source/_static/img/bentoml-icon.png`](https://github.com/bentoml/BentoML/blob/main/docs/source/_static/img/bentoml-icon.png)

## What This Template Runs

BentoML is a Python framework for building and deploying AI model serving APIs. The upstream project can package real model services and containerize them for production, but real inference examples often add model downloads, larger memory requirements, GPU requirements, or provider credentials.

This template keeps the default deployment small and CPU-safe. It starts the real `bentoml serve` HTTP server from an inline demo service, exposes BentoML readiness plus two JSON APIs, and does not download or load model weights.

The default demo does not call BentoCloud, require a Hugging Face token, require an API key, request GPU access, or use privileged container features.

## Services

- `app`: Installs the pinned BentoML Python package, mounts the inline `service.py` config, and runs `bentoml serve service.py:PhalaBentoDemo` on container port `3000`.

## Ports

- `8080`: Public HTTP port mapped to the BentoML server on container port `3000`.

## Environment Variables

No credentials are required for the default demo.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `BENTOML_VERSION` | `1.4.39` | No | BentoML Python package version installed at container startup. |

If you adapt this template for real model serving, add only the variables required by your model or backend. Use Phala Cloud secrets or required environment variables for private tokens, and do not hardcode credentials in the compose file or README.

## Deploy

1. Deploy the `bentoml` prebuilt template on Phala Cloud.
2. Keep the default CPU-only resources for the first smoke test.
3. Optionally set `BENTOML_VERSION` to another published BentoML version.
4. Wait for startup to finish. The first boot installs BentoML from PyPI.
5. Open the public endpoint assigned to port `8080`.

## Usage

Use the public Phala Cloud endpoint:

```bash
export BENTOML_URL=https://<your-app-domain>
curl -fsS "$BENTOML_URL/readyz"
curl -fsS "$BENTOML_URL/demo" \
  -H "Content-Type: application/json" \
  -d '{"text":"hello from Phala Cloud"}'
curl -fsS "$BENTOML_URL/metadata" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "framework": "BentoML",
  "cpu_only": true,
  "model_downloaded": false,
  "model_loaded": false,
  "inference_backend": "demo"
}
```

The BentoML server also exposes its generated API UI and schema on the same public endpoint.

## Verification

Run locally from the public `sdks` repository root:

```bash
docker compose -f templates/prebuilt/bentoml/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/bentoml/docker-compose.yml up -d
curl -fsS http://localhost:8080/readyz
curl -fsS http://localhost:8080/demo \
  -H "Content-Type: application/json" \
  -d '{"text":"local smoke"}'
curl -fsS http://localhost:8080/metadata \
  -H "Content-Type: application/json" \
  -d '{}'
docker compose -f templates/prebuilt/bentoml/docker-compose.yml down
```

From this parent monorepo checkout, include the `sdks/` prefix:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/bentoml/docker-compose.yml config >/dev/null
```

A healthy deployment returns HTTP `200` for `/readyz` and JSON from `/demo` showing the BentoML package version and the CPU-only demo status.

## Extending To Real BentoML Services

To serve a real model, replace the inline demo service with your own BentoML service code and add the dependencies, model loading, and resource sizing required by that model. Review model license, memory use, disk use, startup time, and CPU/GPU requirements before deploying.

For private or gated models, provide credentials through Phala Cloud environment variables or secret handling. Do not put real tokens, private keys, API keys, passwords, or private model URLs directly in `docker-compose.yml`.

## Security Notes

- The default demo exposes unauthenticated health and metadata endpoints. Add authentication before exposing real inference or private data.
- The compose file uses no host bind mounts, `env_file`, privileged mode, host networking, host IPC, Docker socket access, or external build context.
- The container opts out of BentoML usage tracking with `--do-not-track` and `BENTOML_DO_NOT_TRACK=true`.
- Pin `BENTOML_VERSION` for reproducible deployments.

## Cleanup

For local Docker Compose testing:

```bash
docker compose -f templates/prebuilt/bentoml/docker-compose.yml down
```

The default demo does not create named volumes.
