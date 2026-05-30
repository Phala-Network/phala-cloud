# microsoft/markitdown

Deploy a CPU-safe MarkItDown conversion verifier on Phala Cloud.

## Metadata

- Template id: `markitdown`
- Display name: `microsoft/markitdown`
- Category: AI Apps & Workflows
- Upstream repository: https://github.com/microsoft/markitdown
- Python package: `markitdown`
- Default package version: `0.1.6`
- Icon source: GitHub organization avatar fallback, `https://github.com/microsoft.png`. The upstream README and repository tree do not include a dedicated MarkItDown logo, icon, or favicon asset.
- Upstream author: Microsoft, via the `microsoft/markitdown` GitHub repository

## What This Template Runs

MarkItDown is a Python utility for converting files and office documents to Markdown for LLM and text-analysis workflows. Upstream documents both CLI usage and a Python API, plus a Docker image shape whose entrypoint is the `markitdown` command.

This Phala Cloud template runs a minimal HTTP verifier behind Caddy on port `80`. The app image installs the real `markitdown` Python package with local document extras for DOCX, XLSX, PPTX, and PDF support. At runtime it imports `markitdown`, checks expected package symbols, performs a local text conversion for health, and exposes deterministic JSON endpoints.

The `/demo` endpoint creates temporary local HTML, CSV, DOCX, XLSX, and PPTX files, converts them with `MarkItDown.convert_local()`, and returns Markdown previews and checksums. It does not accept arbitrary uploaded files, follow remote URLs, enable plugins, call Azure Document Intelligence, call Azure Content Understanding, call an LLM provider, download model weights, require a GPU, or require credentials.

## Services

- `app`: Private Python HTTP service on the internal Compose network, listening on port `8000`.
- `proxy`: Caddy reverse proxy listening on public port `8080` locally and forwarding to `app:8000`.

## Environment Variables

No secrets are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `MARKITDOWN_PACKAGE_VERSION` | No | `0.1.6` | MarkItDown Python package version installed in the demo image. |

## Deploy

1. Deploy the `markitdown` template on Phala Cloud.
2. Keep the default CPU resources for this smoke demo: 1 vCPU, 2048 MB memory, and 20 GB disk.
3. Leave `MARKITDOWN_PACKAGE_VERSION` at `0.1.6` unless you intentionally want to test another published package version.
4. Open `https://<your-app-domain>/healthz` after the image build and startup finish.

The image build downloads Python wheels from PyPI. The runtime demo is local and deterministic.

## Endpoints

- `GET /healthz`: Imports `markitdown`, checks package metadata and symbols, and verifies a local text conversion.
- `GET /demo`: Converts deterministic local HTML, CSV, DOCX, XLSX, and PPTX samples to Markdown without external providers.
- `GET /v1/models`: Returns an OpenAI-style metadata list for compatibility checks. It is not a hosted LLM.
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
  "demo": {
    "credentials_required": false,
    "hosted_model_call_attempted": false,
    "remote_url_conversion_attempted": false,
    "formats": {
      "docx": {
        "contains_expected_text": true
      },
      "xlsx": {
        "contains_expected_text": true
      }
    }
  }
}
```

## Local Verification

Use these commands to verify the compose file and smoke endpoints before deployment.

Run from the `sdks/` checkout:

```bash
docker compose -f templates/prebuilt/markitdown/docker-compose.yml config >/tmp/markitdown-compose.out
docker compose -f templates/prebuilt/markitdown/docker-compose.yml up -d --build
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/upstream
docker compose -f templates/prebuilt/markitdown/docker-compose.yml down
```

If local port `8080` is already in use, temporarily change only the host side of the proxy mapping, for example `18080:80`, then use `http://localhost:18080/healthz`.

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/markitdown/docker-compose.yml config >/dev/null
```

## Limitations And Production Caveats

- This is a no-credential verifier, not a production document conversion API.
- The demo intentionally does not expose a file upload endpoint. Add authentication, authorization, content-length limits, file-type allowlists, request logging, and abuse controls before accepting user-supplied documents.
- Upstream warns that MarkItDown performs I/O with the privileges of the current process. For server-side use, sanitize inputs, restrict URI schemes and network destinations, and call the narrowest API that fits your workload, such as `convert_local()` or `convert_stream()`.
- The default package extras cover DOCX, XLSX, PPTX, and PDF conversion. Audio transcription, YouTube transcription, Azure Document Intelligence, Azure Content Understanding, and LLM image-description flows are not enabled by this template.
- Real Azure Document Intelligence or Azure Content Understanding usage is billable and requires explicit endpoint configuration and credentials outside this no-secrets demo.
- The endpoints are unauthenticated. Put a gateway, token check, or another access-control layer in front of any private production deployment.
- Keep `MARKITDOWN_PACKAGE_VERSION` pinned for reproducible deployments.

## Security Notes

- No secrets are required for the default template.
- Do not put API keys, bearer tokens, private keys, OTPs, or passwords in the compose file.
- The compose file does not use `env_file`, host bind mounts, privileged mode, host networking, host IPC, Docker socket access, GPU device reservations, or external build contexts.
- Caddy is the only public service. The Python app is reachable only on the internal Compose network.

## Upstream Attribution

This template installs and imports the real `markitdown` Python package from Microsoft's upstream MarkItDown project:

- Repository: https://github.com/microsoft/markitdown
- Package index: https://pypi.org/project/markitdown/
- Dockerfile inspected: https://github.com/microsoft/markitdown/blob/main/Dockerfile
- Icon fallback: https://github.com/microsoft.png
