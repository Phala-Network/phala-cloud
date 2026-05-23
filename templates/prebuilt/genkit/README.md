# genkit-ai/genkit on Phala Cloud

Genkit is Google's open-source framework for building AI-powered applications across JavaScript/TypeScript, Go, Python, and Dart. The upstream project lives at [genkit-ai/genkit](https://github.com/genkit-ai/genkit).

This Phala Cloud prebuilt template runs a CPU-safe Node.js HTTP demo that installs and imports the real `genkit` and `@genkit-ai/express` packages. It defines a local Genkit tool and flow, then exposes deterministic endpoints that require no external LLM provider credentials, no model downloads, no GPU, no Firebase project, and no GCP account.

## Services

- `genkit`: Node.js 22 service that installs `genkit@1.35.0`, `@genkit-ai/express@1.35.0`, and `express@4.21.2` at startup, then serves HTTP on container port `8000`.

## Ports

- `18080`: Public HTTP port exposed by Phala Cloud and forwarded to the Genkit demo API on container port `8000`.

## Endpoints

- `GET /healthz`: Verifies that the real Genkit packages import successfully and returns package/version metadata.
- `GET /demo?topic=phala%20cloud`: Runs the local deterministic Genkit flow and tool.
- `POST /demo`: Runs the same demo flow with a JSON body such as `{"topic":"confidential ai"}`.
- `GET /v1/models`: Returns an OpenAI-style lightweight model list for the local deterministic demo.
- `POST /flows/localDemoFlow`: Exposes the same flow through `@genkit-ai/express` using Genkit's callable flow shape. Send `{"data":{"topic":"phala cloud"}}`.

## Deploy

1. Open Phala Cloud and create a new deployment from the Genkit prebuilt template.
2. Keep the default small CPU resources for the demo.
3. Deploy the CVM.
4. Open the generated public endpoint for port `18080`.

The first startup installs the pinned npm packages inside the container, so readiness can take a minute or two on a fresh deployment.

## Use

Set your Phala Cloud endpoint URL:

```bash
export GENKIT_URL=https://<your-app-domain>
```

Check the available local API surface:

```bash
curl -sS "$GENKIT_URL/"
curl -sS "$GENKIT_URL/v1/models"
```

Run the deterministic Genkit demo flow:

```bash
curl -sS "$GENKIT_URL/demo?topic=confidential%20ai"
```

Call the Genkit Express flow endpoint:

```bash
curl -sS -X POST "$GENKIT_URL/flows/localDemoFlow" \
  -H "content-type: application/json" \
  -d '{"data":{"topic":"phala cloud genkit"}}'
```

The demo response includes the normalized input, a deterministic checksum, word counts, and endpoint metadata. It does not call a model provider.

## Verify

Use the public endpoint assigned by Phala Cloud:

```bash
curl -i https://<your-app-domain>/healthz
curl -i https://<your-app-domain>/demo
curl -i https://<your-app-domain>/v1/models
```

A healthy deployment returns HTTP `200` for all three smoke endpoints. `/healthz` should report successful imports for `genkit`, Genkit's Zod export, and `@genkit-ai/express`.

## Environment Variables

The default demo sets only internal runtime values:

- `PORT=8000`: HTTP port inside the container.
- `NODE_ENV=production`: Runs the Node.js process in production mode.

No real secrets are included, and no credential environment variables are required for the default demo.

For production extensions, add only the provider variables your selected Genkit plugins need. Examples include `GOOGLE_API_KEY` for Google AI, `OPENAI_API_KEY` for OpenAI-compatible providers, Firebase app configuration, or GCP application credentials for Vertex AI and Firebase integrations. Treat those as deployment-time secrets and do not hard-code real tokens, private keys, or service account JSON in the compose file.

## Production Extension Notes

This template intentionally avoids provider plugins so it can run safely in a small CPU-only Phala CVM. To turn it into a production AI service:

1. Add the Genkit provider plugin you need, such as `@genkit-ai/google-genai`, an OpenAI-compatible plugin, Anthropic community plugin, or an Ollama integration.
2. Configure the selected model and credentials through Phala deployment secrets or environment variables.
3. Replace the deterministic demo flow with your application flows, tools, prompts, RAG retrievers, or structured-output handlers.
4. Add authentication before exposing model-backed endpoints publicly.
5. Size CPU, memory, disk, and networking for the selected provider or self-hosted model path.

Model-backed Genkit deployments can require API keys, Firebase or GCP configuration, larger resources, network access to providers, or separate model-serving infrastructure. None of those are enabled by default in this template.

## Attribution

- Upstream project: [genkit-ai/genkit](https://github.com/genkit-ai/genkit), built by Google with open-source contributors.
- Template author attribution: Google / genkit-ai.
- Icon: `genkit.png`, sourced from the upstream README asset [`docs/resources/genkit-logo.png`](https://github.com/genkit-ai/genkit/blob/main/docs/resources/genkit-logo.png).
