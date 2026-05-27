# browser-use/browser-use

Deploy a CPU-safe Browser Use package verifier on Phala Cloud.

## Metadata

- Template id: `browser-use`
- Display name: `browser-use/browser-use`
- Category: Web Agents & Browser Automation
- Upstream repository: https://github.com/browser-use/browser-use
- Upstream documentation: https://docs.browser-use.com
- Python package: https://pypi.org/project/browser-use/
- Icon source: `static/browser-use.png` from the upstream `browser-use/browser-use` repository
- Upstream author: browser-use

## What This Template Runs

Browser Use is an open-source framework for browser automation agents. Full Browser Use agent runs normally need an LLM provider and a browser runtime, and some production setups also use cloud browser infrastructure, authenticated browser profiles, proxy settings, or site credentials.

This Phala Cloud template is intentionally smaller: it runs a minimal HTTP verifier that installs the real `browser-use` Python package, imports Browser Use modules, checks package metadata, and serves deterministic JSON endpoints. It does not instantiate an `Agent`, call an LLM provider, launch Chromium, download model weights, require GPU access, or use API keys.

The default deployment is sized for `tdx.small` and is meant to verify that the upstream framework package can install and import inside a confidential VM. It is not a production credentialed browser agent.

## Services

- `app`: Python HTTP verifier on public port `8080`. It installs `browser-use` at startup and serves `/healthz`, `/demo`, and `/v1/models`.

No host bind mounts, `env_file`, privileged mode, host networking, host IPC, GPU devices, browser credentials, or model-provider credentials are used.

## Environment Variables

No credentials are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `BROWSER_USE_VERSION` | No | `0.12.9` | Browser Use Python package version installed by the verifier service. |

The compose file disables Browser Use telemetry/cloud-sync/version-check flags for the verifier path. If you adapt this into a real agent, review upstream telemetry and cloud settings before changing those defaults.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `browser-use` prebuilt template.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `BROWSER_USE_VERSION` to another published PyPI version.
4. Deploy the CVM and wait for the first startup to complete.
5. Open `https://<your-app-domain>/healthz`.

The first startup downloads the pinned Python package from PyPI. The verifier does not download browsers or model weights.

## Exposed Endpoints

- `GET /healthz`: Returns HTTP 200 only when the real `browser-use` package import and package metadata checks succeeded.
- `GET /demo`: Returns a deterministic local JSON task-plan example that describes Browser Use capabilities without contacting an LLM or launching a browser.
- `GET /v1/models`: Returns an OpenAI-style model list with the local verifier id `browser-use-local-verifier`.
- `GET /`: Returns service metadata and endpoint names.

Example checks:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "credentials_required": false,
  "llm_provider_calls": false,
  "browser_launched": false,
  "model_downloaded": false,
  "demo_model": "browser-use-local-verifier"
}
```

## Local Smoke Verification

Run locally from the `sdks/` directory:

```bash
docker compose -f templates/prebuilt/browser-use/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/browser-use/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/browser-use/docker-compose.yml down
```

Template validation commands from the `sdks/` directory:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/browser-use/docker-compose.yml config >/dev/null
```

## Production Extension Notes

- Add LLM provider credentials only through Phala Cloud environment variables or a secret manager. Do not bake keys into the compose file, README, image, or git history.
- Install a browser runtime explicitly if you want to run real agents. For example, extend the image with Chromium or Playwright dependencies, or configure Browser Use Cloud or another remote browser endpoint.
- Avoid host bind mounts for browser profiles or credentials. Use a named volume or an external secret/profile sync flow that matches your security model.
- Put authenticated browser-agent APIs behind an auth proxy or application-level authentication before exposing them publicly.
- Pin `BROWSER_USE_VERSION` and any browser runtime version for reproducible deployments.
- Review upstream Browser Use docs for provider-specific variables such as `BROWSER_USE_API_KEY`, `GOOGLE_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`; this verifier template intentionally leaves them unset.

## Cleanup

For a local test run from `sdks/`, stop and remove the verifier with:

```bash
docker compose -f templates/prebuilt/browser-use/docker-compose.yml down
```
