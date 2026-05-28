# ray-project/ray

Deploy a CPU-safe Ray Core smoke API on Phala Cloud.

## Metadata

- Template id: `ray`
- Category: LLM Fine-Tuning & Training
- Upstream repository: https://github.com/ray-project/ray
- Upstream documentation: https://docs.ray.io/
- Public image: `rayproject/ray:2.55.1-py311-cpu`
- Icon source: `doc/source/_static/img/ray_logo.svg` from the upstream `ray-project/ray` documentation tree

## What This Template Runs

Ray is a distributed compute framework for scaling Python and AI workloads. Anyscale provides managed Ray services, but this template does not require Anyscale, Kubernetes, cloud credentials, GPUs, model downloads, or external services.

The deployment runs a single HTTP service on the official CPU Ray image. The service imports the real `ray` package, starts a local single-node Ray runtime with `include_dashboard=False`, and exposes deterministic smoke endpoints:

- `/healthz`: verifies Ray is initialized and a tiny `ray.remote` task returns `42`.
- `/demo`: runs local Ray tasks and a Ray actor over deterministic integer inputs.
- `/v1/models`: returns an OpenAI-compatible list-style metadata response for the local Ray runtime demo.

This is not an LLM model server. It is a minimal CPU-safe Ray runtime proof suitable for Phala Cloud `tdx.small`.

## Services

- `app`: Ray CPU image running a Python standard-library HTTP server on container port `8000`.

The compose file publishes host port `18080` for local validation. Phala Cloud routes the deployed HTTP endpoint through the platform domain.

## Environment Variables

No credentials are required for the default smoke demo.

- `RAY_DEMO_NUM_CPUS`: Optional logical CPU count passed to local `ray.init`. Default: `1`. Values are clamped between `1` and `4` by the demo server.
- `RAY_OBJECT_STORE_MEMORY_BYTES`: Optional Ray object store memory for the local runtime. Default: `83886080` bytes. Values are clamped between `78643200` and `268435456`.

The template also sets `RAY_USAGE_STATS_ENABLED=0` so the smoke demo does not send Ray usage telemetry.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `ray` prebuilt template.
2. Keep the default CPU-only resources for the smoke demo.
3. Leave the optional environment variables unchanged unless you are testing a larger local Ray task.
4. Deploy the CVM and wait for the service health check to pass.
5. Open `https://<your-app-domain>/healthz`.

The first run pulls the public Ray CPU image. No private images, hosted model credentials, host bind mounts, Docker socket access, privileged mode, host networking, Kubernetes configuration, Anyscale credentials, or GPU devices are required.

## Usage

Health check:

```bash
curl -fsS https://<your-app-domain>/healthz
```

Run the deterministic Ray computation:

```bash
curl -fsS "https://<your-app-domain>/demo?n=6"
```

List the local demo runtime metadata:

```bash
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/healthz` fields include:

```json
{
  "ok": true,
  "status": "ready",
  "check": {
    "pass": true,
    "task": {
      "executed_by": "ray.remote",
      "input": 41,
      "output": 42
    }
  }
}
```

Expected `/demo?n=6` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "credentials_required": false,
  "external_services_required": false,
  "model_downloaded": false,
  "demo": {
    "summary": {
      "count": 6,
      "sum_squares": 91,
      "even_values": [2, 4, 6],
      "max_cube": 216
    }
  }
}
```

The `/v1/models` endpoint is compatibility-style metadata for smoke tests. It describes the local Ray CPU runtime demo and does not expose an LLM inference model.

## Local Smoke Verification

From the `sdks` repository root:

```bash
docker compose -f templates/prebuilt/ray/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/ray/docker-compose.yml up -d
curl -fsS http://localhost:18080/healthz
curl -fsS "http://localhost:18080/demo?n=6"
curl -fsS http://localhost:18080/v1/models
docker compose -f templates/prebuilt/ray/docker-compose.yml down
```

From the parent monorepo worktree, prefix the compose path with `sdks/`.

Template validation commands:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/ray/docker-compose.yml config >/dev/null
```

## Production Caveats

- This template starts one local Ray runtime inside one container. Full Ray clusters, KubeRay, Ray Jobs, Ray Serve deployments, dashboards, and Anyscale integrations are production extensions.
- The HTTP demo endpoints are unauthenticated because the default service has no private data path. Add authentication before exposing real workloads or sensitive outputs.
- The Ray dashboard is disabled to keep the template small and CPU-safe.
- Keep secrets out of the compose file. If you adapt the template for cloud storage, model providers, or private package indexes, pass credentials through Phala Cloud environment variables and document them as placeholders only.
- The compose file does not use host bind mounts, `env_file`, Docker secrets, privileged mode, host networking, host IPC, GPU devices, or external build contexts.
