# run-llama/liteparse

Deploy a CPU-safe LiteParse document parser smoke service on Phala Cloud.

## Metadata

- Template id: `liteparse`
- Display name: `run-llama/liteparse`
- Category: AI Apps & Workflows
- Upstream repository: https://github.com/run-llama/liteparse
- Upstream server wrapper: https://github.com/run-llama/liteparse-server
- NPM package: `@llamaindex/liteparse`
- Default server image: `ghcr.io/run-llama/liteparse-server:main`
- Icon source: upstream LiteParse README image, `https://github.com/user-attachments/assets/07ba6a82-6bb1-4dea-b0ef-cad7df7d1622`, inspected from `run-llama/liteparse` commit `cf9f08fe89a2b63478dece44f0a0c0030261ae85` and resized to `templates/icons/liteparse.png`
- Upstream author: `run-llama`

## What This Template Runs

LiteParse is a local, open-source document parser focused on fast spatial text extraction. The upstream README documents Rust, Node.js, Python, WASM, and CLI bindings, and the LiteParse documentation also publishes a slim HTTP server image through `liteparse-server`.

This Phala Cloud template runs the official slim `liteparse-server` image on the private Compose network and exposes it through Caddy. It also runs a small Python verifier service that provides `/healthz`, `/demo`, and `/v1/models` for Phala smoke checks.

The `/demo` endpoint generates a one-page in-memory PDF, posts it to the upstream `POST /parse?text=true` endpoint with OCR disabled, and returns the parsed text plus verification metadata. The default path does not require credentials, does not call LlamaParse or any hosted LLM/model provider, does not download model weights, and does not use browser authentication.

## Services

- `liteparse`: Official upstream slim LiteParse HTTP server image, listening internally on port `5000`.
- `verifier`: Private Python HTTP verifier on port `8000`; it probes and exercises `liteparse`.
- `proxy`: Caddy reverse proxy listening on public port `8080` locally. It routes `/parse` and `/screenshots` to the upstream LiteParse server and all other smoke endpoints to the verifier.

## Environment Variables

No secrets are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `LITEPARSE_SERVER_IMAGE` | No | `ghcr.io/run-llama/liteparse-server:main` | Upstream LiteParse server image. Pin to a digest or known tag for stricter production reproducibility. |
| `LITEPARSE_DEMO_TEXT` | No | `LiteParse Phala Cloud demo` | Text embedded into the generated demo PDF and checked in the `/demo` response. |

The internal `LITEPARSE_SERVER_URL` is set to `http://liteparse:5000` by the compose file and normally should not be changed.

## Deploy

1. Deploy the `liteparse` template on Phala Cloud.
2. Keep the default CPU-only resources for the smoke service: 1 vCPU, 2048 MB memory, and 20 GB disk.
3. Leave `LITEPARSE_SERVER_IMAGE` at the default for a quick no-secret deployment, or pin it before production use.
4. Open `https://<your-app-domain>/healthz` after the service starts.

The default deployment pulls the upstream server image from GitHub Container Registry. Runtime parsing is local and deterministic for the included demo PDF.

## Endpoints

- `GET /healthz`: Checks that the upstream LiteParse server is reachable by sending `POST /parse` without a file and expecting the documented `400` response.
- `GET /demo`: Generates a small local PDF, sends it to `POST /parse?text=true` with OCR disabled, and verifies the expected text is returned.
- `GET /v1/models`: Returns an OpenAI-style metadata list for compatibility checks. It is not a hosted LLM endpoint.
- `GET /`: Returns a compact endpoint index.
- `POST /parse`: Proxies to upstream LiteParse. Upload a `file` form field and optionally a JSON `config` form field. Add `?text=true` for plain text output.
- `POST /screenshots`: Proxies to upstream LiteParse screenshot generation. Upload a `file` form field and optionally a JSON `config` form field.

Example smoke checks to verify the deployed service:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "demo": {
    "contains_expected_text": true,
    "credentials_required": false,
    "hosted_model_call_attempted": false,
    "model_weights_downloaded": false,
    "ocr_enabled": false
  }
}
```

Example parser call with your own PDF:

```bash
curl -X POST "https://<your-app-domain>/parse?text=true" \
  -F "file=@document.pdf" \
  -F 'config={"ocrEnabled":false,"maxPages":5}'
```

Example screenshot call:

```bash
curl -X POST "https://<your-app-domain>/screenshots?pages=1" \
  -F "file=@document.pdf" \
  -F 'config={"ocrEnabled":false}'
```

## Local Verification

Use these commands from the parent monorepo worktree to verify the template metadata and compose file:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/liteparse/docker-compose.yml config >/dev/null
```

Optional local smoke run:

```bash
docker compose -f templates/prebuilt/liteparse/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/liteparse/docker-compose.yml down
```

If local port `8080` is already in use, temporarily change only the host side of the proxy mapping, for example `18080:80`, then use `http://localhost:18080/healthz`.

## Production Notes

- This is a small no-secret parser deployment, not the full LiteParse production observability stack.
- The default image is the upstream slim server documented by LiteParse. The full upstream server example adds Redis caching, rate limiting, OpenTelemetry tracing, Jaeger, Prometheus, and Grafana; deploy those deliberately and size the CVM for them if you need that stack.
- Add authentication, authorization, content-length limits, file-type allowlists, request timeouts, logging, and abuse controls before accepting private or untrusted documents.
- The template disables OCR only for the generated `/demo` PDF. Real parser calls can enable OCR through LiteParse config, which increases CPU and memory use.
- Office document and image conversion depend on the upstream server image's included tooling. Test your real document formats and expected concurrency before production use.
- Pin `LITEPARSE_SERVER_IMAGE` to a digest or release tag for reproducibility. The default `main` tag follows upstream changes.
- The `/v1/models` endpoint is compatibility metadata only; no LLM model is hosted, downloaded, or called.

## Security Notes

- No credentials are required for the default template.
- Do not put API keys, bearer tokens, private keys, OTPs, or passwords in the compose file.
- The compose file does not use `env_file`, host bind mounts, privileged mode, host networking, host IPC, Docker socket access, GPU device reservations, or external build contexts.
- Caddy is the only public service. The upstream LiteParse server and verifier are reachable only on the internal Compose network.

## Upstream Attribution

This template uses the official LiteParse project and server wrapper:

- LiteParse repository: https://github.com/run-llama/liteparse
- LiteParse docs: https://developers.llamaindex.ai/liteparse/
- Library usage docs: https://developers.llamaindex.ai/liteparse/guides/library-usage/
- Server usage docs: https://developers.llamaindex.ai/liteparse/guides/server-usage/
- Server repository: https://github.com/run-llama/liteparse-server
- Server image documented by upstream: `ghcr.io/run-llama/liteparse-server:main`
