# mvanhorn/last30days-skill

Deploy a CPU-safe verifier for the `last30days` agent skill on Phala Cloud.

## Metadata

- Template id: `last30days-skill`
- Display name: `mvanhorn/last30days-skill`
- Category: AI Apps & Workflows
- Upstream repository: https://github.com/mvanhorn/last30days-skill
- Upstream source ref: `26da1e157cc83aba5b782fd3662627535e81bbc7`
- Upstream version inspected: `3.3.1`
- Template repository path: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/last30days-skill
- Icon source: GitHub owner avatar fallback, `https://github.com/mvanhorn.png?size=256`, saved as `last30days-skill.jpg` because GitHub serves JPEG content. The upstream README/tree does not contain a dedicated logo, favicon, or template icon; it only includes badges and unrelated demo media assets.
- Upstream author: Matt Van Horn / `mvanhorn`, via the `mvanhorn/last30days-skill` GitHub repository

## Overview

`last30days` is an agent skill for researching recent discussion around a topic across Reddit, X, YouTube, TikTok, Instagram, Hacker News, Polymarket, GitHub, Perplexity, and web search. The upstream README describes it as an AI agent-led search engine that scores signals by public engagement such as upvotes, likes, and prediction-market odds, then asks the host agent to synthesize a grounded brief.

The upstream runtime is not a normal long-running web server. It is a Claude Code, OpenClaw, Codex, Cursor, Copilot, Gemini CLI, or Agent Skills host integration. The runtime contract lives in `skills/last30days/SKILL.md`, while the executable Python source lives in `skills/last30days/scripts`.

This Phala template therefore runs a small deterministic HTTP verifier instead of trying to host the full agent workflow. On startup it downloads the pinned upstream GitHub source archive, imports real upstream modules from `skills/last30days/scripts`, parses a local Atom sample through the upstream Reddit RSS parser, exercises local Hacker News and Polymarket parsing helpers, and exposes JSON endpoints for smoke testing.

The default verifier does not call an LLM provider, does not run browser authentication, does not call social media APIs, does not download model weights, and does not require credentials. It uses the real upstream source artifact but keeps all research behavior local and deterministic.

## What This Template Runs

- `app`: Python 3.12 HTTP service listening internally on `8000` and published as `8080`.
- The service downloads `https://github.com/mvanhorn/last30days-skill/archive/26da1e157cc83aba5b782fd3662627535e81bbc7.tar.gz` into `/tmp`.
- The service imports upstream modules including `last30days`, `lib.schema`, `lib.query`, `lib.categories`, `lib.reddit_rss`, `lib.hackernews`, `lib.polymarket`, and `lib.skill_meta`.
- The `/demo` endpoint exercises upstream local parsing and dataclass primitives against deterministic sample data.

The upstream `pyproject.toml` currently declares `last30days-skill` version `3.3.1` with no Python dependencies, but a direct local `pip install` fails because setuptools discovers multiple top-level directories in the flat repository layout. This verifier uses the upstream source archive directly for that reason.

## Deployment Steps

1. Deploy the `last30days-skill` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `LAST30DAYS_SOURCE_REF` to a different upstream commit, tag, or branch if you want to verify another source snapshot.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first request may take a little longer because the service downloads and extracts the upstream source archive. No API keys are required for the default verifier.

## Environment Variables

These variables are used by the default verifier:

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `APP_PORT` | No | `8000` | Internal HTTP port used by the Python verifier. The compose file publishes `8080:8000`. |
| `LAST30DAYS_SOURCE_REF` | No | `26da1e157cc83aba5b782fd3662627535e81bbc7` | Upstream commit, tag, or branch archive ref downloaded by the verifier at startup. |
| `LAST30DAYS_VERIFY_TIMEOUT_SECONDS` | No | `15` | Timeout for the public GitHub source archive download. |
| `LAST30DAYS_DEMO_TOPIC` | No | `AI agent research across social sources` | Default topic used by `/demo` when no `topic` query parameter is supplied. |

The default verifier does not read provider or social API credentials. If you adapt this template into a full `last30days` agent host, upstream documents these optional credential names:

| Variable | Production Use |
| --- | --- |
| `SCRAPECREATORS_API_KEY` | Enables TikTok, Instagram, Threads, Pinterest, and some fallback scraping paths. |
| `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY` | Optional reasoning, planning, reranking, X, or Perplexity provider credentials depending on the selected upstream mode. |
| `BRAVE_API_KEY`, `EXA_API_KEY`, `SERPER_API_KEY`, `PARALLEL_API_KEY` | Optional web search backends for auto-resolve and supplemental web search. |
| `AUTH_TOKEN`, `CT0`, `FROM_BROWSER` | Optional X browser-session auth modes used by upstream clients. Do not put browser cookies into this demo compose file. |
| `BSKY_HANDLE`, `BSKY_APP_PASSWORD`, `TRUTHSOCIAL_TOKEN`, `APIFY_API_TOKEN` | Optional source-specific credentials for Bluesky, Truth Social, or Apify-backed fallbacks. |
| `INCLUDE_SOURCES`, `EXCLUDE_SOURCES`, `LAST30DAYS_MEMORY_DIR`, `LAST30DAYS_CONFIG_DIR` | Optional upstream controls for source selection, output paths, and `.env` lookup when running the full skill. |

Never include real API keys, tokens, cookies, browser sessions, OTPs, passwords, or private keys in the compose file.

## Exposed Endpoints

- `GET /healthz`: Downloads/imports the pinned upstream source archive and returns readiness metadata. Returns `200` only when imports succeed.
- `GET /demo`: Runs a deterministic source verifier using real upstream modules and local sample data. Optional query parameter: `?topic=<topic>`.
- `GET /v1/models`: Returns an OpenAI-style model list identifying the local verifier. No model is loaded or served.
- `GET /`: Returns the available endpoint list.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS "https://<your-app-domain>/demo?topic=AI%20agent%20frameworks"
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "demo": {
    "skill_version": "3.3.1",
    "source_parsers": {
      "reddit_rss_fixture_count": 3,
      "hackernews_mock_count": 1,
      "polymarket_outcome_prices": [
        {
          "outcome": "Yes",
          "probability": 0.65
        }
      ]
    },
    "remote_calls": {
      "llm_provider_calls": false,
      "social_api_calls": false,
      "browser_auth": false,
      "model_downloaded": false,
      "model_loaded": false
    }
  }
}
```

## Smoke Verification

Run locally from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/last30days-skill/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS "http://localhost:8080/demo?topic=AI%20agent%20frameworks"
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/last30days-skill/docker-compose.yml down
```

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/last30days-skill/docker-compose.yml config >/dev/null
```

## Production Notes

- The default service is a verifier, not the full `/last30days` agent-host experience.
- For the full upstream workflow, install the skill in a supported agent host using the upstream instructions, such as `npx skills add mvanhorn/last30days-skill -g` or the Claude Code marketplace command.
- Reddit public RSS, Hacker News, Polymarket, and some GitHub paths can work without secrets upstream. X, paid web search, Perplexity, ScrapeCreators-backed sources, Bluesky, Truth Social, and browser-authenticated modes require user-supplied credentials or local browser sessions.
- The verifier intentionally avoids provider calls, browser cookies, and model downloads so it can start on small CPU-only Phala resources.
- The endpoints are unauthenticated. Add authentication or a trusted reverse proxy before exposing any adapted production workflow that can run real research or handle secrets.
- If you convert this verifier into a full agent runtime, add persistent storage for `LAST30DAYS_MEMORY_DIR` and any upstream SQLite store paths. The default verifier uses `/tmp` only and does not persist research data.
- Do not add host bind mounts, Docker socket mounts, privileged mode, host networking, host IPC, `env_file`, or real secrets to this compose file.

## Cleanup

For a local test run from the parent worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/last30days-skill/docker-compose.yml down
```
