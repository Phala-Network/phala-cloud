# aquasecurity/trivy

Deploy a CPU-safe Trivy verifier on Phala Cloud.

## Deploy, Check, Customize

1. Deploy the `trivy` template on Phala Cloud.
2. Keep the default `tdx.small`-class CPU resources for the verifier.
3. Open `https://<your-app-domain>/healthz` after startup completes.
4. Run `https://<your-app-domain>/demo` to execute the local Trivy filesystem secret-scan smoke test.
5. Optional: set `TRIVY_VERSION` to another compatible upstream release version such as `0.71.0`.

## Overview

Trivy is Aqua Security's open source security scanner for containers, filesystems, Git repositories, Kubernetes, virtual machine images, and cloud environments. It can find vulnerabilities, misconfigurations, secrets, software licenses, and generate SBOM output.

This Phala Cloud template intentionally runs a no-credential verifier rather than a registry, Kubernetes, or cloud scanner. At startup it downloads the real upstream Trivy release archive from GitHub, installs the `trivy` CLI, and starts a small Python HTTP service behind Caddy. The `/demo` endpoint creates a temporary local project containing public dummy token values, runs `trivy fs --scanners secret` with DB updates skipped, parses Trivy's JSON output, and returns a redacted finding summary.

The default path does not need Docker socket access, registry credentials, cloud credentials, Kubernetes credentials, provider API keys, browser authentication, GPU access, model calls, or model-weight downloads.

## Metadata

- Template id: `trivy`
- Display name: `aquasecurity/trivy`
- Category: AI Apps & Workflows
- Upstream repository: https://github.com/aquasecurity/trivy
- Upstream documentation: https://trivy.dev/latest/docs/
- Filesystem scan docs: https://trivy.dev/latest/docs/target/filesystem/
- Client/server docs: https://trivy.dev/latest/docs/references/modes/client-server/
- Upstream release used by default: https://github.com/aquasecurity/trivy/releases/tag/v0.71.0
- Icon source: `trivy.png` is copied from the upstream README logo at `docs/imgs/logo.png`
- Upstream author: aquasecurity, via the `aquasecurity/trivy` GitHub repository

## What This Template Runs

- `app`: Python HTTP verifier service. It downloads and installs the pinned upstream Trivy release archive at startup, exposes health and demo endpoints on the internal `8000` port, and runs local Trivy CLI checks.
- `proxy`: Caddy reverse proxy. It listens on public port `8080` and forwards traffic to `app:8000`.

The upstream Trivy docs also describe `trivy server`, which exposes `/healthz` and `/version` for client/server scanning. This template does not use server mode by default because real vulnerability, container image, Kubernetes, repository, and cloud scans usually need external targets, update databases, credentials, or larger production configuration. The verifier shape is the closest CPU-safe default for a prebuilt Phala Cloud template.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `TRIVY_VERSION` | No | `0.71.0` | Pinned Trivy release version downloaded from the upstream GitHub release archive at startup. |

The compose file also sets `TRIVY_CACHE_DIR=/tmp/trivy-cache`, `TRIVY_NO_PROGRESS=true`, `PYTHONUNBUFFERED=1`, and the internal `APP_PORT=8000`.

## Endpoints

- `GET /healthz`: Returns `200` when the Trivy binary is installed and `trivy --version` succeeds.
- `GET /demo`: Generates a temporary local sample project, runs a deterministic Trivy filesystem secret scan, and returns a redacted JSON summary.
- `GET /v1/models`: Returns an OpenAI-compatible metadata-only model list for smoke checks. This template does not host or call an LLM model.
- `GET /upstream`: Returns upstream repository, docs, release, and icon-source metadata.
- `GET /`: Returns service metadata and endpoint links.

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
    "scanner": {
      "target": "filesystem",
      "scanners": ["secret"],
      "skip_db_update": true,
      "offline_scan": true
    },
    "results": {
      "secret_findings_count": 2
    },
    "safety": {
      "credentials_required": false,
      "credentials_used": false,
      "cpu_only": true,
      "real_secrets_returned": false
    }
  }
}
```

## Smoke Verification

Use these commands from the parent monorepo worktree to verify the template:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/trivy/docker-compose.yml config >/dev/null
```

Optional local smoke run from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/trivy/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/trivy/docker-compose.yml down
```

## Production Notes

- This is a local verifier template, not a production vulnerability management service.
- Real vulnerability scans download and refresh the Trivy vulnerability database. Size the CVM and cache storage for your selected targets.
- Container image scans usually need network access to registries and may need registry credentials for private images.
- Kubernetes and cloud scans require carefully scoped credentials. Add required tokens or cloud credentials only through Phala Cloud deployment secrets or environment variables in your own derived template.
- Misconfiguration and policy workflows can require Trivy's checks bundle. Pin Trivy versions, review policy sources, and test update behavior before production use.
- SBOM workflows should write artifacts to durable storage if you need to keep reports. This verifier does not persist scan output.
- The demo endpoints are unauthenticated. Add authentication before exposing private scan targets, scan results, or internal metadata.
- The compose file intentionally avoids host bind mounts, `env_file`, privileged mode, host networking, host IPC, Docker socket access, GPU devices, real secrets, browser authentication, hosted model calls, and model-weight downloads.

## Cleanup

For a local test run from the parent monorepo worktree, stop and remove the containers with:

```bash
docker compose -f templates/prebuilt/trivy/docker-compose.yml down
```
