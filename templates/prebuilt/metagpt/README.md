# MetaGPT on Phala Cloud

This template runs a CPU-safe MetaGPT package and source verifier behind a public Caddy proxy. The app installs the real `metagpt` wheel, imports the top-level `metagpt` package, checks package metadata, and verifies installed source files that define MetaGPT's software-company agent workflow.

The default demo does not execute MetaGPT agents, initialize provider configuration, download models, run browser automation, use a GPU, or call hosted LLM APIs. It intentionally installs the wheel with `--no-deps` so the smoke test stays small enough for a `tdx.small` deployment while still proving that the published MetaGPT package and source are present.

## Metadata

- Template id: `metagpt`
- Category: Agent Frameworks & Orchestration
- Upstream repo: `https://github.com/FoundationAgents/MetaGPT`
- Upstream author: `FoundationAgents`
- Package: `metagpt==0.8.1`
- Python runtime: `python:3.11-slim-bookworm`
- Icon source: upstream `docs/resources/MetaGPT-new-log-v2.png` from `FoundationAgents/MetaGPT`, inspected at commit `11cdf466d042aece04fc6cfd13b28e1a70341b1f`

## Services

- `app`: internal Python HTTP service on port `8000`. At startup it installs `metagpt` with `--no-deps`, imports the package, reads package metadata, and verifies known source markers in installed files such as `software_company.py`, `team.py`, role modules, and action modules.
- `proxy`: public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

## Deploy

From this template directory:

```bash
docker compose config
docker compose up -d
```

On Phala Cloud, deploy the prebuilt template and open the public endpoint on port `8080`.

The first start downloads the pinned MetaGPT wheel from PyPI inside the container. The template does not require a persistent volume.

## Usage

The public HTTP API is available through Caddy on port `8080`.

```bash
curl -fsS http://localhost:8080/healthz | jq
curl -fsS http://localhost:8080/demo | jq
curl -fsS http://localhost:8080/v1/models | jq
```

Endpoints:

- `/healthz`: returns HTTP 200 only when package metadata, top-level import, and source-marker checks pass. Returns HTTP 503 with error fields if verification fails.
- `/demo`: returns deterministic local facts about the installed MetaGPT package and source files. It reports the install mode, package metadata, checked files, marker results, and a local description of the software-company pipeline. It does not call LLM APIs.
- `/v1/models`: returns an OpenAI-shaped model list containing `metagpt/no-llm-demo`. It is metadata only; the default template does not host or call a model.

## Verification

Run these smoke checks after deployment:

```bash
docker compose ps
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo | jq '.framework_facts.package.metadata_ok, .framework_facts.source.import_ok, .llm_provider_calls'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `.framework_facts.package.metadata_ok` is `true`.
- `.framework_facts.source.import_ok` is `true`.
- `.llm_provider_calls` is `false`.
- `/v1/models` includes `metagpt/no-llm-demo`.

## Environment Variables

The default template requires no credentials.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `METAGPT_VERSION` | `0.8.1` | No | Pinned MetaGPT Python package version installed at container startup. Override only when testing another compatible release. |

MetaGPT `0.8.1` declares `Requires-Python: >=3.9`, so this template uses Python 3.11. If you override `METAGPT_VERSION`, keep the Python runtime compatible with that release.

## Limitations And Caveats

- The default app installs `metagpt` with `--no-deps`. This is deliberate: the full MetaGPT dependency graph includes provider SDKs, browser tooling, vector/search clients, notebook packages, and other runtime pieces that are not needed for a small package/source smoke test.
- Because transitive dependencies are not installed, this template is not a complete MetaGPT agent runtime. Replace the demo service or remove `--no-deps` only when you are ready to run real MetaGPT workflows and size the CVM for the full dependency set.
- Real MetaGPT workflows normally need provider configuration and model access. This template does not define, require, or consume provider credential variables.
- The `/v1/models` endpoint is compatibility-shaped metadata. It does not indicate that a model server is running.
- The app does not use external databases, host bind mounts, browser automation, GPU access, or model downloads.

## Security Notes

- Only Caddy publishes a host port: `8080:80`.
- The app service is internal and uses `expose`, not `ports`.
- The template does not use privileged mode, host networking, host IPC, Docker socket mounts, host bind mounts, `env_file`, or external build context.
- No API keys or secrets are baked into the compose file.

## Cleanup

```bash
docker compose down
```

No named volumes are created by this template.
