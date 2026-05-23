# ScrapeGraphAI/Scrapegraph-ai on Phala Cloud

## Overview

This prebuilt template deploys a CPU-safe HTTP smoke demo for
[ScrapeGraphAI/Scrapegraph-ai](https://github.com/ScrapeGraphAI/Scrapegraph-ai), an
AI-powered Python web scraping library for building scraping pipelines over
websites and local documents.

The upstream README documents `pip install scrapegraphai`, `playwright install` for
website fetching, `SmartScraperGraph` as the common single-page scraping pipeline,
OpenAI-style provider configuration, Ollama local-model usage, and the
`SCRAPEGRAPHAI_TELEMETRY_ENABLED=false` opt-out variable. Those full AI scraping
flows are not safe as a default `tdx.small` smoke test because they can require
browser binaries, hosted LLM credentials, local model runtimes, model downloads, and
network access to arbitrary target sites.

This template therefore builds a small Python HTTP API that installs the real
`scrapegraphai` package, imports it, and exercises the package's local
`scrapegraphai.utils.convert_to_md.convert_to_md` utility against bundled HTML. The
default demo does not fetch websites, launch Playwright, call hosted LLM APIs, pull
Ollama models, require a GPU, or need secrets.

## Deployment

1. Create a new Phala Cloud deployment from the `scrapegraph-ai` prebuilt template.
2. Keep the default resources for a CPU-only smoke test.
3. Optionally adjust the package version or demo title in the template environment.
4. Deploy the CVM and wait for the image build and first startup to finish.
5. Open `https://<your-app-domain>/healthz`.

The service listens on container port `8080` and publishes `8080:8080` for local
testing. The first build downloads the pinned ScrapeGraphAI package and Python
dependencies from PyPI. After startup, the default endpoints operate only on local
metadata and bundled HTML.

## Configuration

No credentials are required for the default smoke path.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SCRAPEGRAPHAI_VERSION` | No | `2.1.1` | ScrapeGraphAI Python package version used by the inline Dockerfile build and reported by the runtime. |
| `SCRAPEGRAPHAI_TELEMETRY_ENABLED` | No | `false` | Sets the upstream ScrapeGraphAI telemetry opt-out variable for the container. The demo does not run telemetry-emitting graph flows. |
| `SCRAPEGRAPHAI_DEMO_TITLE` | No | `Phala Cloud ScrapeGraphAI demo` | Default title inserted into the bundled HTML converted by `/demo`. |

The compose file also sets internal runtime values `PORT=8080` and
`PYTHONUNBUFFERED=1`; these are fixed by the template and are not user-facing config
entry variables.

For a real ScrapeGraphAI scraping deployment, add only the credentials and settings
your chosen provider actually needs, such as hosted LLM API keys, ScrapeGraphAI API
keys, Browserbase or scraping-provider credentials, Ollama endpoints, model names,
or Playwright browser installation steps. Do not place secret values in
`docker-compose.yml` or this README.

## Usage

Health check:

```bash
curl -fsS https://<your-app-domain>/healthz
```

Run the local package demo:

```bash
curl -fsS "https://<your-app-domain>/demo?title=ScrapeGraphAI%20on%20Phala"
```

List the smoke-test model surface:

```bash
curl -fsS https://<your-app-domain>/v1/models
```

Inspect the capability summary:

```bash
curl -fsS https://<your-app-domain>/capabilities
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "demo": {
    "cpu_only": true,
    "external_provider_calls": false,
    "browser_launched": false,
    "webpage_fetched": false,
    "model_downloaded": false
  }
}
```

The `/v1/models` endpoint is compatibility-shaped metadata for smoke tests. It does
not expose an inference model.

## Verification/Smoke Test

From the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/scrapegraph-ai/docker-compose.yml config >/dev/null
```

If Docker is available locally, run the service:

```bash
docker compose -f templates/prebuilt/scrapegraph-ai/docker-compose.yml up -d --build
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/capabilities
docker compose -f templates/prebuilt/scrapegraph-ai/docker-compose.yml down
```

## Upstream Attribution

- Upstream repository: https://github.com/ScrapeGraphAI/Scrapegraph-ai
- Upstream project: ScrapeGraphAI, maintained under the `ScrapeGraphAI` GitHub
  organization.
- Upstream package: https://pypi.org/project/scrapegraphai/
- Upstream documentation: https://docs.scrapegraphai.com/introduction
- License: MIT, per the upstream repository.
- Icon source: `docs/assets/scrapegraphai_logo.svg` copied from the upstream
  ScrapeGraphAI repository tree.

## Security and Secret Notes

- The default template uses no API keys, private tokens, passwords, connection
  strings, host bind mounts, Docker socket mounts, GPU devices, privileged mode, host
  networking, host IPC, or host PID mode.
- The demo endpoints are unauthenticated because they only expose package metadata
  and deterministic local HTML-to-Markdown conversion output.
- Full AI scraping workflows can send prompts, source content, extracted data, and
  browsing targets to model or scraping providers. Review provider data handling and
  Phala Cloud environment-variable handling before adding credentials.
- Keep real secrets in Phala Cloud environment variables or secret handling, and mark
  required credentials as `required=true` in the config only after the compose file
  actually consumes them.
- Respect target-site terms, robots policies, rate limits, and applicable law when
  adapting this smoke demo into a real scraper.
