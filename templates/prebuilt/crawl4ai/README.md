# unclecode/crawl4ai on Phala Cloud

## Overview

This prebuilt template deploys a CPU-safe HTTP smoke demo for
[unclecode/crawl4ai](https://github.com/unclecode/crawl4ai), an open-source
LLM-friendly web crawler and scraper for turning web pages into Markdown and
structured data.

The upstream project publishes an official Docker image,
`unclecode/crawl4ai:0.8.6`, with a real HTTP API on port `11235`. That server is
browser-backed and upstream's Docker guide recommends at least 4 GB of RAM for
the container. The upstream image also starts Redis and a permanent Playwright
browser pool by default. This template stays safe for a small CPU-only Phala CVM
by installing and importing the real `Crawl4AI` Python package, then exposing a
deterministic local Markdown conversion demo instead of launching a browser.

The default demo does not fetch websites, run Playwright browser setup, launch a
browser, call hosted LLM APIs, download model weights, require a GPU, require
provider credentials, or use host bind mounts.

## Services

- `app`: Python HTTP service based on
  `ghcr.io/astral-sh/uv:python3.12-bookworm-slim`. On startup it installs the
  pinned `Crawl4AI` package from PyPI, imports the package, verifies expected
  symbols, converts bundled HTML with
  `DefaultMarkdownGenerator.generate_markdown`, and serves JSON on port `8080`.

The compose file publishes `8080:8080` and creates no volumes.

## Deployment

1. Create a new Phala Cloud deployment from the `crawl4ai` prebuilt template.
2. Keep the default resources for the package smoke test.
3. Optionally override `CRAWL4AI_VERSION` only when testing another compatible
   Crawl4AI release.
4. Deploy the CVM and wait for the first startup to finish.
5. Open `https://<your-app-domain>/healthz`.

For local testing from this template directory:

```bash
docker compose config
docker compose up -d
curl -fsS http://localhost:8080/healthz
```

The first start can take several minutes because the container installs the
pinned Crawl4AI wheel and dependencies. Restarts are lighter if the container
filesystem is retained, but the template does not require persistent storage.

## Environment Variables

No credentials are required for the default smoke path.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `CRAWL4AI_VERSION` | No | `0.8.6` | Crawl4AI Python package version installed at container startup. The default matches the current PyPI release and upstream Docker tag inspected for this template. |

Provider keys such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`,
proxy credentials, CAPTCHA provider credentials, or remote-browser credentials
are intentionally not consumed by this default template. Add only the variables
your production crawler actually uses if you replace the smoke demo with the
official Crawl4AI server or a custom crawler application.

The compose file also sets fixed runtime values `APP_PORT=8080`,
`PYTHONUNBUFFERED=1`, and `UV_SYSTEM_PYTHON=1`; these are not user-facing
template variables.

## Usage

The public HTTP API is available on port `8080`.

```bash
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
```

Endpoints:

- `/healthz`: returns HTTP 200 when the real `Crawl4AI` package import,
  expected symbol checks, and local Markdown conversion check pass.
- `/demo`: returns package metadata and the deterministic local HTML to Markdown
  conversion result. It explicitly reports that no browser, network crawl, LLM
  provider call, or model download happened.
- `/v1/models`: returns an OpenAI-shaped model list containing
  `crawl4ai/local-markdown-demo`. It is metadata only; the default template does
  not host a model or perform inference.

Example `/demo` fields:

```json
{
  "demo": {
    "browser_launched": false,
    "external_network_requests": false,
    "llm_provider_calls": false,
    "model_downloaded": false
  }
}
```

## Verification and Smoke Test

From the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/crawl4ai/docker-compose.yml config >/dev/null
```

If a Docker daemon is available locally, run the service:

```bash
docker compose -f templates/prebuilt/crawl4ai/docker-compose.yml up -d
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/crawl4ai/docker-compose.yml down
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `/healthz` includes `"import_ok": true` and `"demo_ok": true`.
- `/demo` reports `browser_launched`, `external_network_requests`,
  `llm_provider_calls`, and `model_downloaded` as `false`.
- `/v1/models` includes `crawl4ai/local-markdown-demo`.

## Production Extension

Use the official upstream server image when you want the full Crawl4AI HTTP API,
browser pool, dashboard, MCP endpoints, screenshots, PDF generation, JavaScript
execution, and real website crawling:

```yaml
services:
  crawl4ai:
    image: unclecode/crawl4ai:0.8.6
    shm_size: "1gb"
    ports:
      - "11235:11235"
```

For a production Phala deployment, review resource sizing first. Upstream
documents at least 4 GB RAM for the Docker server, and real crawling workloads
can need more memory depending on browser concurrency, page size, screenshots,
PDF generation, anti-bot behavior, and extraction strategy.

Do not add `.env` files, host bind mounts, Docker socket mounts, or hard-coded
secrets. Use Phala Cloud environment variables for any provider keys, proxy
settings, JWT secrets, or webhook credentials required by your custom workload.

## Upstream Attribution

- Upstream repository: https://github.com/unclecode/crawl4ai
- Upstream author: `unclecode`
- Upstream package: https://pypi.org/project/Crawl4AI/
- Upstream Docker image: https://hub.docker.com/r/unclecode/crawl4ai
- License: Apache-2.0, per the upstream repository.
- Icon source: upstream `docs/md_v2/img/favicon-32x32.png`, copied from
  `unclecode/crawl4ai`.

## Security Notes

- The default template exposes only a deterministic unauthenticated smoke API.
- The smoke API does not fetch arbitrary URLs or execute user-provided code.
- The compose file uses no `env_file`, no host bind mounts, no privileged mode,
  no host networking, no host IPC, no host PID mode, no GPU devices, and no
  baked-in credentials.
- Full crawler deployments can fetch arbitrary targets and send data to model,
  proxy, CAPTCHA, or scraping providers. Respect target-site terms, robots
  policies, rate limits, and applicable law when adapting this template.

## Cleanup

```bash
docker compose down
```

No named volumes are created by this template.
