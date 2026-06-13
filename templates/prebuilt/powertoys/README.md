# microsoft/PowerToys

Deploy a CPU-safe PowerToys source verifier on Phala Cloud.

## Metadata

- Template id: `powertoys`
- Display name: `microsoft/PowerToys`
- Category: AI Apps & Workflows
- Upstream repository: https://github.com/microsoft/PowerToys
- Upstream installation docs: https://learn.microsoft.com/windows/powertoys/install
- Upstream developer docs: https://github.com/microsoft/PowerToys/blob/main/doc/devdocs/readme.md
- Icon source: `doc/images/icons/PowerToys icon/PNG/PowerToysAppList.targetsize-256.png` from the upstream repository, downloaded from `https://raw.githubusercontent.com/microsoft/PowerToys/main/doc/images/icons/PowerToys%20icon/PNG/PowerToysAppList.targetsize-256.png`
- Upstream author: Microsoft, via the `microsoft/PowerToys` GitHub repository

## Overview

Microsoft PowerToys is a collection of utilities that supercharge productivity and customization on Windows.

PowerToys is primarily a Windows desktop application. The upstream install docs require Windows 11 or Windows 10 version 2004 or newer, and the developer docs describe a Windows build setup with Visual Studio workloads, Windows SDKs, .NET 8, long paths, and submodules. There is no official no-secret Linux server image for running the PowerToys desktop app on a small CPU-only Phala deployment.

This template therefore runs an honest Linux HTTP verifier instead of pretending to host the Windows desktop application. At startup it fetches selected real upstream source files from `microsoft/PowerToys`, caches them in a named Docker volume, and exposes deterministic JSON endpoints that parse and verify:

- the README utility catalog
- `PowerToys.slnx` project and platform metadata
- `.vsconfig` Visual Studio component requirements
- upstream developer prerequisites
- PowerToys module contract source
- installer and DSC example metadata

The verifier does not run the PowerToys desktop UI, build Windows binaries, download model weights, call model providers, use browser authentication, or require credentials.

## Services

- `app`: Python HTTP verifier exposed on port `8080`.

## Ports

- `8080`: Public HTTP endpoint for readiness, source demo, and compatibility checks.

## Environment Variables

No credentials are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `POWERTOYS_REF` | No | `v0.100.0` | Upstream PowerToys branch, tag, or commit used when fetching source files. The default is the latest stable GitHub release inspected for this template. |
| `POWERTOYS_FETCH_TIMEOUT_SECONDS` | No | `30` | Timeout in seconds for each public GitHub raw source file download. |
| `PORT` | No | `8080` | HTTP port listened on inside the verifier container and published by the Compose file. |

## Deploy

1. Deploy the `powertoys` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `POWERTOYS_REF` to another upstream tag, branch, or commit.
4. Open `https://<your-app-domain>/healthz` after the first startup completes.

The first startup downloads small source files from public GitHub URLs. It does not fetch the full repository tarball, installers, symbol archives, Visual Studio workloads, Windows SDKs, or any model files.

## Exposed Endpoints

- `GET /healthz`: Returns `200` when all required upstream source files were fetched and parsed successfully.
- `GET /demo`: Returns parsed PowerToys utility, solution, Visual Studio configuration, developer prerequisite, module contract, installer, and DSC metadata.
- `GET /v1/models`: Returns an OpenAI-shaped metadata list containing `microsoft-powertoys/source-verifier`. This is a compatibility endpoint only; it does not host or call a model.
- `GET /upstream`: Returns the same source-verifier summary with upstream metadata.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

## Smoke Verification

Run locally from the parent worktree:

```bash
docker compose -f templates/prebuilt/powertoys/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/powertoys/docker-compose.yml down
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "demo": {
    "check": "PowerToys upstream source metadata verifier",
    "cpu_only": true,
    "credentials_required": false,
    "model_downloaded": false,
    "remote_model_calls": false,
    "production_caveats": {
      "runs_powertoys_desktop_app": false,
      "container_runtime": "Linux HTTP source verifier"
    }
  }
}
```

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/powertoys/docker-compose.yml config >/dev/null
```

## Production Notes

- Use the official Windows installation paths for real PowerToys deployments: GitHub release installers, Microsoft Store, WinGet, Chocolatey, or Scoop.
- Build and debug PowerToys on Windows with the upstream Visual Studio, Windows SDK, .NET, long-path, and submodule requirements. A Linux container is not a supported PowerToys desktop runtime.
- Some PowerToys utilities interact with the Windows shell, Explorer, window manager, registry, and elevated desktop sessions. Those behaviors cannot be validated by this Phala source verifier.
- The verifier endpoints are unauthenticated. Add an authenticated reverse proxy before adapting this pattern for private source or operational metadata.
- Do not put secrets in the Compose file. This template has no required credentials and does not read provider keys.
- The container does not request GPU access, privileged mode, host networking, host IPC, host bind mounts, Docker socket access, or an `env_file`.

## Cleanup

For a local test run from the parent worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/powertoys/docker-compose.yml down
```
