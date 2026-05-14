# LLM Wiki on Phala Cloud

LLM Wiki is a personal knowledge-base application that turns unstructured documents into an interlinked wiki with source traceability, graph insights, review queues, and deep research workflows.

The upstream project is primarily a Tauri desktop app, not a server app. This Phala template provides a browser-accessible development workspace for the React frontend so users can inspect, customize, and iterate on the app inside a confidential VM.

## Service

- `llm-wiki`: clones `nashsu/llm_wiki`, installs dependencies, and starts the Vite dev server.

## Port

- `1420`: LLM Wiki frontend preview.

## Optional environment variables

```bash
LLM_PROVIDER=ollama
OLLAMA_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.1
MINIMAX_API_KEY=
MINIMAX_MODEL=
MINIMAX_ENDPOINT=
```

Provider credentials can also be configured in the app settings when running the full Tauri desktop build.

## Persistent data

The template creates these volumes:

- `llm_wiki_repo`: cloned source checkout and local project files.
- `llm_wiki_npm_cache`: npm cache to make restarts faster.

## Deploy

```bash
docker compose up -d
```

Open port `1420` to view the frontend preview.

## Important limitation

LLM Wiki's full document ingest, local file-system access, Chrome extension bridge, and persistent desktop app behavior depend on the Tauri runtime. The upstream project does not ship a Dockerfile or production web server. For full usage, build or install the desktop app from the upstream repository:

```bash
npm install
npm run tauri build
```

This template is best used as a confidential development workspace and deployable preview, not as a complete replacement for the native desktop app.
