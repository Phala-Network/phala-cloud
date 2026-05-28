# BerriAI/litellm on Phala Cloud

Deploy the LiteLLM Proxy Server on Phala Cloud using the official LiteLLM proxy Docker image.

LiteLLM is a unified OpenAI-compatible AI gateway for 100+ LLM providers. This template keeps the default deployment CPU-safe for a `tdx.small` smoke test: it starts the proxy, exposes health and model-list endpoints, and does not configure any provider models or require provider credentials at startup.

## Metadata

- Template id: `litellm`
- Display name: `BerriAI/litellm`
- Category: LLM Gateways, Proxies & API Management
- Upstream repository: https://github.com/BerriAI/litellm
- Upstream docs: https://docs.litellm.ai/docs/simple_proxy
- Upstream Docker image: `docker.litellm.ai/berriai/litellm:main-stable`
- Template icon: `litellm.jpg`, copied from upstream `ui/litellm-dashboard/public/assets/logos/litellm_logo.jpg` at https://github.com/BerriAI/litellm/blob/main/ui/litellm-dashboard/public/assets/logos/litellm_logo.jpg

## What This Template Runs

- `litellm`: the LiteLLM Proxy Server, exposed on container and host port `4000`.

The inline `config.yaml` uses an empty `model_list` so the proxy can boot without OpenAI, Anthropic, Google, Bedrock, Azure, or other provider credentials. This default is intended for readiness checks and API shape verification only. It does not run local inference, download model weights, call external LLM APIs, start a database, or create virtual keys.

## Ports

- `4000`: Public HTTP endpoint for the LiteLLM proxy API, health endpoints, docs UI, and OpenAI-compatible routes.

On Phala Cloud, open:

```bash
https://<your-app-domain>
```

For local Compose testing from the `sdks` directory:

```bash
http://localhost:4000
```

## Environment Variables

No environment variable is required for the default smoke deployment.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `LITELLM_IMAGE_TAG` | No | `main-stable` | LiteLLM proxy image tag used by Compose. Pin to a release tag for production. |
| `LITELLM_LOG` | No | `INFO` | LiteLLM log level. |
| `LITELLM_MASTER_KEY` | No | unset | Optional proxy admin/API key. Set a long value with the LiteLLM `sk-` prefix before exposing real model routes. |
| `OPENAI_API_KEY` | No | unset | Optional OpenAI key to use after you add OpenAI model routes to the LiteLLM config. |
| `ANTHROPIC_API_KEY` | No | unset | Optional Anthropic key to use after you add Anthropic model routes to the LiteLLM config. |
| `GOOGLE_API_KEY` | No | unset | Optional Google AI Studio/Gemini key to use after you add Gemini model routes to the LiteLLM config. |

The compose file also sets `STORE_MODEL_IN_DB=False` and the inline config sets `general_settings.store_model_in_db: false` so the default deployment does not require Postgres.

## Persistent Data

The default template does not create named volumes.

With no database or volume, model definitions and generated LiteLLM virtual-key state are not persisted by this template. For production use, add an external Postgres database or a managed database sidecar, set `DATABASE_URL`, configure a stable `LITELLM_MASTER_KEY`, and review LiteLLM's production deployment documentation.

## Deploy On Phala Cloud

1. Select the `litellm` prebuilt template.
2. Keep the default small CPU resources for the first smoke deployment: 1 vCPU, 2 GB memory, and 20 GB disk.
3. Leave provider API keys unset for the first boot.
4. Optionally set `LITELLM_MASTER_KEY` if the instance will be reachable by untrusted users.
5. Deploy the template.
6. Open `https://<your-app-domain>/health/liveliness` to confirm the proxy process is alive.
7. Open `https://<your-app-domain>/v1/models` to confirm the OpenAI-compatible model-list route responds.

The first boot pulls the official LiteLLM proxy image. No GPU, host mount, host networking, privileged mode, model download, hosted-service credential, or external LLM call is required.

## Verification

LiteLLM exposes unprotected health endpoints suitable for smoke checks:

```bash
curl -fsS https://<your-app-domain>/health/liveliness
curl -fsS https://<your-app-domain>/health/readiness
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/health/liveliness` response:

```json
"I'm alive!"
```

The default `/v1/models` response should be a valid OpenAI-compatible model-list response. Because the inline config has no provider routes, do not expect a usable model for chat completions until you add one.

Local repository smoke commands from the `sdks` directory:

```bash
docker compose -f templates/prebuilt/litellm/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/litellm/docker-compose.yml up -d
curl -fsS http://localhost:4000/health/liveliness
curl -fsS http://localhost:4000/health/readiness
curl -fsS http://localhost:4000/v1/models
docker compose -f templates/prebuilt/litellm/docker-compose.yml down
```

Template validation commands:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/litellm/docker-compose.yml config >/dev/null
```

## Adding Real Model Routes

To use the proxy for actual LLM calls, add provider model definitions to the inline `config.yaml` or adapt this template to load your own config. Use environment-variable references for credentials rather than hardcoding keys.

Example model route to add after setting `OPENAI_API_KEY`:

```yaml
model_list:
  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY
```

After adding a model route and setting a production `LITELLM_MASTER_KEY`, call the proxy with an OpenAI-compatible client:

```bash
curl -fsS https://<your-app-domain>/v1/chat/completions \
  -H "Authorization: Bearer <placeholder-litellm-key>" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Reply with a short health check."}]}'
```

## Production Hardening

- Set a strong `LITELLM_MASTER_KEY` before exposing model routes, the Admin UI, or key-management endpoints.
- Pin `LITELLM_IMAGE_TAG` to a tested LiteLLM release tag instead of floating on `main-stable`.
- Add Postgres with a managed `DATABASE_URL` if you need persistent virtual keys, spend tracking, teams, users, audit logs, or UI-managed model configuration.
- Store provider credentials as Phala Cloud environment variables or secrets. Do not put API keys, database passwords, private keys, tokens, or generated master keys in `docker-compose.yml`, README examples, or source control.
- Configure only the providers and model aliases you intend to expose, then test `/v1/models` and a real `/v1/chat/completions` call before sharing the endpoint.
- Review LiteLLM authentication, virtual keys, budgets, rate limits, logging callbacks, CORS, SSO, and database migration guidance before production traffic.
- Size CPU, memory, disk, database capacity, provider quotas, and request timeouts together. The default template is for a lightweight proxy smoke test, not high-throughput gateway traffic.

## Upstream Attribution

LiteLLM is developed by BerriAI:

- Repository: https://github.com/BerriAI/litellm
- Documentation: https://docs.litellm.ai/
- Docker image: https://docs.litellm.ai/docs/proxy/deploy
- License file: https://github.com/BerriAI/litellm/blob/main/LICENSE

This Phala Cloud template only packages a deployment configuration for the upstream LiteLLM Proxy Server and preserves upstream BerriAI attribution in the template metadata.
