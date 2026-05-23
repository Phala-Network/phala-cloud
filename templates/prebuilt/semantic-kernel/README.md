# Semantic Kernel

CPU-only FastAPI demo for Microsoft Semantic Kernel on Phala Cloud.

This template installs the real `semantic-kernel` Python package, constructs a `Kernel`, registers a local `@kernel_function` plugin, and invokes that plugin through the `/demo` HTTP endpoint. The demo is deterministic and does not call any external model provider, download any model, or require provider credentials.

## Upstream Attribution

- Upstream project: `microsoft/semantic-kernel`
- Upstream repository: `https://github.com/microsoft/semantic-kernel`
- Author: Microsoft / `microsoft`
- Python package: `semantic-kernel==1.42.0`

## Services

- `app`: FastAPI application running the local Semantic Kernel demo on port `8000`.
- `proxy`: Caddy reverse proxy publishing the app on public port `80`.

## Endpoints

- `GET /healthz`: health check with the `semantic-kernel` package name and installed version.
- `GET /demo`: invokes the registered local Semantic Kernel plugin and returns the package name, package version, plugin name, input topic, and deterministic result.
- `GET /v1/models`: OpenAI-style model list containing the local demo model identifier.

Example `/demo` response shape:

```json
{
  "package": "semantic-kernel",
  "version": "1.42.0",
  "kernel": "Kernel",
  "plugin": "local_demo.deterministic_summary",
  "input": {
    "topic": "Phala Cloud"
  },
  "result": "Semantic Kernel invoked LocalDemoPlugin for 'Phala Cloud' with sha256:..."
}
```

## Deploy On Phala Cloud

1. Open Phala Cloud and create a new CVM/app from a prebuilt template.
2. Select the `semantic-kernel` template.
3. Use the default resources: 2 vCPU, 4096 MB memory, and 40 GB disk.
4. Optionally set `DEMO_TOPIC` to change the default `/demo` topic.
5. Deploy the app and open the generated public URL.

## Verification

After deployment, replace `<your-app-domain>` with the Phala Cloud app domain:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS "https://<your-app-domain>/demo?topic=Phala%20Cloud"
curl -fsS https://<your-app-domain>/v1/models
```

For local compose checks from this directory:

```bash
docker compose config
docker compose up --build
curl -fsS http://localhost/healthz
curl -fsS "http://localhost/demo?topic=Phala%20Cloud"
curl -fsS http://localhost/v1/models
```

## Environment Variables

- `DEMO_TOPIC` (optional, default `Phala Cloud`): Default topic used by `/demo` when no `topic` query parameter is supplied.

The template intentionally does not define provider API keys or model credentials. Real provider credentials should be supplied only by users extending the demo to call their own configured Semantic Kernel connectors.

## Icon Source

The icon is copied from the upstream Semantic Kernel repository:

`https://raw.githubusercontent.com/microsoft/semantic-kernel/main/docs/images/sk_logo.png`
