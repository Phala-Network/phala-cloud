# jwasham/coding-interview-university

Deploy a CPU-safe Coding Interview University source verifier on Phala Cloud.

## Metadata

- Template id: `coding-interview-university`
- Display name: `jwasham/coding-interview-university`
- Category: AI Apps & Workflows
- Description: A complete computer science study plan to become a software engineer.
- Upstream repository: https://github.com/jwasham/coding-interview-university
- Upstream docs inspected: `README.md`, `programming-language-resources.md`, `extras/cheat sheets/*.pdf`, and translation README files
- Default upstream source ref: `717298bf219a30d7fb0671285c5f057b1bb74b27`
- Icon source: first image referenced by the upstream README, `https://d3j2pkmjtin6ou.cloudfront.net/coding-at-the-whiteboard-silicon-valley.png`, saved in this templates repo as `templates/icons/coding-interview-university.png`
- Upstream author: `jwasham`

## Overview

Coding Interview University is a large Markdown study plan for learning the computer science topics commonly needed for software engineering interviews. The upstream project is not a server application and does not publish an official Docker image, package runtime, API service, or no-secret production container. Its README documents reading the plan directly, downloading a ZIP, or cloning/forking the repository to track checkbox progress.

This template therefore runs a deterministic source verifier instead of pretending the study plan is a hosted app. At startup it downloads the pinned upstream GitHub source tarball, safely extracts it into a named Docker volume, verifies key upstream files, and exposes JSON endpoints that summarize the real README, translations, checklist counts, topic headings, and bundled cheat sheets.

The default path is CPU-only and requires no credentials. It does not call any LLM provider, use browser authentication, download model weights, require GPU, use host bind mounts, use `env_file`, request privileged mode, or use host networking/IPC.

## Services

- `app`: Python HTTP verifier service based on `python:3.12-slim-bookworm`.

The service uses the named Docker volume `ciu-cache` to cache the downloaded upstream source between restarts.

## Ports

- `8080`: Public HTTP endpoint for health, source demo, and model-list style checks.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `CIU_REF` | No | `717298bf219a30d7fb0671285c5f057b1bb74b27` | Git branch, tag, or commit downloaded from `jwasham/coding-interview-university` at startup. The default is the upstream `main` HEAD inspected for this template. |
| `CIU_FETCH_TIMEOUT_SECONDS` | No | `120` | Timeout for downloading the upstream GitHub source tarball during bootstrap. |
| `PORT` | No | `8080` | HTTP port listened on inside the container and published by the Compose file. |

## Deploy

1. Deploy the `coding-interview-university` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `CIU_REF` to a specific upstream branch, tag, or commit.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the upstream source tarball from GitHub. No package manager install, model download, or provider credential is needed.

## Usage Endpoints

- `GET /healthz`: Returns `200` when the pinned upstream source has been downloaded and required files are present.
- `GET /demo`: Parses the real upstream `README.md` and returns deterministic source verification details, including study-plan headings, translation count, task counts, sample unchecked tasks, and bundled cheat sheets.
- `GET /v1/models`: Returns an OpenAI-style model list containing `coding-interview-university/no-llm-study-plan-verifier`. This is a compatibility endpoint only; it does not host or call a model.
- `GET /upstream`: Returns the upstream repository, cached source ref, inspected docs, source checks, and production notes.
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
  "runtime_guards": {
    "credentials_required": false,
    "llm_provider_calls": false,
    "browser_auth": false,
    "model_downloaded": false,
    "gpu_required": false
  },
  "demo": {
    "source_artifact": "GitHub tarball",
    "study_plan": {
      "title": "Coding Interview University",
      "translation_count": 16,
      "study_topic_count": 13
    }
  }
}
```

Counts can change if you override `CIU_REF` to a newer upstream revision.

## Smoke Verification

Use these commands from the parent monorepo worktree to verify the service:

```bash
docker compose -f templates/prebuilt/coding-interview-university/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/coding-interview-university/docker-compose.yml down
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/coding-interview-university/docker-compose.yml config >/dev/null
```

## Production Notes

- The default template is a verifier for the upstream source artifact, not an editor, LMS, progress tracker, or interview-practice platform.
- Upstream usage is Markdown-centric. To track personal progress, fork or clone the upstream repository and edit checkbox state in your own copy.
- The verifier endpoints are unauthenticated. Add an authenticated reverse proxy before adapting this into a private progress-tracking service.
- The container caches the upstream tarball extraction in `ciu-cache`; delete the volume if you need a clean refetch.
- Do not put API keys, access tokens, passwords, private keys, OTPs, or browser cookies in this Compose file. The default verifier does not need secrets.
- A production application built around this content should separately address attribution, license compliance for the CC-BY-SA-4.0 upstream content, authentication, user progress storage, backups, and any UI/editor security model.

## Cleanup

For a local test run from the parent monorepo worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/coding-interview-university/docker-compose.yml down
```
