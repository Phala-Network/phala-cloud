# iii-hq/iii on Phala Cloud

iii is a live service-composition runtime for building, extending, and observing backend systems through three primitives: workers, functions, and triggers. The upstream project lives at [iii-hq/iii](https://github.com/iii-hq/iii).

This Phala Cloud prebuilt template runs the official `iiidev/iii:latest` engine image with `--use-default-config`, plus a small CPU-safe Node.js verifier that installs the real `iii-sdk` package, registers a deterministic worker function, binds it to an iii HTTP trigger, and exposes smoke endpoints. The default deployment requires no provider credentials, makes no LLM or model-provider calls, does not download model weights, and does not require browser authentication.

## Services

- `iii`: Official upstream iii engine image, running the built-in default workers on internal ports `49134`, `3111`, `3112`, and `9464`.
- `app`: Node.js 22 verifier API that installs `iii-sdk`, connects to the engine over WebSocket, registers `phala::iii_demo`, and exposes port `8080`.

## Category

AI Apps & Workflows

## Ports

- `8080`: Public HTTP port exposed by Phala Cloud for the verifier API.
- `49134`: Internal iii WebSocket worker connection port.
- `3111`: Internal iii HTTP trigger port.
- `3112`: Internal iii stream API port.
- `9464`: Internal Prometheus metrics port.

## Endpoints

- `GET /healthz`: Verifies that the upstream engine HTTP port is reachable, the real `iii-sdk` package imported, the local worker function can be invoked directly through iii, and the registered iii HTTP trigger responds.
- `GET /demo?topic=service%20workflow`: Invokes the deterministic worker through both the iii WebSocket function path and the iii HTTP trigger path, then returns evidence for the worker/function/trigger flow.
- `POST /demo`: Same as `GET /demo`, with a JSON body such as `{"topic":"observe worker services"}`.
- `GET /v1/models`: Returns an OpenAI-style metadata-only model list for smoke clients. No model is loaded or called.
- `GET /`: Lists metadata and available endpoints.

The engine-side registered demo route is `POST /phala/iii-demo` on the internal iii HTTP worker at `http://iii:3111/phala/iii-demo`. The public verifier's `/demo` endpoint calls that route for you.

## Deploy

1. Open Phala Cloud and create a deployment from the `iii` prebuilt template.
2. Keep the default CPU resources for the demo.
3. Deploy the CVM.
4. Open the generated public endpoint for port `8080`.

The first startup installs the pinned `iii-sdk` npm package inside the verifier container. Readiness can take a minute or two on a fresh deployment.

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `III_SDK_VERSION` | No | `0.19.2` | Pinned `iii-sdk` npm package version installed by the verifier service at container startup. |
| `PORT` | No | `8080` | Internal verifier HTTP port. The template sets this automatically. |
| `III_ENGINE_WS_URL` | No | `ws://iii:49134` | Internal WebSocket URL used by the verifier worker to connect to the iii engine. |
| `III_ENGINE_HTTP_URL` | No | `http://iii:3111` | Internal HTTP URL used by the verifier to call the registered iii HTTP trigger. |

No real secrets are included, and no credential environment variables are required for the default demo.

## Smoke Verification

Use these commands to verify the deployment from your workstation.

Set your Phala Cloud endpoint:

```bash
export III_URL=https://<your-app-domain>
```

Check readiness:

```bash
curl -fsS "$III_URL/healthz"
```

Run the deterministic iii worker/function/trigger demo:

```bash
curl -fsS "$III_URL/demo?topic=confidential%20service%20workflow"
```

Check the compatibility model-list endpoint:

```bash
curl -fsS "$III_URL/v1/models"
```

A healthy deployment returns HTTP `200` for all three commands. `/healthz` should report `direct_trigger_ok: true` and `http_trigger_ok: true`.

## Local Verification

From the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/iii/docker-compose.yml config
docker compose -f templates/prebuilt/iii/docker-compose.yml up
```

Then, in another terminal:

```bash
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
```

Stop the local stack when finished:

```bash
docker compose -f templates/prebuilt/iii/docker-compose.yml down
```

## Production Notes

This template is intentionally a small no-secret verifier. It proves that the official iii engine can start in a CPU-only CVM and that a real `iii-sdk` worker can register a function and HTTP trigger. It is not a production iii application by itself.

For production usage:

1. Replace the deterministic demo worker with your own iii project workers.
2. Add only the worker images, package registries, queues, state backends, observability exporters, and provider credentials that your application actually needs.
3. Use deployment-time secrets for API keys, database credentials, queue credentials, and observability exporter tokens. Do not hard-code real tokens or passwords in the compose file.
4. Size CPU, memory, disk, and network egress for your worker mix and any external state or message broker dependencies.
5. Add authentication, authorization, and rate limiting before exposing business or agent endpoints publicly.

The upstream engine Docker example also documents Redis and RabbitMQ-backed configurations. This template does not enable those sidecars by default because the no-credential Phala verifier should stay small, deterministic, and deployable on a `tdx.small`-class CPU instance.

## Attribution

- Upstream project: [iii-hq/iii](https://github.com/iii-hq/iii), built by iii-hq and open-source contributors.
- Template author attribution: `iii-hq`.
- Icon: `iii.svg`, sourced from upstream [`docs/assets/iii-black.svg`](https://github.com/iii-hq/iii/blob/main/docs/assets/iii-black.svg).
