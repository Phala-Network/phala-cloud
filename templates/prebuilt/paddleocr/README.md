# PaddlePaddle/PaddleOCR

Deploy a CPU-safe PaddleOCR package verifier on Phala Cloud.

## Overview

This prebuilt template deploys a minimal HTTP service for
[PaddlePaddle/PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR), a multilingual
OCR and document AI toolkit for turning images and PDF documents into structured
JSON or Markdown for AI workflows.

The upstream README describes PaddleOCR as a toolkit for PDF/image document parsing,
scene OCR, PP-OCRv5, PP-StructureV3, and PaddleOCR-VL, with support for 100+
languages. The upstream installation docs separate the `paddleocr` Python package
from the inference engine and model assets, and the serving docs recommend PaddleX
serving for production inference services.

This template therefore runs a no-secret verifier rather than a production OCR
inference server. The image installs the real `paddleocr` Python package, imports it,
checks public package symbols, constructs documented API option payloads, and exposes
deterministic JSON endpoints. It does not instantiate `PaddleOCR(...)`, load an
inference engine, download OCR model weights, call PaddleOCR's hosted API, call an LLM
provider, require a GPU, or require credentials.

## Metadata

- Template id: `paddleocr`
- Display name: `PaddlePaddle/PaddleOCR`
- Category: AI Apps & Workflows
- Upstream repository: https://github.com/PaddlePaddle/PaddleOCR
- Python package: `paddleocr`
- Default package version: `3.6.0`
- Icon source: upstream docs logo,
  `https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/docs/version3.x/logo.jpg`
  saved as `templates/icons/paddleocr.png` because the source bytes are PNG.
- Upstream author: PaddlePaddle, via the `PaddlePaddle/PaddleOCR` GitHub repository

## What This Template Runs

The template starts one Python HTTP service on port `8080`. During the image build it
installs `paddleocr==3.6.0` from PyPI and verifies that the package imports. At
runtime the service checks symbols such as `PaddleOCR`, `PPStructureV3`,
`PaddleOCRVL`, `PaddleOCRClient`, `OCROptions`, `PPStructureV3Options`, and
`PaddleOCRVLOptions`.

The `/demo` endpoint uses the package's real API option dataclasses and helper
functions to build local option payloads and a PaddleX-style pipeline configuration
preview. It also returns a deterministic sample structured-document payload so
integrations can validate response handling. That sample is explicitly not OCR output.

No provider credentials, model downloads, GPU devices, host bind mounts, Docker
socket access, privileged mode, host networking, host IPC, `env_file`, browser auth,
or external databases are used.

## Deployment

1. Create a new Phala Cloud deployment from the `paddleocr` prebuilt template.
2. Keep the default resources for this smoke verifier: 1 vCPU, 2048 MB memory, and
   20 GB disk.
3. Leave `PADDLEOCR_VERSION` at `3.6.0` unless you intentionally want to test another
   published PaddleOCR package version.
4. Deploy the CVM and wait for the image build and first startup to finish.
5. Open `https://<your-app-domain>/healthz`.

The first image build downloads Python wheels from PyPI. After startup, the default
endpoints operate only on local package metadata and deterministic JSON.

## Environment Variables

No secrets are required.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PADDLEOCR_VERSION` | No | `3.6.0` | Pinned PaddleOCR Python package version installed by the inline Dockerfile build and reported by the runtime. |

The compose file also sets fixed internal values `PORT=8080`,
`PYTHONDONTWRITEBYTECODE=1`, and `PYTHONUNBUFFERED=1`.

## Endpoints

- `GET /healthz`: Imports `paddleocr`, checks package metadata and expected symbols,
  and reports CPU-safe default behavior.
- `GET /demo`: Builds deterministic PaddleOCR API option payloads, a PaddleX-style
  serving config preview, and a sample structured-document response without model
  inference.
- `GET /v1/models`: Returns OpenAI-shaped metadata for PaddleOCR model families. It
  does not expose loaded inference models.
- `GET /upstream`: Returns upstream repository, package, documentation, icon source,
  and endpoint metadata.
- `GET /`: Returns a compact endpoint index.

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
  "demo": {
    "credentials_required": false,
    "inference_engine_loaded": false,
    "model_weights_downloaded": false,
    "ocr_inference_attempted": false,
    "hosted_model_call_attempted": false
  }
}
```

## Smoke Verification

Run these validations from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/paddleocr/docker-compose.yml config >/dev/null
```

These commands verify the template metadata, README coverage, compose syntax, and
Git whitespace before smoke testing.

If Docker is available locally, run the service:

```bash
docker compose -f templates/prebuilt/paddleocr/docker-compose.yml up -d --build
curl -fsS http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/upstream
docker compose -f templates/prebuilt/paddleocr/docker-compose.yml down
```

If local port `8080` is already in use, temporarily change only the host side of the
port mapping, for example `18080:8080`, then use
`http://localhost:18080/healthz`.

## Production Notes

- This is a package/runtime verifier, not a production OCR API.
- Real OCR inference requires choosing an inference engine, model family, model asset
  source, language settings, resource limits, and request-size limits.
- Upstream's production serving docs recommend PaddleX serving. A real PaddleX
  service can load PP-OCRv5, PP-StructureV3, or PaddleOCR-VL pipelines and expose
  model-backed OCR/document parsing endpoints.
- Constructing default PaddleOCR pipelines can download model weights. This template
  avoids pipeline construction so a default Phala Cloud deployment stays CPU-safe and
  deterministic.
- PaddleOCR-VL and high-accuracy document parsing workflows can require substantially
  more memory, disk, and startup time than this verifier. Size those deployments
  separately from `tdx.small` smoke-test resources.
- If you adapt this into a document upload API, add authentication, authorization,
  request body limits, file-type allowlists, malware scanning as appropriate, rate
  limits, request logging, and retention controls.
- If you use hosted PaddleOCR APIs or external object storage, add only the required
  placeholder environment variables in `config.json` and Phala Cloud settings. Do not
  place real API keys, bearer tokens, private keys, OTPs, passwords, or storage
  secrets in `docker-compose.yml` or this README.
- Keep `PADDLEOCR_VERSION` pinned for reproducible deployments.

## Upstream Attribution

This template installs and imports the real `paddleocr` Python package from the
upstream PaddlePaddle project:

- Repository: https://github.com/PaddlePaddle/PaddleOCR
- Package index: https://pypi.org/project/paddleocr/
- Installation docs:
  https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/installation.en.md
- OCR pipeline docs:
  https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/pipeline_usage/OCR.en.md
- Serving docs:
  https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/inference_deployment/serving/serving.en.md
- Icon source:
  https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/docs/version3.x/logo.jpg
