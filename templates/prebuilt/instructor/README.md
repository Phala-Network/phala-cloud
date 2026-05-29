# 567-labs/instructor

Deploy a CPU-safe Instructor structured-output smoke demo on Phala Cloud.

## Metadata

- Template id: `instructor`
- Display name: `567-labs/instructor`
- Category: Agent Frameworks & Developer Tools
- Upstream repository: https://github.com/567-labs/instructor
- Python package: `instructor`
- Default package version: `1.15.1`
- Icon source: GitHub organization avatar fallback, `https://github.com/567-labs.png`
- Upstream author: 567 Labs, via the `567-labs/instructor` GitHub repository

## What This Template Runs

Instructor is a Python package for structured outputs, response models, schema-aware extraction, validation, retries, and provider adapters.

This template runs a minimal FastAPI service behind Caddy on port `80`. The app image installs the real `instructor` Python package, imports it at runtime, checks package symbols such as `Mode`, `from_provider`, `Partial`, and `openai_schema`, then exposes JSON endpoints for local smoke testing.

The `/demo` endpoint does not call an LLM. It builds a Pydantic response model, uses Instructor's `openai_schema` helper to inspect the tool/function schema, constructs `Partial[LeadExtraction]`, validates deterministic sample JSON with Pydantic, and intentionally validates one bad sample to show local validation errors. The response reports `hosted_model_call_attempted=false` and `provider_credentials_required=false`.

No OpenAI, Anthropic, Gemini, Ollama, or other hosted model provider is called. No provider credentials, model downloads, GPU access, privileged mode, host bind mounts, Docker socket, `env_file`, or external build context is used.

## Services

- `app`: Private FastAPI service on the internal Compose network, listening on port `8000`.
- `proxy`: Caddy reverse proxy listening on public port `80` and forwarding to `app:8000`.

## Environment Variables

No secrets are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `INSTRUCTOR_VERSION` | No | `1.15.1` | Instructor Python package version installed in the demo image. |

## Deploy

1. Deploy the `instructor` template on Phala Cloud.
2. Keep the default `tdx.small-safe`-class CPU resources for this smoke demo: 1 vCPU, 1024 MB memory, and 10 GB disk.
3. Leave `INSTRUCTOR_VERSION` at `1.15.1` unless you intentionally want to test another published package version.
4. Open `https://<your-app-domain>/healthz` after the image build and startup finish.

The first build downloads Python wheels from PyPI. The runtime demo is local and deterministic.

## Endpoints

- `GET /healthz`: Imports `instructor`, checks the installed version, verifies expected symbols, and builds Instructor schema primitives.
- `GET /demo`: Runs the deterministic local structured extraction and validation demo without a hosted model call.
- `GET /v1/models`: Returns an OpenAI-style metadata list for the local schema validator. It is not a hosted LLM.
- `GET /upstream`: Returns upstream repository, package, version, icon attribution, and endpoint metadata.
- `GET /`: Returns a compact endpoint index.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
curl -fsS https://<your-app-domain>/upstream
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "hosted_model_call_attempted": false,
  "provider_credentials_required": false,
  "demo": {
    "validated_result": {
      "company": "Vector Forge",
      "plan": "growth",
      "seats": 12
    },
    "instructor_primitives": {
      "openai_schema_name": "LeadExtraction",
      "partial_model": "PartialLeadExtraction"
    }
  }
}
```

## Local Verification

Run from the `sdks/` checkout:

```bash
docker compose -f templates/prebuilt/instructor/docker-compose.yml config >/tmp/instructor-compose.out
docker compose -f templates/prebuilt/instructor/docker-compose.yml up -d --build
curl -fsS http://localhost/healthz
curl -fsS http://localhost/demo
curl -fsS http://localhost/v1/models
curl -fsS http://localhost/upstream
docker compose -f templates/prebuilt/instructor/docker-compose.yml down
```

If local port `80` is already in use, temporarily change only the host side of the proxy mapping for local testing, for example `18080:80`, then use `http://localhost:18080/healthz`.

Template validation commands:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
```

## Limitations And Production Caveats

- This is a package and schema-validation smoke demo, not a production extraction service.
- It does not invoke `from_provider`, patch an LLM client, or call OpenAI, Anthropic, Gemini, Ollama, or any other model provider.
- It does not host a model and does not download model weights.
- The endpoints are unauthenticated. Add authentication, authorization, rate limits, and request logging before adapting this for private workloads.
- Real Instructor applications usually call a provider client with a response model. Add the provider SDK, credentials, timeouts, retries, and audit logging explicitly when you move beyond this no-secrets demo.
- Keep `INSTRUCTOR_VERSION` pinned for reproducible deployments.

## Security Notes

- No secrets are required for the default template.
- Do not put API keys or bearer tokens in the compose file.
- The compose file does not use `env_file`, host bind mounts, privileged mode, host networking, Docker socket access, or GPU device reservations.
- Caddy is the only public service. The FastAPI app is reachable only on the internal Compose network.

## Upstream Attribution

This template installs and imports the real `instructor` Python package from the upstream 567 Labs project:

- Repository: https://github.com/567-labs/instructor
- Package index: https://pypi.org/project/instructor/
- Icon fallback: https://github.com/567-labs.png
