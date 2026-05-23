# MaxKB on Phala Cloud

This template runs a CPU-safe MaxKB verifier API for Phala Cloud smoke testing.
It does not start the full MaxKB web application.

MaxKB is an open-source platform from `1Panel-dev` for building enterprise-grade
agents with RAG pipelines, workflows, MCP tool use, model-provider integrations,
and a Python/Django plus Vue.js application stack.

The upstream quick start runs the official `1panel/maxkb` image as a stateful
all-in-one service. The upstream source shows that the official image bundles or
depends on PostgreSQL 17, Redis, pgvector, AGE, ffmpeg, a vector model image,
Django, LangChain provider packages, Torch, and sentence-transformers. That is a
production-oriented stack and is not a deterministic small CPU-only smoke target.

This Phala template therefore exposes a verifier service that checks selected
MaxKB source/runtime facts from the upstream tree and returns JSON responses.
It does not download models, start PostgreSQL or Redis, require GPU resources,
or consume external LLM credentials.

## Metadata

- Template id: `maxkb`
- Upstream repo: `https://github.com/1Panel-dev/MaxKB`
- Upstream author: `1Panel-dev`
- Upstream commit inspected: `61ac793b3a82ea086cbd14203b2e076845290bc4`
- Upstream license: GPL-3.0
- Runtime: `python:3.11-slim-bookworm`
- Icon source: upstream `ui/src/assets/logo/logo.png` from `1Panel-dev/MaxKB`,
  inspected at commit `61ac793b3a82ea086cbd14203b2e076845290bc4`
- Icon SHA-256: `a75e812b7d55d6f568e6df8c60db8a5cf9484e2847f61b518c2987529b8fcffd`

## Services

- `app`: a Python 3.11 HTTP service that parses an excerpt of the upstream
  `pyproject.toml`, verifies key package/runtime facts, and exposes JSON on port
  `8080`.

## Deploy

From this template directory:

```bash
docker compose config
docker compose up -d
```

On Phala Cloud, deploy the prebuilt template and open the public endpoint on
port `8080`.

## Usage

The public HTTP API is available on port `8080`.

```bash
curl -fsS http://localhost:8080/healthz | jq
curl -fsS http://localhost:8080/demo | jq
curl -fsS http://localhost:8080/v1/models | jq
```

Endpoints:

- `/healthz`: returns HTTP 200 when the verifier's MaxKB source/runtime checks
  pass. The response includes the upstream commit, runtime information, and check
  results.
- `/demo`: returns a fuller explanation of the verified MaxKB facts and the
  limitations of this CPU-safe template.
- `/v1/models`: returns an OpenAI-shaped model list containing
  `maxkb/no-llm-verifier`. This is metadata only; the template does not host,
  download, or call an LLM model.

## Verification

Run these smoke checks after deployment:

```bash
docker compose ps
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo | jq '.verification.ok, .template_mode'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `.verification.ok` is `true`.
- `.template_mode.full_maxkb_web_ui_started` is `false`.
- `.template_mode.model_downloaded` is `false`.
- `.template_mode.llm_provider_calls` is `false`.
- `/v1/models` includes `maxkb/no-llm-verifier`.

## Environment Variables

The default template requires no credentials.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `APP_PORT` | `8080` | No | HTTP port used by the verifier service. The compose file publishes the same port, defaulting to `8080:8080`. |

LLM provider keys such as OpenAI, Anthropic, Gemini, or other model credentials
are intentionally not required and are not consumed by this verifier template.
Do not place API keys or private tokens in the compose file.

## Security Notes

- The template publishes only the verifier HTTP port, defaulting to `8080:8080`.
- It does not use privileged mode, host networking, host IPC, host bind mounts,
  `env_file`, external build contexts, or real secrets.
- It does not include the upstream default admin credential values and does not
  start the MaxKB admin UI.
- The official MaxKB deployment path should be reviewed separately if you need a
  production MaxKB instance with persistent databases, model providers, and user
  authentication.

## Cleanup

```bash
docker compose down
```

No named volumes are created by this template.
