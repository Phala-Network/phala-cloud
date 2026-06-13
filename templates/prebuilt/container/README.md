# apple/container

Deploy a CPU-safe source and release verifier for `apple/container` on Phala Cloud.

## Overview

`apple/container` is a tool for creating and running Linux containers using lightweight virtual machines on a Mac. It is written in Swift and optimized for Apple silicon.

The upstream project is not a Linux server and is not usable as a container runtime inside a Phala Linux CVM. Its own docs require Apple silicon, macOS virtualization and networking frameworks, XPC helpers, launchd services, and a signed macOS installer package. This template therefore runs the closest honest no-credential verifier: it clones the real upstream source at a pinned release tag, verifies the expected commit and Swift package/runtime markers, and exposes deterministic HTTP endpoints for deployment smoke checks.

The default path does not run the `container` CLI, start `container-apiserver`, launch virtual machines, mount the Docker socket, use registry credentials, call model providers, or download model weights.

## Metadata

- Template id: `container`
- Display name: `apple/container`
- Category: AI Apps & Workflows
- Upstream repository: https://github.com/apple/container
- Upstream release used by default: https://github.com/apple/container/releases/tag/1.0.0
- Default source ref: `1.0.0`
- Default expected commit: `ee848e3ebfd7c73b04dd419683be54fb450b8779`
- Upstream author: `apple`
- Icon source: upstream `assets/Containerization-Logo.png` from https://github.com/apple/container/tree/1.0.0, blob SHA `ff5ff26c61c7c7a127624ce2d5a0588d0b691c61`
- Runtime docs inspected: upstream `README.md`, `BUILDING.md`, `docs/technical-overview.md`, `docs/tutorials/start-here.md`, and `docs/command-reference.md`

## What This Template Runs

- `app`: Python HTTP verifier service on internal port `8000`. At startup it uses the image-provided `git`, clones `https://github.com/apple/container.git` into a named volume, checks the pinned source ref and expected commit, then validates source markers such as `Package.swift`, Swift tools version, macOS platform declaration, Containerization dependency, executable targets, and runtime documentation.
- `proxy`: Caddy reverse proxy. It listens on public port `8080` and forwards traffic to `app:8000`.
- `container_source`: named volume used only to cache the upstream source checkout across restarts.

The Compose file does not use a build context, host bind mounts, `env_file`, privileged mode, host networking, host IPC, Docker socket access, GPU devices, browser auth, real secrets, or credential-bearing defaults.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `CONTAINER_SOURCE_REF` | No | `1.0.0` | Upstream `apple/container` git branch, tag, or 40-character commit cloned into the verifier volume. |
| `CONTAINER_EXPECTED_COMMIT` | No | `ee848e3ebfd7c73b04dd419683be54fb450b8779` | Expected commit for the cloned source checkout. Set to an empty string only when intentionally testing another ref without commit pinning. |

The compose file also sets `CONTAINER_SOURCE_DIR=/var/lib/container-source/repo`, `APP_PORT=8000`, and `PYTHONUNBUFFERED=1`.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `container` template.
2. Keep the default CPU resources for the verifier.
3. Leave all environment variables at their defaults for the pinned upstream release smoke test.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first start clones the pinned upstream source with the image-provided `git`. The named volume lets restarts reuse the checkout unless `CONTAINER_SOURCE_REF` changes.

## Exposed Endpoints

- `GET /healthz`: Returns HTTP 200 when the upstream source checkout, expected commit, and package/runtime marker checks pass.
- `GET /demo`: Returns the same verifier status plus a deterministic explanation of the upstream macOS commands and the checks performed by this Linux service.
- `GET /v1/models`: Returns an OpenAI-compatible metadata-only model list for smoke checks. This template does not host or call an LLM model.
- `GET /upstream`: Returns upstream repository, release, docs, installer, and icon-source metadata.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
curl -fsS https://<your-app-domain>/upstream
```

Expected `/healthz` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "credentials_required": false,
  "provider_calls": false,
  "model_downloads": false,
  "macos_container_runtime_started": false
}
```

## Smoke Verification

Use these commands from the parent monorepo worktree to verify the template:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/container/docker-compose.yml config >/dev/null
```

Optional local smoke run:

```bash
docker compose -f templates/prebuilt/container/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/upstream
docker compose -f templates/prebuilt/container/docker-compose.yml down
```

To remove the cached upstream source volume after a local test:

```bash
docker compose -f templates/prebuilt/container/docker-compose.yml down -v
```

## Production Notes

- This template is a verifier, not a hosted `apple/container` runtime. `apple/container` itself must run on Apple silicon macOS with the required virtualization, vmnet, XPC, launchd, and Keychain integrations.
- The upstream signed installer is a macOS `.pkg`. This template records its release URL and SHA-256 metadata but does not download or install it inside Linux.
- Real `container` usage can pull images from registries and may need registry credentials through the upstream macOS Keychain-backed workflow. Do not put registry credentials in this template.
- The upstream runtime starts a system service with `container system start` and then creates lightweight VMs per container. Those operations are intentionally not attempted in Phala Cloud because the CVM is already a Linux container environment.
- If you change `CONTAINER_SOURCE_REF`, also set `CONTAINER_EXPECTED_COMMIT` to the expected commit for that ref, or set it to an empty string only for exploratory tests.
- The demo endpoints are unauthenticated metadata endpoints. Add authentication before exposing private source metadata or derived internal checks in a production derivative.
- Pin refs and expected commits for reproducible deployments.

## Upstream Attribution

- Upstream project: https://github.com/apple/container
- Author: `apple`
- Source artifact used by the verifier: upstream git checkout from `https://github.com/apple/container.git`
- Icon: copied from upstream `assets/Containerization-Logo.png` and saved as `templates/icons/container.png`
