# Biohub/esm

Deploy a CPU-safe Biohub ESM source verifier on Phala Cloud.

## Metadata

- Template id: `esm`
- Display name: `Biohub/esm`
- Category: AI Apps & Workflows
- Upstream repository: https://github.com/Biohub/esm
- Upstream documentation: https://github.com/Biohub/esm#readme
- Python package: `esm`, installed from the upstream GitHub source archive
- Icon source: `esm.png` is copied from the upstream repository asset `_assets/logo.png`, which is included in the upstream README asset tree
- Upstream author: Biohub, via the `Biohub/esm` GitHub repository. The package metadata credits the EvolutionaryScale Team.

## Overview

Biohub ESM provides code and SDK primitives for ESMC, ESMFold2, ESM Atlas, ESM3, Biohub Platform clients, and local Hugging Face model workflows for protein biology research.

The upstream README documents two real runtime paths:

- Biohub Platform inference, which requires an API token from the Biohub developer console.
- Local Hugging Face inference, which requires model downloads and may require Hugging Face login, large CPU/GPU memory, and CUDA for practical ESMC, ESMFold2, or ESM3 model runs.

This Phala Cloud template intentionally does not start model inference. Instead, it runs a small HTTP verifier on `python:3.12-slim-bookworm`. At startup it installs the real upstream `esm` package from the inspected source commit with `--no-deps`, imports lightweight package symbols, reads the installed `esm.sdk.api` source through `importlib.resources`, and exercises deterministic local SDK data primitives without Biohub credentials, Hugging Face authentication, model weights, GPU access, browser auth, or external databases.

The default demo is suitable for `tdx.small` because it avoids Torch imports and scientific model dependencies. It is an honest verifier for the upstream source/package shape, not a protein inference server.

## Service

- `app`: Python HTTP verifier service exposed on container port `8080`.

## Port

- `8080`: Public HTTP endpoint for health, deterministic package/source demo output, and an OpenAI-compatible model-list shape.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `ESM_SOURCE_REF` | No | `975722d72d20104261b33e2e9cce98f30c031037` | Upstream Biohub/esm commit, tag, or simple branch name installed from the GitHub source archive at container startup. The default is the `main` commit inspected for this template. |
| `ESM_DEMO_SEQUENCE` | No | `MSKGEELFTGVVPILVELDGDVNGHK` | Short amino-acid sequence used by `/demo` when the request does not pass a `sequence` query parameter. |

## Deploy

1. Deploy the `esm` template on Phala Cloud.
2. Keep the default CPU-only resources for the verifier.
3. Optionally set `ESM_SOURCE_REF` to another compatible upstream commit or tag.
4. Open `https://<your-app-domain>/healthz` after startup completes.

The first startup downloads the upstream source archive from GitHub and installs a no-dependency wheel. The runtime verifier path is local and deterministic after that install step completes.

## Endpoints

- `GET /healthz`: Returns `200` when the upstream package import and source checks are ready.
- `GET /`: Same readiness payload as `/healthz`.
- `GET /demo`: Runs the deterministic local verifier using the default demo sequence.
- `GET /demo?sequence=<amino-acid-sequence>`: Runs the same verifier with a custom sequence summary. Non-standard characters are ignored for the deterministic sequence statistics.
- `GET /v1/models`: Returns an OpenAI-compatible model-list response describing the local verifier and upstream model metadata discovered from package constants.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS "https://<your-app-domain>/demo?sequence=MSKGEELFTGVV"
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "ok": true,
  "cpu_only": true,
  "remote_model_calls": false,
  "model_downloaded": false,
  "demo": {
    "sequence_report": {
      "normalized_sequence": "MSKGEELFTGVVPILVELDGDVNGHK",
      "function_annotation_tuple": [
        "template:deterministic-sequence-check",
        1,
        10
      ]
    },
    "verifier": {
      "imports": [
        "esm",
        "esm.utils.types.FunctionAnnotation",
        "esm.utils.constants.models"
      ]
    }
  }
}
```

## Smoke Verification

Use these commands to verify the template locally without provider credentials:

Run locally from the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/esm/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/esm/docker-compose.yml up -d
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
docker compose -f templates/prebuilt/esm/docker-compose.yml down
```

Template validation commands from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/esm/docker-compose.yml config >/dev/null
```

## Production Notes

- The default service is a verifier for the upstream source/package and selected lightweight SDK primitives. It does not perform ESMC, ESMFold2, ESM3, or ESM Atlas inference.
- Biohub Platform inference requires a Biohub API token. Add that token as a Phala Cloud secret or environment variable in your own application layer; do not hardcode API keys, tokens, private keys, OTPs, or passwords in Compose files or READMEs.
- Local Hugging Face inference requires the appropriate model repository access, optional Hugging Face login, and large model-weight downloads. ESMFold2 and larger ESMC/ESM3 models are not appropriate for the default `tdx.small` verifier profile.
- The upstream package declares heavy scientific dependencies, including Torch and a Biohub Transformers fork. This template installs the source package with `--no-deps` and imports only lightweight modules so startup remains CPU-safe and does not pull model stacks by default.
- If you convert this verifier into a real inference API, pin model versions and source commits, add authentication, size the CVM for the selected model, review Biohub's acceptable-use policy, and keep provider credentials in Phala Cloud secrets.
- The demo endpoints are unauthenticated. Add an authenticated reverse proxy or application-layer auth before exposing private research workflows.
- The compose file intentionally avoids host bind mounts, `env_file`, privileged mode, host networking, host IPC, Docker socket access, GPU devices, real secrets, browser authentication, hosted model calls, and model-weight downloads.

## Cleanup

For a local test run from the parent monorepo worktree, stop and remove the container with:

```bash
docker compose -f templates/prebuilt/esm/docker-compose.yml down
```
