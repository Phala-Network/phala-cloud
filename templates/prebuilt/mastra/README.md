# mastra-ai/mastra on Phala Cloud

Mastra is a TypeScript-first framework for building AI-powered applications and agents with agents, workflows, tools, memory, RAG, evals, observability, and MCP support. The upstream project lives at [mastra-ai/mastra](https://github.com/mastra-ai/mastra).

This Phala Cloud prebuilt template runs a CPU-safe Node.js HTTP demo that installs the real `@mastra/core` package and Mastra CLI package, creates a deterministic local Mastra tool, and exposes smoke endpoints that require no external LLM provider credentials, no model downloads, no GPU, no hosted service, and no browser authentication.

## Services

- `app`: Node.js 22 service that installs `@mastra/core`, `mastra`, and `zod` at startup, then serves a lightweight HTTP API on container port `8080`.

## Ports

- `8080`: Public HTTP port exposed by Phala Cloud and forwarded to the Mastra demo API.

## Endpoints

- `GET /healthz`: Verifies that the real Mastra packages import successfully, `mastra --version` runs, and a local `createTool(...)` primitive executes.
- `GET /demo?topic=agent%20workflow`: Runs the deterministic local Mastra tool workflow and returns its step-by-step output.
- `GET /v1/models`: Returns an OpenAI-style compatibility model list for the local deterministic demo.
- `GET /`: Lists the available endpoints and upstream project metadata.

## Deploy

1. Open Phala Cloud and create a new deployment from the Mastra prebuilt template.
2. Keep the default small CPU resources for the demo.
3. Deploy the CVM.
4. Open the generated public endpoint for port `8080`.

The first startup installs pinned npm packages inside the container, so readiness can take a minute or two on a fresh deployment.

## Use

Set your Phala Cloud endpoint URL:

```bash
export MASTRA_URL=https://<your-app-domain>
```

Check health and package evidence:

```bash
curl -sS "$MASTRA_URL/healthz"
```

Run the deterministic Mastra demo workflow:

```bash
curl -sS "$MASTRA_URL/demo?topic=confidential%20agent%20workflow"
```

List the lightweight compatibility endpoint:

```bash
curl -sS "$MASTRA_URL/v1/models"
```

The demo response includes the normalized input, a deterministic checksum, word count, category, and a simple step list. It does not call an LLM provider.

## Verify

Use the public endpoint assigned by Phala Cloud:

```bash
curl -i https://<your-app-domain>/healthz
curl -i https://<your-app-domain>/demo
curl -i https://<your-app-domain>/v1/models
```

A healthy deployment returns HTTP `200` for all three smoke endpoints. `/healthz` should report successful imports for `@mastra/core`, a working Mastra CLI version command, and successful local tool execution.

## Environment Variables

The default demo sets only internal runtime values:

- `PORT=8080`: HTTP port inside the container.
- `NODE_ENV=production`: Runs the Node.js process in production mode.
- `MASTRA_CORE_VERSION=1.37.1`: `@mastra/core` package version installed at startup.
- `MASTRA_CLI_VERSION=1.10.2`: Mastra CLI package version installed at startup.

No real secrets are included, and no credential environment variables are required for the default demo.

For production extensions, add only the provider variables your selected Mastra integrations need. Examples include OpenAI-compatible, Anthropic, Gemini, or other provider credentials, database connection settings for memory/storage, vector store credentials, and observability exporter settings. Treat those as deployment-time secrets and do not hard-code real tokens, private keys, or connection strings in the compose file.

## Production Extension Notes

This template intentionally uses a deterministic local tool instead of model-backed agents so it can run safely in a small CPU-only Phala CVM. To turn it into a production Mastra service:

1. Create a real Mastra project with `npm create mastra@latest` or your existing application source.
2. Add the model provider package and credentials required by your agent or workflow.
3. Configure memory, storage, vector stores, MCP servers, or observability exporters as needed.
4. Replace the deterministic demo tool with your application agents, workflows, tools, and API routes.
5. Add authentication and rate limiting before exposing model-backed endpoints publicly.
6. Size CPU, memory, disk, and network egress for your selected provider, self-hosted model path, or backing databases.

Model-backed Mastra deployments can require API keys, larger resources, external databases, vector stores, or separate model-serving infrastructure. None of those are enabled by default in this template.

## Attribution

- Upstream project: [mastra-ai/mastra](https://github.com/mastra-ai/mastra), built by Mastra AI and open-source contributors.
- Template author attribution: Mastra AI.
- Icon: `mastra.png`, sourced from the upstream CLI package image [`packages/cli/mastra-cli.png`](https://github.com/mastra-ai/mastra/blob/main/packages/cli/mastra-cli.png).
