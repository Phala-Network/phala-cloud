# TauricResearch/TradingAgents

Deploy a CPU-safe TradingAgents framework verifier on Phala Cloud.

## Metadata

- Template id: `tradingagents`
- Display name: `TauricResearch/TradingAgents`
- Category: AI Apps & Workflows
- Upstream repository: https://github.com/TauricResearch/TradingAgents
- Upstream package: `tradingagents`
- Icon source: upstream README image `assets/TauricResearch.png`, saved as `templates/icons/tradingagents.png`
- Upstream author: TauricResearch, via the `TauricResearch/TradingAgents` GitHub repository

## Overview

TradingAgents is a multi-agent LLM financial trading framework. The upstream project provides an interactive CLI and package API that coordinate analyst, researcher, trader, risk, and portfolio-manager agents. Real analysis requires an LLM provider and market-data access, and the upstream Docker path expects a local `.env` file with API keys.

This Phala Cloud template runs a deterministic HTTP verifier instead of the interactive CLI. On startup it installs the real upstream source archive from GitHub, imports the `tradingagents` package, and exposes JSON endpoints that exercise local framework primitives:

- structured-output Pydantic models for the Research Manager, Trader, and Portfolio Manager
- upstream markdown render helpers
- model catalog metadata
- deterministic rating parsing through `SignalProcessor`

The default path does not instantiate `TradingAgentsGraph`, call any LLM provider, fetch market data, download model weights, require a browser login, mount host files, or need credentials. The `/demo` response is a fixed synthetic smoke test and is not financial advice.

## Services

- `app`: Python HTTP service on `ghcr.io/astral-sh/uv:python3.12-bookworm-slim`. It installs `TradingAgents` from `https://github.com/TauricResearch/TradingAgents/archive/<ref>.tar.gz` and serves the verifier API.

## Ports

- `8080`: Public HTTP endpoint mapped to the internal app port.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `TRADINGAGENTS_REF` | No | `main` | Upstream TradingAgents branch, tag, or commit archive ref installed at container startup. |
| `APP_PORT` | No | `8000` | Internal HTTP port used by the demo service. The template publishes it through host port `8080`. |

For a real TradingAgents analysis service, configure the upstream-supported provider and data credentials in a custom deployment. Common upstream variables include `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `DEEPSEEK_API_KEY`, `DASHSCOPE_API_KEY`, `ZHIPU_API_KEY`, `MINIMAX_API_KEY`, `OPENROUTER_API_KEY`, and `ALPHA_VANTAGE_API_KEY`. They are intentionally not required by this template because the smoke path must run without secrets.

## Deploy

1. Deploy the `tradingagents` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `TRADINGAGENTS_REF` to a released upstream tag or commit.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads Python dependencies and the upstream source archive. No GPU, privileged mode, host networking, host IPC, host bind mount, Docker socket, `env_file`, or real secret is used.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the upstream package imports and the verifier is ready.
- `GET /demo`: Runs the deterministic local framework smoke test and returns rendered structured-output artifacts.
- `GET /v1/models`: Returns an OpenAI-style model list identifying the local no-LLM verifier.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "llm_provider_calls": false,
  "market_data_calls": false,
  "model_downloaded": false,
  "demo": {
    "ticker": "DEMO",
    "signal_processor_rating": "Hold",
    "parse_rating_result": "Hold",
    "financial_advice": false
  }
}
```

## Local Smoke Verification

Run locally from the `sdks/` directory to verify the service endpoints:

```bash
docker compose -f templates/prebuilt/tradingagents/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/tradingagents/docker-compose.yml down
```

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/tradingagents/docker-compose.yml config >/dev/null
```

## Production Notes

- This template is a verifier for the framework package, not an authenticated trading application.
- Upstream TradingAgents real analysis uses LLM and market-data providers. Add only the credentials required for your selected provider and data source in a custom deployment.
- Do not place real API keys, tokens, private keys, OTPs, or passwords in the Compose file.
- The demo endpoints are unauthenticated. Put an authenticated gateway in front before exposing private workflows.
- The default service does not persist TradingAgents decision logs or checkpoints. Add named volumes if you adapt it into a stateful production service.
- The upstream Docker Compose uses a build context and `env_file`, so this template uses an inline HTTP verifier instead to meet Phala Cloud template constraints.
- The `/demo` endpoint uses a synthetic ticker and fixed local inputs. It is not investment, financial, or trading advice.

## Cleanup

For a local test run from `sdks/`, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/tradingagents/docker-compose.yml down
```
