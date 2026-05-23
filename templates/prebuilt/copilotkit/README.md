# CopilotKit/CopilotKit on Phala Cloud

Deploy a CPU-safe CopilotKit starter/demo service on Phala Cloud.

## Metadata

- Template id: `copilotkit`
- Category: Agent Frameworks & Orchestration
- Upstream repository: https://github.com/CopilotKit/CopilotKit
- Upstream project: CopilotKit by CopilotKit
- npm packages: `@copilotkit/runtime`, `@copilotkit/react-core`, `@copilotkit/react-ui`
- Icon source: upstream `docs/public/images/logo-light.svg`, saved locally as `templates/icons/copilotkit.svg`

## What This Template Runs

CopilotKit is a React and TypeScript framework for building in-app AI copilots, agent-native interfaces, generative UI, shared state, and human-in-the-loop workflows. It is a framework for application code rather than a standalone production service.

This template intentionally runs a minimal Node.js HTTP smoke service on port `8080`. At startup it installs real CopilotKit npm packages, imports runtime and React entrypoints, and returns JSON evidence from health/demo endpoints.

The default deployment does not run a full React app, download models, call OpenAI, call Anthropic, call Google, require GPU access, or require any provider credentials. Treat it as a Phala Cloud starter that proves CopilotKit package/runtime readiness before you replace the smoke server with your own CopilotKit application.

## Services

- `app`: Node.js HTTP smoke service exposed on container port `8080`.

## Ports

- `8080`: Public HTTP endpoint for readiness, demo metadata, and a model-list stub.

## Environment Variables

No credentials are required for the default smoke demo.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `COPILOTKIT_PACKAGE_VERSION` | No | `1.57.4` | CopilotKit npm package version installed at container startup. |
| `COPILOTKIT_DEMO_LABEL` | No | `Phala CopilotKit smoke demo` | Label returned in JSON responses. |
| `OPENAI_API_KEY` | No | empty | Optional OpenAI API key passed through for users who extend this starter; unused by the default smoke demo. |
| `ANTHROPIC_API_KEY` | No | empty | Optional Anthropic API key passed through for users who extend this starter; unused by the default smoke demo. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | No | empty | Optional Google Generative AI API key passed through for users who extend this starter; unused by the default smoke demo. |

Do not hardcode provider credentials in `docker-compose.yml` or application source. Add required Phala Cloud environment variables only after your real CopilotKit app chooses a model provider and authentication flow.

## Deploy

1. Open Phala Cloud and choose the `copilotkit` prebuilt template.
2. Keep the default resources for the smoke demo, or set `COPILOTKIT_PACKAGE_VERSION` if you need a different published npm version.
3. Deploy the app.
4. Open `https://<your-app-domain>/healthz` after the first startup completes.

The first startup downloads CopilotKit and React dependencies from npm. No private models, paid credentials, GPU devices, host mounts, Docker socket access, host networking, privileged mode, or external build contexts are required.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the CopilotKit package metadata and imports pass. The response includes `ok`, `status`, installed package versions, and import evidence.
- `GET /demo`: Returns the starter capability summary, default smoke behavior, optional environment variable status, and package/import evidence.
- `GET /v1/models`: Returns an OpenAI-compatible model-list shape with an empty `data` array because no model provider is configured.
- `GET /`: Same readiness payload as `/healthz`.

Examples:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/healthz` fields include:

```json
{
  "ok": true,
  "status": "ready",
  "smoke_test": "Installed and imported CopilotKit runtime plus React package entrypoints without calling an LLM provider.",
  "package": {
    "requested_version": "1.57.4"
  }
}
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "default_behavior": {
    "installs_real_copilotkit_packages": true,
    "imports_runtime_and_react_entrypoints": true,
    "downloads_models": false,
    "calls_external_llms": false,
    "requires_gpu": false
  }
}
```

## Smoke Verification

Run locally from the `sdks` directory:

```bash
docker compose -f templates/prebuilt/copilotkit/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/copilotkit/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/copilotkit/docker-compose.yml down
```

Template validation commands:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/copilotkit/docker-compose.yml config >/dev/null
```

## Extending To A Real CopilotKit App

For production use, replace the smoke server with your React, Next.js, or other frontend/backend stack and follow the upstream CopilotKit documentation for runtime adapters, agent endpoints, authentication, and provider configuration.

Common extensions include:

- Adding a real React or Next.js app that uses `@copilotkit/react-core` and `@copilotkit/react-ui`.
- Exposing a CopilotKit runtime route backed by a selected LLM provider.
- Adding required provider credentials such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_GENERATIVE_AI_API_KEY` as Phala Cloud environment variables.
- Adding authentication before exposing agent workflows or private application state.

Resource requirements depend on your application, selected model provider, streaming behavior, and any backend tools you attach. The default template only verifies package/runtime readiness.

## Security Notes

- The default demo exposes unauthenticated readiness metadata. Add authentication before exposing real copilots, agent routes, user data, or provider-backed inference.
- The optional provider environment variables are not used by the smoke demo and their values are never returned by the JSON endpoints.
- Do not put secrets in Compose configs, README examples, or application source.
- The container does not request GPU access, privileged mode, host networking, host IPC, host bind mounts, or Docker socket access.
