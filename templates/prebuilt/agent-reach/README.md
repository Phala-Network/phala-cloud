# Panniantong/Agent-Reach on Phala Cloud

This template runs a CPU-safe Agent Reach verifier behind a public Caddy proxy. The app installs Agent Reach's declared runtime dependencies, loads the real upstream GitHub source archive on `PYTHONPATH`, imports the package and channel registry, exercises deterministic local channel-matching primitives, and exposes JSON endpoints for smoke testing.

The default deployment does not run `agent-reach install`, does not install optional platform CLIs, does not read browser cookies, does not configure proxies, does not call model providers, does not launch browsers, and does not download model weights. It is a verifier for the upstream package and its local scaffolding primitives, not a production internet-scraping agent.

## Metadata

- Template id: `agent-reach`
- Display name: `Panniantong/Agent-Reach`
- Category: LLM Gateway & API Proxy
- Upstream repository: `https://github.com/Panniantong/Agent-Reach`
- Upstream install guide: `https://github.com/Panniantong/Agent-Reach/blob/main/docs/install.md`
- Upstream author: `Panniantong`
- Source archive: `https://github.com/Panniantong/Agent-Reach/archive/17624268a059ccfb23eba8a2ba50f9f92c8dc0ca.zip`
- Icon source: upstream `docs/assets/logo-1.svg` from `Panniantong/Agent-Reach`, inspected at commit `17624268a059ccfb23eba8a2ba50f9f92c8dc0ca`

## What This Template Runs

Agent Reach is a Python CLI and scaffolding tool that helps an AI agent install and configure upstream internet-access tools such as `twitter-cli`, `rdt-cli`, `yt-dlp`, `gh`, `mcporter`, and platform-specific MCP services. Its upstream documentation is oriented around installing tools on a user-controlled machine, then asking the agent to call those tools directly.

This Phala Cloud template intentionally avoids that full installer path by default. Instead, the verifier:

- installs the runtime dependencies listed in Agent Reach's `pyproject.toml`;
- downloads and imports Agent Reach from the upstream GitHub archive;
- imports `agent_reach`, `AgentReach`, the channel registry, and channel base classes;
- classifies sample URLs through local `can_handle()` channel methods;
- checks only local Web and RSS channel availability methods;
- exposes `/healthz`, `/demo`, and `/v1/models` over HTTP.

This keeps startup deterministic on a small CPU-only Phala CVM and avoids credentialed platform access.

## Services

- `app`: internal Python HTTP verifier. It installs runtime dependencies, loads the upstream source archive at startup, and serves JSON on port `8000`.
- `proxy`: public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

## Environment Variables

No credentials are required.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `AGENT_REACH_REF` | `17624268a059ccfb23eba8a2ba50f9f92c8dc0ca` | No | Upstream Agent Reach branch, tag, or commit archive ref loaded by the verifier at container startup. The default is the commit inspected for this template. |
| `APP_PORT` | `8000` | No | Internal app port. Caddy proxies to this port; the host only exposes `8080:80`. |

Do not add cookies, browser sessions, proxy credentials, GitHub tokens, Groq keys, model-provider keys, or platform account credentials to this default verifier. Add secrets only if you replace the verifier with a real Agent Reach workflow that needs them.

## Exposed Endpoints

The public HTTP API is available through Caddy on port `8080`.

- `GET /healthz`: returns HTTP 200 only when the package import checks and deterministic local demo pass.
- `GET /demo`: exercises local Agent Reach channel primitives without calling Twitter, Reddit, YouTube, GitHub, Bilibili, XiaoHongShu, Exa, Jina, or other external platform APIs.
- `GET /v1/models`: returns an OpenAI-shaped model list containing `agent-reach-local-verifier`. It is metadata only; the template does not host or call an LLM.
- `GET /`: returns service metadata and endpoint names.

Example:

```bash
curl -fsS http://localhost:8080/healthz | jq
curl -fsS 'http://localhost:8080/demo?url=https://github.com/Panniantong/Agent-Reach&url=https://example.com/feed.xml' | jq
curl -fsS http://localhost:8080/v1/models | jq
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "credential_free": true,
  "remote_platform_calls": false,
  "demo": {
    "llm_provider_calls": false,
    "credentials_required": false,
    "browser_automation": false,
    "installer_ran": false
  }
}
```

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `agent-reach` prebuilt template.
2. Keep the default CPU-only resources for the verifier: 1 vCPU, 1 GB memory, and 10 GB disk.
3. Optionally set `AGENT_REACH_REF` to another trusted upstream commit or tag.
4. Deploy the CVM and wait for the first startup to complete.
5. Open `https://<your-app-domain>/healthz`.

The first startup downloads Python wheels and the upstream Agent Reach source archive. The runtime smoke path itself is local and deterministic.

## Local Verification

Run locally from the `sdks/` directory:

These commands verify the Compose syntax, service health, deterministic demo endpoint, and metadata endpoint.

```bash
docker compose -f templates/prebuilt/agent-reach/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/agent-reach/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz | jq
curl -fsS http://localhost:8080/demo | jq
curl -fsS http://localhost:8080/v1/models | jq
docker compose -f templates/prebuilt/agent-reach/docker-compose.yml down
```

Template validation commands from the parent worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/agent-reach/docker-compose.yml config >/dev/null
```

## Production Notes

- The upstream Agent Reach installer is designed for a user-controlled agent environment. Running `agent-reach install --env=auto` may install tools, create files under `~/.agent-reach/`, configure `mcporter`, guide users through cookies, or require additional platform-specific setup.
- Twitter/X, Reddit, XiaoHongShu, Xueqiu, LinkedIn, and similar channels can require cookies, browser login, proxy configuration, account-specific rate limits, or a dedicated secondary account. Do not bake those credentials into Compose or git.
- Some platforms can block server or datacenter IPs. Use production proxy settings only through deployment-time secret management.
- If you adapt this template into a real gateway, add authentication before exposing agent or scraping actions publicly.
- Pin `AGENT_REACH_REF` to a reviewed commit for reproducible deployments.
- The default template does not use privileged mode, host networking, host IPC, host PID, Docker socket mounts, host bind mounts, named volumes, `env_file`, GPU devices, browser automation services, external databases, or provider credentials.

## Cleanup

For a local test run from `sdks/`, stop and remove the verifier with:

```bash
docker compose -f templates/prebuilt/agent-reach/docker-compose.yml down
```

No named volumes are created by this template.
