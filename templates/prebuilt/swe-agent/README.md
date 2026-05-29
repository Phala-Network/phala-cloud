# SWE-agent/SWE-agent

Deploy a CPU-safe local verifier for the real SWE-agent source install and CLI on Phala Cloud.

## Metadata

- Template id: `swe-agent`
- Display name: `SWE-agent/SWE-agent`
- Category: AI Coding Agents & Developer Tools
- Deployable template repository: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/swe-agent
- Upstream repository: https://github.com/SWE-agent/SWE-agent
- Upstream documentation: https://swe-agent.com/latest/
- Installed upstream tag by default: `v1.1.0`
- Icon source: `docs/assets/swe-agent.svg` from the upstream `SWE-agent/SWE-agent` repository at tag `v1.1.0`
- Upstream author attribution: SWE-agent

## Overview

SWE-agent is an open source software engineering agent framework that lets a language model use an agent-computer interface to work on coding tasks, GitHub issues, SWE-bench style problems, and related workflows.

This Phala Cloud template is intentionally a verifier, not a hosted coding-agent service. It clones the real upstream SWE-agent repository, installs it with `pip install -e` from the source checkout, imports the real `sweagent` Python package, and runs the real CLI help path with `python -m sweagent --help`.

The default endpoints do not run a SWE-agent task, do not call hosted LLM providers, do not require OpenAI or Anthropic credentials, do not download model weights, do not run Docker-in-Docker, and do not mount the host Docker socket. The verifier exists to prove that the queued `SWE-agent/SWE-agent` project can be installed, imported, and invoked safely in a CPU-only confidential VM.

Upstream maintainers recommend `mini-swe-agent` for many new users. This template still targets the requested `SWE-agent/SWE-agent` repository because that is the prebuilt template queued here.

## What This Template Runs

- `app`: a `python:3.11-slim-bookworm` container with a Python HTTP server on port `8080`.
- At startup, the container installs `git` and CA certificates, clones `https://github.com/SWE-agent/SWE-agent.git` at `SWE_AGENT_VERSION`, and caches the checkout in a named volume at `/opt/swe-agent-source`.
- The startup command runs `python -m pip install -e /opt/swe-agent-source`, then starts `/server.py` from the source checkout root.
- `/healthz` imports `sweagent` from the source checkout and executes `python -m sweagent --help` in a sanitized subprocess environment with no provider API keys passed.

This source-checkout flow is deliberate. The upstream package imports assert repository-level directories such as `config/`, `tools/`, and `trajectories/`; an editable source install run from the repository root preserves those paths.

## Environment Variables

No credentials are required for `/healthz`, `/demo`, or `/v1/models`.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SWE_AGENT_VERSION` | No | `v1.1.0` | Git tag or ref cloned from `SWE-agent/SWE-agent` at startup. |
| `SWE_AGENT_MODEL` | No | Empty | Optional model name for later manual SWE-agent runs. The verifier endpoints do not use it. |
| `SWE_AGENT_COST_LIMIT` | No | Empty | Optional cost limit value for later manual SWE-agent runs. The verifier endpoints do not use it. |
| `OPENAI_API_KEY` | No | Empty | Optional OpenAI provider key for later manual SWE-agent use. Use a neutral placeholder such as `<provider credential placeholder>` in documentation and configure real secrets only in Phala Cloud environment settings. |
| `ANTHROPIC_API_KEY` | No | Empty | Optional Anthropic provider key for later manual SWE-agent use. Use a neutral placeholder such as `<provider credential placeholder>` in documentation and configure real secrets only in Phala Cloud environment settings. |

The compose file also sets container-local paths such as `HOME` and `XDG_CACHE_HOME`. The source checkout and home directory are named Docker volumes, not host bind mounts.

## Deploy

1. Deploy the `swe-agent` prebuilt template on Phala Cloud.
2. Keep the default CPU-only resource profile for the verifier path.
3. Leave all provider credentials empty for the default smoke demo.
4. Optionally set `SWE_AGENT_VERSION` to another SWE-agent Git tag or ref.
5. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the SWE-agent source from GitHub and Python dependencies from package indexes. It does not download model weights. Changing `SWE_AGENT_VERSION` causes the startup command to fetch and check out the requested tag or ref before reinstalling the editable package.

## Usage Endpoints

- `GET /healthz`: Returns `200` when `sweagent` imports from the source checkout and `python -m sweagent --help` exits successfully.
- `GET /demo`: Runs the same local verifier checks and returns a detailed JSON payload describing what was verified.
- `GET /v1/models`: Returns an OpenAI-style metadata-only model list for compatibility with developer-agent template probes. It does not host or proxy a model.
- `GET /`: Same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/healthz` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "credentials_required_for_health": false,
  "remote_model_calls": false,
  "model_downloaded": false,
  "model_loaded": false,
  "docker_required_for_health": false
}
```

## Local Smoke Verification

Run locally from the `sdks/` directory:

```bash
docker compose -f templates/prebuilt/swe-agent/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/swe-agent/docker-compose.yml down
```

Template validation commands from the `sdks/` directory:

```bash
python3 templates/validate.py
docker compose -f templates/prebuilt/swe-agent/docker-compose.yml config >/tmp/swe-agent-compose.out
git diff --check
```

## Limitations

- This template verifies installation, import, and CLI availability only. It does not run `sweagent run`, `sweagent run-batch`, the SWE-agent GUI backend, or an autonomous coding task.
- The default verifier does not configure SWE-agent's model provider settings. Real agent usage requires an explicit model/provider setup outside the smoke endpoints.
- The template does not provide a Docker execution backend. Upstream SWE-agent workflows that rely on Docker-backed task execution need a separate, reviewed deployment design; this template intentionally avoids Docker-in-Docker and Docker socket access.
- The template does not mount host repositories or local machine paths. Use a named volume or clone code into the container if you adapt it for manual experiments.
- `/v1/models` is metadata-only. No model is loaded, hosted, downloaded, or proxied.

## Security And Credential Notes

- The default HTTP endpoints are unauthenticated. Put an authenticated proxy in front of the service before exposing private workflows or operational controls.
- Do not put real API keys in the compose file or README. Configure optional provider credentials only through Phala Cloud environment settings.
- Provider credentials are optional and are not required for `/healthz`, `/demo`, or `/v1/models`.
- The health subprocess uses a sanitized environment and does not pass `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SWE_AGENT_MODEL`, or `SWE_AGENT_COST_LIMIT`.
- The compose file does not use host bind mounts, `env_file`, privileged mode, host networking, Docker socket mounts, external build contexts, GPU devices, or local machine paths.
- SWE-agent is a developer agent capable of acting on code and external services when fully configured. Before adapting this verifier into a production agent endpoint, restrict filesystem, network, repository, tool, and credential access according to your threat model.

## Upstream Attribution

This template packages a verifier for the upstream `SWE-agent/SWE-agent` project. The icon is copied from `docs/assets/swe-agent.svg` in the upstream repository at tag `v1.1.0`.

## Cleanup

For a local test run from `sdks/`, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/swe-agent/docker-compose.yml down
```
