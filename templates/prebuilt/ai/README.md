# vercel/ai on Phala Cloud

Deploy a `tdx.small-safe` Vercel AI SDK smoke demo on Phala Cloud.

The upstream project lives at [vercel/ai](https://github.com/vercel/ai). The npm package is [`ai`](https://www.npmjs.com/package/ai), a TypeScript AI SDK for streaming, agents, and structured outputs with first-class Vercel support.

This template runs a CPU-only Node.js 22 and Express HTTP service. At startup it installs the real `ai` npm package, imports AI SDK primitives, and exposes deterministic JSON endpoints that require no provider credentials, no hosted LLM calls, no model downloads, no GPU, no browser authentication, no external database, and no host bind mounts.

## Services

- `ai`: Node.js 22 service that installs `ai@$AI_SDK_VERSION`, `express@4.21.2`, and `zod@4.1.13`, then serves HTTP on container port `8000`.

## Ports

- `18080`: Public HTTP port exposed by Phala Cloud and mapped to container port `8000`.

No reverse proxy is included by default. Add one only if your production extension needs authentication, routing, or additional headers.

## Environment Variables

No credentials are required for the default template.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `AI_SDK_VERSION` | No | `6.0.193` | Version of the `ai` npm package installed at container startup. |

Provider credentials are optional for production extensions only. They are not included, required, or read by the default health, demo, stream, or model-list endpoints.

## Deploy

1. Create a new Phala Cloud deployment from the `ai` prebuilt template.
2. Keep the default `tdx.small-safe` resource shape for the smoke demo: about 1 vCPU, 1024 MB memory, and 10 GB disk.
3. Optionally set `AI_SDK_VERSION` to another published `ai` npm package version.
4. Deploy the CVM and open the generated public HTTP endpoint for port `18080`.

The first startup downloads npm packages inside the container, so readiness can take a minute or two on a fresh deployment.

## Endpoints

- `GET /healthz`: Verifies the real AI SDK import, reports the installed package version, and returns `status: "ok"` when imports work.
- `GET /demo?topic=phala%20cloud`: Runs a deterministic local AI SDK tool with `zodSchema` and `jsonSchema`. It does not call `generateText`, `streamText`, `generateObject`, or any provider-backed model API.
- `GET /stream?topic=phala%20cloud`: Consumes local chunks from AI SDK `simulateReadableStream` and returns the chunks as JSON. This is not an LLM stream.
- `GET /v1/models`: Returns an OpenAI-style model list with the local no-provider model id `local-ai-sdk-primitives`.
- `GET /`: Returns service metadata and endpoint links.

## Use

Set your Phala Cloud endpoint:

```bash
export AI_SDK_URL=https://<your-app-domain>
```

Verify imports and package metadata:

```bash
curl -fsS "$AI_SDK_URL/healthz"
```

Run the deterministic local tool demo:

```bash
curl -fsS "$AI_SDK_URL/demo?topic=confidential%20ai"
```

Read local simulated stream chunks:

```bash
curl -fsS "$AI_SDK_URL/stream?topic=structured%20outputs"
```

Check the OpenAI-style local model list:

```bash
curl -fsS "$AI_SDK_URL/v1/models"
```

## Verify Locally

Run from the `sdks/` directory:

```bash
docker compose -f templates/prebuilt/ai/docker-compose.yml up -d
curl -fsS http://localhost:18080/healthz
curl -fsS "http://localhost:18080/demo?topic=phala%20cloud"
curl -fsS "http://localhost:18080/stream?topic=phala%20cloud"
curl -fsS http://localhost:18080/v1/models
docker compose -f templates/prebuilt/ai/docker-compose.yml down
```

Expected `/demo` fields include:

```json
{
  "status": "ok",
  "mode": "local-deterministic-no-provider",
  "primitives_used": ["tool", "zodSchema", "jsonSchema"],
  "safety": {
    "cpu_only": true,
    "provider_credentials_required": false,
    "provider_credentials_used": false,
    "hosted_llm_calls": false,
    "model_downloads": false,
    "gpu_required": false
  }
}
```

Expected `/stream` fields include:

```json
{
  "status": "ok",
  "mode": "local-simulated-readable-stream",
  "stream": {
    "source": "simulateReadableStream",
    "llm_stream": false,
    "chunk_count": 3
  }
}
```

## Limitations

- This is a package and primitive smoke demo, not a hosted LLM service.
- The default endpoints intentionally avoid model-backed AI SDK calls such as `generateText`, `streamText`, and `generateObject`.
- No model weights are downloaded or loaded.
- No persistent storage is configured.
- The endpoints are unauthenticated. Add authentication before exposing private workflows or provider-backed routes.

## Production Extension Notes

To turn this into a production AI SDK service:

1. Add the provider package and model configuration your application needs.
2. Pass provider credentials through Phala Cloud deployment secrets or environment variables.
3. Keep provider credentials out of the compose file, README examples, and source control.
4. Replace the deterministic demo with your application routes, tools, agents, structured-output schemas, or streaming responses.
5. Add authentication, rate limits, logging, and resource sizing appropriate for the provider or model path.

Provider-backed AI SDK applications may require network access to hosted model APIs, deployment-time credentials, larger CPU or memory, a database, object storage, or separate model-serving infrastructure. None of those are enabled by default in this template.

## Template Validation

Useful checks from the `sdks/` directory:

```bash
python3 templates/validate.py
docker compose -f templates/prebuilt/ai/docker-compose.yml config >/tmp/ai-compose.out
git diff --check origin/main...HEAD
```

## Attribution

- Upstream project: [vercel/ai](https://github.com/vercel/ai)
- npm package: [`ai`](https://www.npmjs.com/package/ai)
- Template author attribution: `vercel`
- Icon: `ai.png`, sourced from the Vercel GitHub organization avatar fallback at `https://github.com/vercel.png`
