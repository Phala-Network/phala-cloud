# comet-ml/opik

Deploy a CPU-safe Opik package and local evaluation verifier on Phala Cloud.

## Overview

Opik is Comet's open-source platform for LLM observability, evaluation, testing, and optimization. The upstream project can run a full self-hosted application with tracing storage, dashboards, evaluation services, and integrations, but that production stack is larger than a default `tdx.small` smoke deployment.

This Phala Cloud prebuilt template intentionally runs a small HTTP verifier instead of the full Opik platform. It installs the real `opik` Python package from PyPI, imports Opik evaluation modules, runs deterministic local heuristic metrics, and exposes JSON endpoints that can be checked without provider calls, hosted credentials, model downloads, GPU access, or external databases.

## What Runs

- `app`: A Python HTTP service on port `8080` using `ghcr.io/astral-sh/uv:python3.11-bookworm-slim`.
- Startup install: `opik==2.0.49` by default, configurable through `OPIK_PACKAGE_VERSION`.
- Runtime checks: imports `opik`, verifies expected exports such as `track`, `evaluate`, `Opik`, and `configure`, imports heuristic metrics from `opik.evaluation.metrics`, and runs a deterministic local answer-evaluation sample.

The `/demo` endpoint constructs a local observability-style trace with retrieval, generation, and scoring spans. It evaluates a fixed answer with Opik heuristic metrics including `Contains`, `Equals`, `LevenshteinRatio`, and `RegexMatch` using `track=False`, so no Opik server or hosted Comet workspace is contacted.

This template does not use host bind mounts, `env_file`, privileged mode, host networking, Docker socket access, GPU devices, model-provider credentials, external databases, or model downloads.

## Resources

The default config entry uses:

- vCPU: `1`
- Memory: `2048` MB
- Disk: `10` GB

The first startup downloads the pinned Python package and dependencies from PyPI. Keep the default resources for a `tdx.small`-style verifier. The full upstream platform needs substantially more services and operational planning.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `opik` prebuilt template.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `OPIK_PACKAGE_VERSION` to another published `opik` PyPI version.
4. Optionally set `OPIK_DEMO_TITLE` to a neutral display label for `/healthz` and `/demo`.
5. Deploy the CVM and wait for the first package install to complete.
6. Open `https://<your-app-domain>/healthz`.

A healthy deployment returns HTTP `200` from `/healthz` and reports package import, metric import, and local demo readiness signals.

## Configuration

No credentials are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `OPIK_PACKAGE_VERSION` | No | `2.0.49` | Pinned Opik Python package version installed at container startup. |
| `OPIK_DEMO_TITLE` | No | `Opik CPU local evaluation demo` | Optional label returned by `/healthz` and `/demo`. |

Do not put real API keys, Comet workspace tokens, database passwords, object-storage credentials, or private keys in the compose file or README. If you adapt this into a production Opik deployment, provide secrets through Phala Cloud environment variables or a secret manager.

## HTTP Endpoint Usage

- `GET /healthz`: Returns readiness JSON. It is healthy only when package metadata, Opik imports, metric imports, and the deterministic local demo all pass.
- `GET /demo`: Runs the local Opik evaluation-style sample and returns synthetic trace spans plus metric scores.
- `GET /v1/models`: Returns an OpenAI-compatible model-list shape for compatibility probes. It is metadata only and does not serve an inference model.
- `GET /upstream`: Returns upstream repository, documentation, package, icon, and production-stack caveat metadata.
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
  "demo": {
    "aggregate_score": 1.0,
    "checks": {
      "opik_package_imported": true,
      "opik_heuristic_metrics_used": true,
      "provider_calls": false,
      "model_downloaded": false,
      "external_database": false,
      "hosted_credentials_required": false
    }
  }
}
```

## Local Validation Commands

Run from the Phala Cloud parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/opik/docker-compose.yml config >/dev/null
```

Optional local smoke test:

```bash
docker compose -f templates/prebuilt/opik/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/upstream
docker compose -f templates/prebuilt/opik/docker-compose.yml down
```

## Icon Source

The template icon is `templates/icons/opik.svg`, copied from the upstream Opik repository file:

https://github.com/comet-ml/opik/blob/main/apps/opik-frontend/src/icons/opik.svg

The upstream README also references the Opik wordmark at:

https://github.com/comet-ml/opik/blob/main/apps/opik-documentation/documentation/static/img/opik-logo.svg

## Production Caveats

This is not the full production Opik platform.

The upstream local Docker Compose deployment includes MySQL, Redis, ClickHouse, ZooKeeper, MinIO, backend, frontend, Python backend, optional guardrails services, profiles, build contexts, local config mounts, and production credentials. The upstream Python backend can also run code-executor workloads. Those pieces are intentionally not included here because the default Phala template must be small, deterministic, and safe for a CPU-only smoke deployment.

For a production Opik deployment:

- Follow the upstream self-hosting documentation for Docker Compose or Kubernetes/Helm.
- Size persistent databases, ClickHouse, Redis, object storage, and backend workers for your trace volume.
- Generate strong secrets outside git and inject them through a secure environment or secret manager.
- Add authentication and network controls before exposing tracing or evaluation APIs publicly.
- Review upstream telemetry, code execution, guardrails, and LLM-provider settings before enabling them.

## Upstream Attribution

- Upstream repository: https://github.com/comet-ml/opik
- Upstream documentation: https://www.comet.com/docs/opik/
- Python package: https://pypi.org/project/opik/
- Author: Comet, via the `comet-ml/opik` GitHub repository
- Template repo path: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/opik

## Cleanup

For a local test run from the parent worktree, stop and remove the verifier with:

```bash
docker compose -f templates/prebuilt/opik/docker-compose.yml down
```
