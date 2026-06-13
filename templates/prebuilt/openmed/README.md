# OpenMed on Phala Cloud

This template runs a CPU-safe OpenMed verifier behind a public Caddy proxy. The app installs the real `openmed` Python package, imports it, reads the bundled model registry, and runs deterministic local PII pattern checks without external credentials, provider calls, browser auth, or model weight downloads.

OpenMed is local-first healthcare AI for clinical text extraction, PII de-identification, and biomedical model workflows. The upstream project also ships a FastAPI REST service for model-backed inference, but that service normally installs Hugging Face/Torch dependencies and loads model artifacts. This Phala template intentionally defaults to a lightweight verifier so it can start on small CPU-only CVMs.

## Metadata

- Template id: `openmed`
- Category: AI Apps & Workflows
- Upstream repo: `https://github.com/maziyarpanahi/openmed`
- Upstream author: `maziyarpanahi`
- Package: `openmed==1.5.5`
- Python runtime: `python:3.12` from the `ghcr.io/astral-sh/uv:python3.12-bookworm-slim` image
- Icon source: upstream `docs/brand/openmed-mascot-icon.png` from `maziyarpanahi/openmed`, inspected at commit `b0c1c84ed4da360ad192da0bcedc9bfa86d28a96`

## Services

- `app`: internal Python HTTP service. At startup it installs `openmed`, imports the package, checks the model registry, and serves JSON on port `8000`.
- `proxy`: public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

## Deploy

From this template directory:

```bash
docker compose config
docker compose up -d
```

On Phala Cloud, deploy the prebuilt template and open the public endpoint on port `8080`.

The first start can take a few minutes because the app installs the pinned OpenMed wheel and dependencies inside the container. The template does not require a persistent volume.

## Usage

The public HTTP API is available through Caddy on port `8080`.

```bash
curl -fsS http://localhost:8080/healthz | jq
curl -fsS http://localhost:8080/demo | jq
curl -fsS http://localhost:8080/v1/models | jq
```

Endpoints:

- `/healthz`: returns HTTP 200 only when the real `openmed` package imports and its bundled registry loads.
- `/health`: same health payload as `/healthz`.
- `/demo`: returns a deterministic verifier response. It normalizes synthetic clinical text with OpenMed text-processing utilities, scans it with OpenMed's bundled PII regex patterns and validators, and reports registry metadata.
- `/v1/models`: returns an OpenAI-shaped model-list response with metadata-only OpenMed registry entries. The default verifier does not host a model.

You can pass a short synthetic sample to `/demo`:

```bash
curl -G http://localhost:8080/demo \
  --data-urlencode 'text=Patient email jane.doe@example.com, DOB 1970-01-15, phone (415) 555-2671.' \
  --data-urlencode 'lang=en' | jq
```

## Verification

Use these commands to verify the template after deployment:

```bash
docker compose ps
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo | jq '.openmed.import_ok, .demo.pii_pattern_demo.entity_count'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `.openmed.import_ok` is `true`.
- `.demo.pii_pattern_demo.entity_count` is greater than `0`.
- `/v1/models` includes `openmed/no-model-verifier`.

## Environment Variables

The default template requires no credentials.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `OPENMED_VERSION` | `1.5.5` | No | Pinned OpenMed Python package version installed at container startup. Override only when testing another compatible release. |

Provider keys and Hugging Face tokens are intentionally not required and are not consumed by the default verifier. Add credentials only if you replace this verifier with a production OpenMed service that needs private model access or external integrations.

## Production Notes

- The default verifier does not call `openmed.analyze_text`, `openmed.extract_pii`, `openmed.deidentify`, or the upstream `openmed.service.app` inference routes. Those paths are model-backed and can download or load model artifacts.
- For production model inference, follow the upstream REST service pattern: install `openmed[hf,service]`, run `uvicorn openmed.service.app:app --host 0.0.0.0 --port 8080`, and size the CVM for the selected models.
- OpenMed registry aliases such as `disease_detection_superclinical`, `pharma_detection_superclinical`, and `pii_detection` point to real model artifacts. Loading them may require more memory, disk, startup time, and network access to Hugging Face unless you pre-stage local model directories.
- For air-gapped deployments, point OpenMed model identifiers at local directories and ensure the model files are already present in the CVM image or a persistent volume.
- Healthcare data handling requirements depend on your deployment, jurisdiction, and operational controls. This template only provides a deterministic software verifier; it is not a compliance boundary by itself.

## Security Notes

- Only Caddy publishes a host port: `8080:80`.
- The app service is internal and uses `expose`, not `ports`.
- The template does not use privileged mode, host networking, host IPC, Docker socket mounts, host bind mounts, or external credentials.
- No API keys, tokens, passwords, or private keys are baked into the compose file.

## Cleanup

```bash
docker compose down
```

No named volumes are created by this template.
