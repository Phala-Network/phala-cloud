# microsoft/agent-governance-toolkit

Deploy a CPU-safe Agent Governance Toolkit package verifier on Phala Cloud.

## Metadata

- Template id: `agent-governance-toolkit`
- Display name: `microsoft/agent-governance-toolkit`
- Category: AI Agents & Developer Tools
- Upstream repository: https://github.com/microsoft/agent-governance-toolkit
- Upstream documentation: https://microsoft.github.io/agent-governance-toolkit/
- Python package: `agent-governance-toolkit[full]`
- Default package version: `3.7.0`
- Icon source: upstream project icon, `docs/assets/agent-governance-toolkit.svg`
- Upstream author: Microsoft, via the `microsoft/agent-governance-toolkit` GitHub repository

## Overview

Agent Governance Toolkit is Microsoft's public-preview toolkit for policy enforcement, zero-trust identity, execution sandboxing, auditability, compliance verification, and reliability controls for autonomous AI agents. The upstream README describes a Python-first quickstart with `pip install agent-governance-toolkit[full]`, `govern(...)` wrappers around tools, and CLI checks such as `agt verify` for OWASP Agentic Security Initiative coverage.

This Phala Cloud template is a no-credential verifier, not a production agent service. It installs the real published Python package, imports `agentmesh.governance`, `agent_os.policies`, and `agent_compliance.cli.agt`, then exposes a deterministic HTTP smoke API.

The `/demo` endpoint uses the real AGT `govern()` wrapper around a local Python tool, evaluates a YAML policy, allows a safe `read_file` action, blocks a destructive `delete_file` action, and returns compact audit hash-chain metadata. It does not call an LLM provider, download model weights, open browser authentication flows, require GPU access, or use external credentials.

The upstream repository also includes a `docker-compose.yml`, but it is a development/test compose file with a local build context and bind-mounted workspace. This template avoids that shape so it is deployable on Phala Cloud.

## Services

- `app`: Internal Python HTTP server on port `8000`. At startup it installs `agent-governance-toolkit[full]` with `uv pip` and runs the deterministic verifier.
- `proxy`: Caddy reverse proxy listening on public port `8080` and forwarding to `app:8000`.

## Environment Variables

No credentials are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `AGT_PACKAGE_VERSION` | No | `3.7.0` | Published `agent-governance-toolkit` version installed by the verifier at container startup. |

## Deploy On Phala Cloud

1. Deploy the `agent-governance-toolkit` template.
2. Keep the default CPU-only resources for this verifier.
3. Leave `AGT_PACKAGE_VERSION` at `3.7.0` unless you intentionally want to test another published package version.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads Python wheels from PyPI. The verifier path is local and deterministic after dependencies are installed.

## Endpoints

- `GET /healthz`: Reports package version, import checks, expected symbols, Python/runtime metadata, and no-LLM flags.
- `GET /demo`: Runs the deterministic AGT `govern()` policy enforcement demo and returns allow, deny, and audit integrity results.
- `GET /v1/models`: Returns an OpenAI-style metadata list for the local policy verifier. It is not a hosted model endpoint.
- `GET /upstream`: Returns upstream repository, documentation, package, icon attribution, runtime shape, and endpoint metadata.
- `GET /`: Returns a compact service index.

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
  "llm_provider_calls": false,
  "model_downloaded": false,
  "model_loaded": false,
  "demo": {
    "denied_call": {
      "blocked": true,
      "matched_rule": "block-destructive-actions"
    },
    "audit": {
      "entry_count": 2,
      "integrity_ok": true
    }
  }
}
```

## Local Smoke Verification

Run from the parent worktree:

```bash
docker compose -f templates/prebuilt/agent-governance-toolkit/docker-compose.yml config >/tmp/agt-compose.out
docker compose -f templates/prebuilt/agent-governance-toolkit/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/upstream
docker compose -f templates/prebuilt/agent-governance-toolkit/docker-compose.yml down
```

If local port `8080` is already in use, temporarily change only the host side of the proxy mapping, for example `18080:80`, then use `http://localhost:18080/healthz`.

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/agent-governance-toolkit/docker-compose.yml config >/dev/null
```

## Production Notes

- This template verifies package installation and core governance primitives. It does not run a full production agent, sidecar fleet, dashboard, or managed policy service.
- Add authentication, authorization, rate limiting, request logging, and network restrictions before exposing governance results for private workloads.
- Real deployments should wrap actual framework tools or agent actions with AGT policy checks, configure identity/trust material, and store audit logs in durable infrastructure.
- Do not put provider API keys, bearer tokens, private keys, OTPs, or passwords in the compose file. Use Phala Cloud secret handling for production credentials.
- The default verifier is unauthenticated and should remain a smoke endpoint unless adapted behind an authenticated gateway.
- The demo does not invoke model providers, download model weights, request GPU access, use privileged mode, mount host paths, use `env_file`, access the Docker socket, or use host networking.
- The upstream project is public preview. Pin `AGT_PACKAGE_VERSION` for reproducible deployments and test policy behavior before changing versions.

## Upstream Attribution

This template installs and imports the real Agent Governance Toolkit Python package from Microsoft:

- Repository: https://github.com/microsoft/agent-governance-toolkit
- Documentation: https://microsoft.github.io/agent-governance-toolkit/
- Package index: https://pypi.org/project/agent-governance-toolkit/
- Icon: https://github.com/microsoft/agent-governance-toolkit/blob/main/docs/assets/agent-governance-toolkit.svg
