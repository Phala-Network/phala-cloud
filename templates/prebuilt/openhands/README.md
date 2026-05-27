# OpenHands/OpenHands on Phala Cloud

Deploy a CPU-safe OpenHands source verifier on Phala Cloud.

## Metadata

- Template id: `openhands`
- Display name: `OpenHands/OpenHands`
- Category: Agent Frameworks & Orchestration
- Upstream repository: https://github.com/OpenHands/OpenHands
- Upstream documentation: https://docs.openhands.dev/
- Pinned upstream release: `1.7.0`
- Pinned upstream commit: `43bd8d12e59d2e9254fa8b490ad3e1234902e33b`
- Icon source: OpenHands logo referenced by the upstream README, `https://raw.githubusercontent.com/OpenHands/docs/main/openhands/static/img/logo.png`
- Upstream author: OpenHands, via the `OpenHands/OpenHands` GitHub repository

## What This Template Runs

OpenHands is an AI-driven software engineering agent platform. The upstream README describes several surfaces:

- OpenHands Software Agent SDK
- OpenHands CLI
- OpenHands Local GUI
- OpenHands Cloud
- OpenHands Enterprise

The full local GUI path is not a safe default Phala smoke deployment. The upstream setup documentation recommends Docker, shows the direct Docker command mounting `/var/run/docker.sock`, and requires users to select an LLM provider, model, and API key after launch. The upstream package metadata also includes heavyweight runtime dependencies such as Docker, LiteLLM, Playwright, and the OpenHands agent server packages.

This template therefore runs a small Python HTTP service instead of the full OpenHands app. During the image build it downloads three public files from the pinned upstream `OpenHands/OpenHands` `1.7.0` release and verifies their byte size and SHA-256 digest:

| File | SHA-256 |
| --- | --- |
| `README.md` | `520aa2b10c568f2bf3ea95438d7039f993efe89f2aca1a8d9a0e598153885b8f` |
| `pyproject.toml` | `32235e4fe98f9409ba8c2affb0cd9e009be1af16e2b3c43b16dc4bfe933823c7` |
| `openhands/__init__.py` | `092fa9e3a2ab52d819ec39bf271f72cfae5d03cb4e655350ba49dfd627f25e04` |

At runtime the service re-verifies the local pinned files and exposes JSON endpoints for Phala smoke testing. It does not run agents, create sandboxes, mount the Docker socket, mount host repositories, call hosted LLM providers, download models, request a GPU, use privileged mode, use `env_file`, or require real secrets.

## Services

- `app`: Python 3.12 HTTP verifier built from an inline Dockerfile.

## Ports

- `8080`: Public HTTP endpoint for health, demo, and model-list checks.

## Environment Variables

No credentials are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `OPENHANDS_DEMO_TOPIC` | No | `Phala Cloud` | Short label echoed by `/demo`. It does not affect upstream verification and is not a credential. |

The compose file also sets internal runtime value `APP_PORT=8080`; it is fixed by the template.

## Deploy on Phala Cloud

1. Create a new Phala Cloud deployment from the `openhands` prebuilt template.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `OPENHANDS_DEMO_TOPIC` to a short non-secret label.
4. Deploy the CVM and wait for the image build and service startup to finish.
5. Open `https://<your-app-domain>/healthz`.

The first build downloads the three pinned public files from GitHub. After the image is built, the runtime verification uses the files already copied into the container image.

## Usage Endpoints

- `GET /healthz`: Returns `200` when all pinned upstream files exist locally and match the expected SHA-256 and byte size.
- `GET /demo`: Returns the verification report, README/package metadata summary, and an explicit runtime contract describing what is and is not running.
- `GET /v1/models`: Returns a small OpenAI-style model list for smoke-test compatibility. It is metadata only and does not expose an inference model.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "runtime_contract": {
    "cpu_only": true,
    "credentials_required": false,
    "docker_socket_mounted": false,
    "llm_provider_calls": false,
    "model_downloaded": false,
    "privileged_mode": false
  },
  "upstream": {
    "release": "1.7.0",
    "commit": "43bd8d12e59d2e9254fa8b490ad3e1234902e33b"
  }
}
```

## Production Notes

This is a verifier/demo, not the production OpenHands platform.

To adapt this into a real OpenHands deployment, production users need to make deliberate choices about:

- Docker or another sandbox provider, including whether the deployment may safely access a Docker daemon.
- Repository/workspace mounting and write permissions.
- LLM provider, model, API key, base URL, retry policy, and spend limits.
- Optional search-provider credentials such as Tavily.
- Browser/Playwright behavior and any required browser dependencies.
- Authentication in front of the OpenHands UI and API.
- Resource sizing above the default verifier profile. Upstream docs recommend at least 4 GB RAM for local OpenHands, and serious local/self-hosted LLM use needs substantially more capable hardware.

Do not add real API keys, OAuth tokens, private keys, one-time passwords, or repository credentials to this compose file or README. Keep production secrets in Phala Cloud environment handling.

## Verification

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/openhands/docker-compose.yml config >/dev/null
```

Local smoke test from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/openhands/docker-compose.yml up -d --build
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/openhands/docker-compose.yml down
```

Static self-audit items:

- Config id is unique: `openhands`.
- Icon exists: `templates/icons/openhands.png`.
- No literal secrets, `env_file`, host bind mounts, host Docker socket mount, GPU request, privileged mode, or external build context.
- Runtime exposes a clear HTTP port and health endpoint: `8080` and `/healthz`.

## Upstream Attribution

- Upstream repository: https://github.com/OpenHands/OpenHands
- Upstream docs: https://docs.openhands.dev/
- Local GUI setup docs: https://docs.openhands.dev/openhands/usage/run-openhands/local-setup
- Docker sandbox docs: https://docs.openhands.dev/openhands/usage/sandboxes/docker
- LLM configuration docs: https://docs.openhands.dev/openhands/usage/llms/llms
- License: MIT for the core `openhands` and `agent-server` Docker images per the upstream README; the `enterprise/` directory has its own enterprise license.
- Icon source: `openhands/static/img/logo.png` from the OpenHands docs repository, referenced by the upstream OpenHands README.
