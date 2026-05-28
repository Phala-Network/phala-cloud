# Helicone on Phala Cloud

This template runs a CPU-safe Helicone source verifier and metadata demo. It starts one small Python HTTP service, fetches selected public files from the pinned upstream `Helicone/helicone` Git commit, verifies hashes and source markers, then exposes JSON endpoints for smoke testing.

It does not run the full Helicone Cloud dashboard, Jawn proxy, Cloudflare workers, Supabase/Postgres, ClickHouse, MinIO, Redis, Kafka, or any LLM provider traffic. No Helicone Cloud key, provider API key, database password, object-storage key, email setup, model download, GPU, or external credential is required.

## Metadata

- Template id: `helicone`
- Display name: `Helicone/helicone`
- Category: LLM Gateways, Proxies & API Management
- Upstream repository: https://github.com/Helicone/helicone
- Upstream self-hosting docs: https://docs.helicone.ai/getting-started/self-host/docker
- Default source ref: `094b210b405a3dcc4887d55bfe2d4b4c37af2f20`
- Inspected upstream commit date: `2026-05-18T23:17:54Z`
- Upstream license: Apache-2.0
- Icon source: upstream `docs/favicon.svg` from `Helicone/helicone` at commit `094b210b405a3dcc4887d55bfe2d4b4c37af2f20`, saved as `templates/icons/helicone.svg`
- Phala prebuilt source: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/helicone

## What This Template Runs

The compose file starts one public HTTP service:

- `app`: A `python:3.12-slim-bookworm` container running an inline Python HTTP server on port `8080`.

On startup, the verifier downloads these selected public upstream files from `Helicone/helicone` at `HELICONE_SOURCE_REF`:

- `README.md`
- `package.json`
- `docker/docker-compose.yml`
- `docker/helicone-compose.sh`

For the default pinned commit, the verifier checks each file's SHA-256 digest and expected markers. For a non-default public ref, it still checks markers but does not enforce the pinned default hashes.

## Difference From Full Helicone

Helicone upstream provides a full self-host path and an official `helicone/helicone-all-in-one:latest` image. The upstream docs expose the dashboard on port `3000`, Jawn API and proxy on `8585`, and MinIO S3 on `9080`. The full stack also needs public URL configuration for remote deployments, production auth secrets, account verification, organization setup, persistent storage, and careful network controls.

This Phala prebuilt template intentionally does not claim to be that full stack. The official all-in-one image inspected for this template was about 3.5 GB and bundles multiple data services. Running it honestly on a small confidential VM also requires extra setup and security review, especially because the upstream docs warn that the Jawn proxy port can proxy requests without authentication if exposed.

Use this template when you want a lightweight, deterministic Helicone verifier/demo on `tdx.small`. Use Helicone's upstream Docker or Helm guidance when you need the real dashboard, proxy, storage, analytics database, auth, and production LLM logging path.

## Deploy On Phala Cloud

1. Deploy the `helicone` prebuilt template.
2. Keep the default resource profile for the verifier: 1 vCPU, 1 GiB memory, 10 GiB disk.
3. Leave the environment variables at their defaults unless you are intentionally testing another public upstream ref.
4. Open the generated public endpoint for port `8080`.
5. Visit `https://<your-app-domain>/healthz`.

The first startup fetches a small set of public source files from GitHub. No private repositories, model registries, paid provider APIs, host bind mounts, Docker socket access, host networking, external build contexts, `env_file`, privileged mode, or secrets are required.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `HELICONE_SOURCE_REF` | No | `094b210b405a3dcc4887d55bfe2d4b4c37af2f20` | Public Helicone Git commit, branch, or tag used for source checks. The default pinned commit enforces SHA-256 hashes; other refs use marker checks only. |
| `VERIFY_TIMEOUT_SECONDS` | No | `15` | Timeout, in seconds, for each public upstream source fetch. |

If you replace this verifier with a real Helicone deployment, add only the deployment-time variables your selected mode requires, such as public URLs, auth secrets, database credentials, object-storage credentials, SMTP settings, Helicone keys, or provider API keys. Store those as Phala Cloud secrets or required environment variables with placeholders; never commit real values.

## Endpoints

The public endpoint serves JSON on port `8080`:

- `GET /healthz`: Readiness and verifier status. Check the `"ok"` field to confirm source verification passed.
- `GET /demo`: Helicone-specific metadata demo showing the upstream gateway request shape, observability fields, and confirmation that no LLM call is performed.
- `GET /v1/models`: OpenAI-compatible model-list shape containing a metadata-only `helicone/verifier-demo` placeholder. This is not a hosted model and not proof of LLM routing.
- `GET /upstream`: Full upstream facts and source-check details, including file hashes, marker checks, and caveat flags.
- `GET /`: Same basic status payload as `/healthz`.

## Smoke Test

From the monorepo worktree:

```bash
docker compose -f templates/prebuilt/helicone/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/helicone/docker-compose.yml up -d

curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/upstream
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models

docker compose -f templates/prebuilt/helicone/docker-compose.yml down
```

With `jq` available, the important checks are:

```bash
curl -fsS http://localhost:8080/healthz | jq '.ok, .status, .full_helicone_stack_running'
curl -fsS http://localhost:8080/upstream | jq '.source_check.ok, .source_check.pinned_sha256_enforced'
curl -fsS http://localhost:8080/demo | jq '.llm_provider_calls, .demo_request.performed'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
```

Expected results:

- `/healthz` returns HTTP `200`; after the source check completes, `"ok"` is `true` and `"status"` is `"ready"`.
- `/upstream` reports `"pinned_sha256_enforced": true` with the default ref.
- `/demo` reports `"llm_provider_calls": false` and `"performed": false`.
- `/v1/models` includes `helicone/verifier-demo`.

## Validation

Expected template-factory validation from the monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/helicone/docker-compose.yml config >/dev/null
```

## Resource Notes

The default resource profile is intentionally small:

- 1 vCPU
- 1 GiB memory
- 10 GiB disk

The verifier downloads only selected source files into container memory and does not create named volumes. A full Helicone deployment can require substantially more disk, memory, startup time, storage persistence, database tuning, public URL configuration, and network policy.

## Security Notes

- The default HTTP verifier is unauthenticated and returns public source metadata only.
- The compose file uses one public base image and inline Compose configs only.
- The compose file does not use host bind mounts, named volumes, `env_file`, real secrets, privileged mode, host networking, external build contexts, Docker socket access, or GPU device requests.
- The `/v1/models` endpoint is a compatibility stub. It does not indicate that a model server, Helicone AI Gateway, or provider proxy is running.
- Do not expose a real Helicone proxy without an access-control plan. Upstream self-hosting docs note that the Jawn proxy port must be restricted in production.

## Production Caveats

To run production Helicone instead of this verifier:

- Follow Helicone's upstream Docker or Helm deployment guidance.
- Pin image tags, source refs, database versions, and migration versions.
- Generate real auth secrets and database/object-storage credentials at deployment time.
- Configure public `SITE_URL`, `BETTER_AUTH_URL`, dashboard URL, Jawn URL, and S3 URL consistently for your Phala endpoint or custom domain.
- Add persistent volumes or managed data services for Postgres, ClickHouse, and object storage.
- Configure email/account verification and organization setup.
- Put Caddy, nginx, Traefik, or another reviewed TLS/auth layer in front of public services.
- Avoid exposing proxying endpoints that can spend provider credits unless they are authenticated and rate-limited.

## Upstream Attribution

Helicone is developed in the `Helicone/helicone` repository: https://github.com/Helicone/helicone.

This Phala Cloud prebuilt template preserves upstream attribution in the template metadata and README while routing deployable assets through the Phala prebuilt template path: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/helicone.
