# Skyvern-AI/skyvern on Phala Cloud

This template runs a CPU-safe Skyvern Python package verifier behind a public Caddy proxy. The app installs the real `skyvern` Python package, imports the SDK, checks expected client symbols, and exposes JSON endpoints for smoke testing.

The default deployment does not start a browser session, does not download models, does not call Skyvern Cloud, and does not require LLM provider credentials. Full Skyvern browser workflow automation normally uses Skyvern Cloud or the upstream self-hosted UI/server with database, browser, and LLM configuration; this template intentionally keeps the default path deterministic for small CPU-only Phala CVMs.

## Metadata

- Template id: `skyvern`
- Category: Web Agents & Browser Automation
- Upstream repo: `https://github.com/Skyvern-AI/skyvern`
- Upstream author: `Skyvern-AI`
- Package: `skyvern==1.0.36`
- Python runtime: `python:3.12` from the `ghcr.io/astral-sh/uv:python3.12-bookworm-slim` image
- Icon source: upstream `fern/images/skyvern_favicon.png` from `Skyvern-AI/skyvern`, inspected at commit `38fa9cc7eae79c0f001c9f38fbcfa97ca0718338`

## Services

- `app`: internal Python HTTP service. At startup it installs `skyvern`, imports the package, verifies package metadata and expected SDK symbols, then serves JSON on port `8000`.
- `proxy`: public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

## Deploy

From this template directory:

```bash
docker compose config
docker compose up -d
```

On Phala Cloud, deploy the prebuilt template and open the public endpoint on port `8080`.

The first start can take a few minutes because the app installs the pinned Skyvern package and dependencies inside the container. The template does not require a persistent volume.

## Usage

The public HTTP API is available through Caddy on port `8080`.

```bash
curl -fsS http://localhost:8080/healthz | jq
curl -fsS http://localhost:8080/demo | jq
curl -fsS http://localhost:8080/v1/models | jq
```

Endpoints:

- `/healthz`: returns HTTP 200 only when the real `skyvern` package import and symbol checks pass. Returns HTTP 503 with the import error if startup checks failed.
- `/demo`: returns local Skyvern SDK metadata, including installed distribution metadata, client signatures, checked symbols, and explicit flags showing that no browser session, model download, Skyvern Cloud request, or LLM provider call is performed.
- `/v1/models`: returns an OpenAI-shaped model list containing a `skyvern/no-llm-demo` placeholder. It is metadata only; the default template does not host, download, or call a model.

## Verification

Run these smoke checks after deployment:

```bash
docker compose ps
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo | jq '.skyvern.import_ok, .credentials_required, .llm_provider_calls'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
```

These checks verify the package import, credential-free demo flags, and OpenAI-shaped metadata endpoint.

Expected results:

- `GET /healthz` returns `200 OK`.
- `.skyvern.import_ok` is `true`.
- `.credentials_required` is `false`.
- `.llm_provider_calls` is `false`.
- `/v1/models` includes `skyvern/no-llm-demo`.

## Environment Variables

The default template requires no credentials.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `SKYVERN_PACKAGE_VERSION` | `1.0.36` | No | Pinned Skyvern Python package version installed at container startup. Override only when testing another compatible release. |
| `APP_PORT` | `8000` | No | Internal app port fixed by the compose file. Caddy proxies to this port; the host only exposes `8080:80`. |

Do not add real API keys or passwords to this default verifier. For production Skyvern Cloud usage, set secrets such as `SKYVERN_API_KEY` only in your own application or deployment secret manager. For self-hosted Skyvern, configure the upstream server with the required database, browser, artifact storage, and LLM provider settings.

## Production Notes

- Skyvern Cloud is the managed service path. Use the upstream SDK with `SKYVERN_API_KEY` from `app.skyvern.com` when your workload should run managed browser workflows.
- The upstream local UI/server path is `pip install "skyvern[all]"` with `skyvern quickstart`, or the official Docker Compose stack. That stack starts Postgres, API, UI, browser streaming, artifact paths, and LLM configuration, which is outside this no-secret verifier template.
- Browser workflow runs can require external websites, browser state, credentials, CAPTCHA/proxy support, and LLM provider keys. Treat those as production application configuration, not as baked-in template defaults.
- This template does not use privileged mode, host networking, host IPC, Docker socket mounts, host bind mounts, `env_file`, or external build contexts.
- Only Caddy publishes a host port. The Python verifier service is internal and uses `expose`, not `ports`.

## Cleanup

```bash
docker compose down
```

No named volumes are created by this template.
