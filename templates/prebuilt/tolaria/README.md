# refactoringhq/tolaria

Deploy a CPU-safe Tolaria source verifier on Phala Cloud.

## Overview

Tolaria is a Tauri, React, and TypeScript desktop app for managing Markdown knowledge bases. It is local-first, Git-first, and designed around folders of plain Markdown files with YAML frontmatter. The upstream project targets macOS, Windows, and Linux desktop usage rather than a containerized web service.

This Phala Cloud template intentionally runs a no-credential HTTP verifier instead of pretending the desktop app is a production server. At startup it downloads the pinned upstream GitHub source tarball, extracts it into a named Docker volume, verifies important Tolaria files, and exposes JSON endpoints that summarize the real upstream package metadata, Tauri config, docs, and bundled `demo-vault-v2` Markdown vault.

The verifier does not call LLM providers, use browser authentication, download model weights, require GPU, install desktop WebKitGTK packages, run a browser, use host bind mounts, use `env_file`, or require real secrets.

## Metadata

- Template id: `tolaria`
- Display name: `refactoringhq/tolaria`
- Category: AI Apps & Workflows
- Description: Desktop app to manage markdown knowledge bases
- Upstream repository: https://github.com/refactoringhq/tolaria
- Upstream docs inspected: `README.md`, `docs/GETTING-STARTED.md`, `docs/ARCHITECTURE.md`, `site/start/install.md`, `site/start/first-launch.md`, `.env.example`, `package.json`, and `src-tauri/tauri.conf.json`
- Default upstream source ref: `b92d0c7db24cab0461cd81f36c21511cff243c3d`
- Source artifact: GitHub repository tarball for the selected `TOLARIA_REF`
- Icon source: upstream `src/assets/tolaria-icon.svg`, saved in this templates repo as `templates/icons/tolaria.svg`
- Upstream author: `refactoringhq`

## What This Template Runs

- `app`: A `python:3.12-slim-bookworm` HTTP verifier service listening on port `8080`.
- Persistence: named volume `tolaria-source`, used only to cache the downloaded upstream source between restarts.
- Credentials: none required.

The verifier checks that the real upstream source contains the expected app files, including:

- `package.json` with the `tolaria` package, React, Tauri, BlockNote, CodeMirror, Vite, Vitest, and Playwright metadata.
- `src-tauri/tauri.conf.json` with the Tolaria product name, desktop window config, deep-link scheme, updater config, bundle targets, and build commands.
- `docs/GETTING-STARTED.md` with the documented `pnpm dev` browser mock mode and `pnpm tauri dev` desktop flow.
- `docs/ARCHITECTURE.md` with filesystem-first, Markdown/frontmatter, Git, and AI workspace design markers.
- `demo-vault-v2` with real Markdown files, type documents, wikilinks, attachments, and saved views used as a deterministic demo vault.

## Deployment Steps

1. Deploy the `tolaria` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `TOLARIA_REF` to another branch, tag, or commit from `refactoringhq/tolaria`.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the upstream source tarball from GitHub. No package manager install, model download, provider credential, or desktop runtime is needed.

For a local check from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/tolaria/docker-compose.yml config
docker compose -f templates/prebuilt/tolaria/docker-compose.yml up -d
```

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `TOLARIA_REF` | No | `b92d0c7db24cab0461cd81f36c21511cff243c3d` | Git branch, tag, or commit downloaded from `refactoringhq/tolaria` at startup. The default is the upstream `main` HEAD inspected for this template. |
| `TOLARIA_FETCH_TIMEOUT_SECONDS` | No | `120` | Timeout for downloading the upstream GitHub source tarball during bootstrap. |
| `PORT` | No | `8080` | Internal HTTP port listened on by the verifier and published by the Compose file. |

The upstream `.env.example` includes placeholders such as `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY`, `LARA_ACCESS_KEY_ID`, and `LARA_ACCESS_KEY_SECRET` for development, telemetry, release, or localization workflows. They are not required or consumed by this verifier. Do not place real API keys, tokens, passwords, private keys, OTPs, or browser cookies in this Compose file.

## Exposed Endpoints

- `GET /healthz`: Downloads or reuses the pinned source, verifies required upstream files, checks package/Tauri markers, and returns HTTP 200 only when the verifier is ready.
- `GET /demo`: Returns deterministic source inspection details, including package metadata, Tauri desktop configuration, docs markers, and a summary of the bundled Markdown demo vault.
- `GET /v1/models`: Returns an OpenAI-style model list containing `tolaria/local-source-verifier`. This is a compatibility endpoint only; the template does not host or call a model.
- `GET /upstream`: Returns the upstream repository, pinned source artifact details, docs inspected, icon source, runtime guards, and production notes.
- `GET /`: Same readiness payload as `/healthz`.

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
  "demo_type": "deterministic Tolaria source and demo-vault verifier",
  "runtime_guards": {
    "credentials_required": false,
    "llm_provider_calls": false,
    "browser_auth_required": false,
    "model_downloaded": false,
    "gpu_required": false
  }
}
```

Counts in the `demo_vault` object can change if you override `TOLARIA_REF` to a newer upstream revision.

## Smoke Verification

Use these commands to verify the source-verifier service and its deterministic endpoints before deploying.

Run locally from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/tolaria/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/upstream
docker compose -f templates/prebuilt/tolaria/docker-compose.yml down
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `/demo` includes `package.name` as `tolaria`.
- `/demo` includes `tauri.product_name` as `Tolaria`.
- `/demo` includes a nonzero `demo_vault.markdown_file_count`.
- `/v1/models` includes `tolaria/local-source-verifier`.

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/tolaria/docker-compose.yml config >/dev/null
```

If your local shell provides only `python3`, that interpreter is fine as long as `jsonschema` is installed.

## Production Notes

- This template is a verifier for the upstream source artifact, not a replacement for the Tolaria desktop app.
- Tolaria's full workflow depends on the native Tauri runtime for local filesystem access, Git workflows, desktop windows, update handling, deep links, and app settings.
- The upstream docs document `pnpm dev` for browser mock mode on `http://localhost:5173`, but that mode is a development preview and does not provide the full desktop runtime.
- For full usage, install Tolaria through upstream releases, Homebrew, or build the native app with `pnpm install` and `pnpm tauri build` on a supported desktop environment.
- AI agent and provider workflows should be configured in the desktop app with user-owned credentials. The verifier does not consume `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, browser sessions, or model-provider tokens.
- The verifier endpoints are unauthenticated. Add access control before adapting this into any private source-inspection or documentation service.
- The named volume only caches the downloaded upstream source. Delete `tolaria-source` if you need a clean refetch.

## Cleanup

For a local test run from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/tolaria/docker-compose.yml down
```
