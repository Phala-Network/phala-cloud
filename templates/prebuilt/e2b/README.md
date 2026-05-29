# e2b-dev/E2B

Deploy a CPU-safe E2B Python SDK verifier on Phala Cloud.

## Metadata

- Template id: `e2b`
- Display name: `e2b-dev/E2B`
- Category: AI Agents & Developer Tools
- Deployable template repository: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/e2b
- Upstream repository: https://github.com/e2b-dev/E2B
- Upstream documentation: https://e2b.dev/docs
- Python packages:
  - `e2b==2.25.0`
  - `e2b-code-interpreter==2.7.0`
- Icon source: `readme-assets/logo-circle.png` from the upstream `e2b-dev/E2B` repository
- Upstream author: e2b-dev

## What This Template Runs

E2B provides secure sandboxes for AI agents and code execution. A real E2B self-hosted deployment is not a single-container local worker: upstream full-infrastructure self-hosting uses cloud infrastructure and Terraform, and real sandbox use requires E2B service connectivity plus credentials such as `E2B_API_KEY`.

This Phala Cloud template intentionally does not run or emulate a real E2B sandbox, cloud worker, Firecracker stack, Docker-based worker, hosted model provider, or code-execution backend. Instead, it runs a minimal HTTP verifier that installs the real Python packages `e2b==2.25.0` and `e2b-code-interpreter==2.7.0`, imports their public SDK modules, checks package metadata and expected symbols, and exercises only local code-interpreter data classes.

The default deployment is CPU-only and safe for `tdx.small`. It does not call `Sandbox.create`, `run_code`, networked E2B APIs, hosted LLMs, provider APIs, model downloads, GPU devices, Docker socket mounts, host bind mounts, privileged mode, external build contexts, `env_file`, or credentials.

## Services

- `app`: Python HTTP verifier on public port `8080`. At startup it installs the pinned E2B Python packages from PyPI and serves deterministic local JSON endpoints.

No host bind mounts, named volumes, `env_file`, privileged mode, host networking, host IPC, GPU devices, Docker socket mounts, provider credentials, E2B credentials, or model artifacts are used.

## Environment Variables

No credentials are required. The compose file intentionally does not define `E2B_API_KEY` or any provider API key.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `E2B_VERSION` | No | `2.25.0` | `e2b` Python package version installed by the verifier service. |
| `E2B_CODE_INTERPRETER_VERSION` | No | `2.7.0` | `e2b-code-interpreter` Python package version installed by the verifier service. |

Leave credential variables unset for the default verifier. Add credentials only when building a separate production integration that intentionally calls E2B services.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `e2b` prebuilt template.
2. Keep the default CPU-only resources for the verifier.
3. Leave all credentials unset.
4. Optionally set `E2B_VERSION` or `E2B_CODE_INTERPRETER_VERSION` to another published PyPI version.
5. Deploy the CVM and wait for first startup to finish installing the packages.
6. Open `https://<your-app-domain>/healthz`.

The first startup downloads the pinned Python packages from PyPI. It does not download models, worker images, browsers, sandbox kernels, or E2B infrastructure components.

## Exposed Endpoints

- `GET /healthz`: Returns HTTP 200 only when the real `e2b` and `e2b-code-interpreter` package imports and symbol checks succeed.
- `GET /demo`: Returns deterministic local JSON proving package imports and local SDK primitives. It instantiates `e2b_code_interpreter.Result` and `e2b_code_interpreter.Execution` only.
- `GET /v1/models`: Returns an OpenAI-style metadata-only model list with the local verifier id `e2b-local-sdk-verifier`.
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
  "e2b_api_key_required": false,
  "provider_calls": false,
  "hosted_llm_calls": false,
  "model_downloaded": false,
  "gpu_required": false,
  "docker_socket_used": false,
  "sandbox_created": false,
  "run_code_called": false,
  "demo_model": "e2b-local-sdk-verifier",
  "what_ran": [
    "import e2b",
    "import e2b_code_interpreter",
    "instantiate e2b_code_interpreter.Result",
    "instantiate e2b_code_interpreter.Execution"
  ]
}
```

## What Is Verified

- The published `e2b` package can be installed and imported.
- The published `e2b-code-interpreter` package can be installed and imported.
- Package metadata resolves to the requested pinned versions.
- Expected SDK symbols such as `Sandbox`, `AsyncSandbox`, `SandboxInfo`, `CommandHandle`, `ConnectionConfig`, `Result`, `Execution`, and `ExecutionError` are present.
- Local `Result` and `Execution` objects can be created without credentials or remote service calls.

## What Is Not Run

- No `Sandbox.create` call.
- No `run_code` call.
- No networked E2B API request.
- No self-hosted E2B cloud worker, sandbox runtime, Firecracker VM, or Docker sandbox.
- No Terraform or cloud infrastructure provisioning.
- No hosted LLM provider request.
- No model download, model loading, browser launch, GPU access, Docker socket access, host mount, or privileged container mode.

## Local Smoke Verification

Run locally from the `sdks/` directory:

```bash
docker compose -f templates/prebuilt/e2b/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/e2b/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/e2b/docker-compose.yml down
```

Template validation commands from the `sdks/` directory:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/e2b/docker-compose.yml config >/dev/null
```

## Production Extension Notes

- Treat this template as a package verifier, not a production E2B deployment.
- For real E2B SaaS usage, configure credentials such as `E2B_API_KEY` only through Phala Cloud environment variables or a secret manager. Do not put keys in the compose file, README, image, or git history.
- For real self-hosted E2B infrastructure, follow upstream E2B self-hosting documentation and review Terraform, cloud networking, sandbox isolation, worker sizing, image lifecycle, and operational security. Do not layer that infrastructure into this single-compose verifier.
- Keep public HTTP endpoints behind authentication before exposing any production workflow that can execute code or reach private data.
- Avoid Docker socket mounts, broad host bind mounts, privileged containers, host networking, and embedded credentials unless you have a specific audited deployment design.
- Pin Python package versions for reproducible verifier behavior and update the README when changing the default pins.

## Cleanup

For a local test run from `sdks/`, stop and remove the verifier with:

```bash
docker compose -f templates/prebuilt/e2b/docker-compose.yml down
```
