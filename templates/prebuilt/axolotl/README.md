# axolotl-ai-cloud/axolotl On Phala Cloud

Deploy a CPU-safe Axolotl source and configuration verifier on Phala Cloud.

## Overview

Axolotl is an open-source LLM post-training and fine-tuning framework from `axolotl-ai-cloud`. The upstream project supports workflows such as LoRA, QLoRA, SFT, preference tuning, FSDP, and DeepSpeed.

This Phala Cloud template intentionally does not start real fine-tuning. Instead, it runs a small HTTP verifier on port `8000` that pins the upstream `main` source commit `3c4ff59f25c1f648aa8ea76d4fb4793fb0aed9d7`, verifies selected upstream files by SHA256, parses package/config metadata, parses a LoRA example, parses a DeepSpeed ZeRO-3 config, syntax-compiles Axolotl CLI source without executing imports, and exposes smoke-testable JSON endpoints.

The demo downloads no model weights, imports no top-level `axolotl` module, installs no Axolotl package, starts no training job, requires no GPU or CUDA runtime, and requires no Hugging Face, Weights & Biases, cloud storage, or model-provider credentials.

## Metadata

- Template id: `axolotl`
- Display name: `axolotl-ai-cloud/axolotl`
- Category: LLM Fine-Tuning & Training
- Upstream repository: https://github.com/axolotl-ai-cloud/axolotl
- Pinned upstream ref: `main`
- Pinned upstream commit: `3c4ff59f25c1f648aa8ea76d4fb4793fb0aed9d7`
- Latest upstream release inspected: `v0.16.1`
- Release page: https://github.com/axolotl-ai-cloud/axolotl/releases/tag/v0.16.1
- Upstream license: Apache-2.0
- Icon source: `templates/icons/axolotl.svg` is copied from upstream `image/axolotl_symbol_digital_black.svg` at https://raw.githubusercontent.com/axolotl-ai-cloud/axolotl/3c4ff59f25c1f648aa8ea76d4fb4793fb0aed9d7/image/axolotl_symbol_digital_black.svg

## What This Template Runs

- `app`: a Python `3.12-slim-bookworm` HTTP service exposed on container and host port `8000`.

At startup the service launches a background verifier that fetches these pinned upstream files:

- `README.md`
- `VERSION`
- `pyproject.toml`
- `examples/llama-3/lora-1b.yml`
- `deepspeed_configs/zero3.json`
- `src/axolotl/cli/main.py`
- `docs/agents/sft.md`

For each file it checks the expected SHA256 digest and specific source markers. It then uses only Python standard-library parsers to inspect `pyproject.toml`, parse the DeepSpeed JSON, extract deterministic fields from the LoRA YAML example, and compile the CLI source with `compile(..., "exec")`. Compiling source checks syntax only; it does not import Axolotl, import Torch, initialize CUDA, contact providers, download models, or execute training code.

## Why This Is A Verifier

The upstream Axolotl quickstart is GPU-oriented. It documents NVIDIA or AMD GPU requirements, PyTorch, CUDA-oriented installation choices, Hugging Face models and datasets, optional tracking services, and Docker examples that use GPU flags and host IPC. Installing or importing the full training package can pull in heavy ML dependencies such as Torch, Transformers, PEFT, Accelerate, bitsandbytes, Triton, xformers, DeepSpeed extras, and related GPU/runtime components.

That is not an honest default for a Phala Cloud `tdx.small` smoke deployment. This template therefore proves pinned upstream source/config facts without pretending to operate a production fine-tuning stack.

## Deploy On Phala Cloud

1. Create a new Phala Cloud deployment from the `axolotl` prebuilt template.
2. Keep the default small CPU resources for the verifier demo.
3. Deploy the CVM and open the generated public endpoint for port `8000`.
4. Check `https://<your-app-domain>/healthz`, `https://<your-app-domain>/demo`, and `https://<your-app-domain>/v1/models`.

The first startup only pulls the Python base image and fetches small public text files from GitHub for verification. No private credentials, model downloads, GPU devices, host mounts, host networking, host IPC, privileged mode, external build context, `env_file`, or Docker socket access are required.

## Environment Variables

No user-supplied environment variables are required.

The compose file sets only non-secret verifier constants:

- `AXOLOTL_UPSTREAM`: upstream repository URL.
- `AXOLOTL_REF_NAME`: human-readable upstream ref label, currently `main`.
- `AXOLOTL_REF`: pinned upstream commit used for raw source verification.
- `AXOLOTL_LATEST_RELEASE`: latest upstream release inspected, currently `v0.16.1`.
- `AXOLOTL_LATEST_RELEASE_PUBLISHED_AT`: upstream release timestamp.
- `VERIFY_TIMEOUT_SECONDS`: timeout for each small upstream file fetch.
- `PYTHONUNBUFFERED`: enables immediate container log output.

Optional credentials for real Axolotl usage are not needed and are not read by the default verifier:

- `HF_TOKEN`: optional Hugging Face token for gated/private models or datasets if you later convert this verifier into a real training deployment. Required: false.
- `WANDB_API_KEY`: optional Weights & Biases key for experiment tracking in real training. Required: false.
- `AXOLOTL_DO_NOT_TRACK`: optional Axolotl telemetry opt-out flag for real Axolotl runs. Required: false.

Do not add API keys, model-provider credentials, cloud storage credentials, session tokens, database passwords, private keys, or OAuth secrets to this demo unless you are converting it into a real production deployment. If you do convert it, define credential-like values as Phala Cloud environment variables or secrets and avoid hardcoding values in `docker-compose.yml`.

## Endpoints

- `GET /healthz`: readiness JSON for Phala smoke testing. It returns HTTP `200` only after all verifier checks pass. It returns JSON with HTTP `503` while verification is running or if any check fails.
- `GET /demo`: verifier details, pinned upstream metadata, parsed LoRA config evidence, parsed DeepSpeed ZeRO-3 evidence, and explicit statements that no production training stack is running.
- `GET /v1/models`: OpenAI-compatible model-list shape containing a local mock entry named `axolotl/source-verifier-demo`. It is clearly marked as a verifier/demo entry and does not represent hosted inference.
- `GET /`: same readiness payload as `/healthz`.

Example:

```bash
curl -fsS https://<your-app-domain>/healthz
curl -fsS https://<your-app-domain>/demo
curl -fsS https://<your-app-domain>/v1/models
```

Expected `/demo` fields include:

```json
{
  "demo": {
    "mode": "CPU-safe Axolotl source/config verifier",
    "full_finetune_started": false,
    "model_weights_downloaded": false,
    "gpu_required_for_verifier": false,
    "gpu_required_for_real_training": true,
    "provider_credentials_required_for_verifier": false,
    "safe_for_tdx_small_smoke": true
  }
}
```

## Validation And Smoke Commands

From the `sdks` repository root:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/axolotl/docker-compose.yml config
```

From the parent worktree root used by this task:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/axolotl/docker-compose.yml config
```

Optional local smoke test:

```bash
docker compose -f templates/prebuilt/axolotl/docker-compose.yml up -d
curl -fsS http://localhost:8000/healthz
curl -fsS http://localhost:8000/demo
curl -fsS http://localhost:8000/v1/models
docker compose -f templates/prebuilt/axolotl/docker-compose.yml down
```

Static audit commands:

```bash
test -f templates/icons/axolotl.svg
test "$(find templates/prebuilt/axolotl -maxdepth 1 -type f | wc -l)" = "2"
python3 - <<'PY'
import json
from pathlib import Path
config = json.loads(Path("templates/config.json").read_text())
entries = [entry for entry in config if entry.get("id") == "axolotl"]
assert len(entries) == 1, entries
assert entries[0]["repo"] == "https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/axolotl"
assert Path("templates/icons", entries[0]["icon"]).is_file()
PY
rg -n "env_file|privileged: true|network_mode: host|ipc: host|pid: host|docker\\.sock|build:" templates/prebuilt/axolotl/docker-compose.yml templates/config.json
rg -n "AKIA[0-9A-Z]{16}|-----BEGIN (RSA |OPENSSH |EC |DSA |)PRIVATE KEY-----|xox[baprs]-|sk-[A-Za-z0-9_-]{20,}|hf_[A-Za-z0-9]{20,}|[A-Za-z0-9_]*(PASSWORD|SECRET|TOKEN|API_KEY)[A-Za-z0-9_]*=.*[^ >-]" templates/prebuilt/axolotl templates/config.json
```

The first `rg` command should produce no matches for the Axolotl compose file. The second command should not find literal credential values; it may find optional placeholder names in documentation or config descriptions.

## Resource Expectations

The verifier demo is small and intended for `tdx.small`-class smoke testing. It runs one Python HTTP process, performs a few small HTTPS fetches, and keeps only parsed metadata in memory.

Production Axolotl sizing depends on model size, sequence length, precision, adapter strategy, dataset size, checkpoint cadence, distributed training mode, storage layout, and whether you use LoRA, QLoRA, full fine-tuning, FSDP, DeepSpeed, Ray, vLLM, or other integrations. Plan CPU, memory, disk, GPU, and network resources around the actual training workload rather than this verifier.

## Security Notes

- The demo exposes unauthenticated health and metadata endpoints. This is acceptable for smoke testing, but not for private training jobs or model/data management.
- The compose file contains no real credentials and no credential-like environment variable values.
- The demo does not use `env_file`, host bind mounts, external build contexts, privileged mode, host networking, host IPC, host PID, or Docker socket access.
- The verifier fetches public upstream files from GitHub. If outbound access is unavailable, `/healthz` returns JSON with HTTP `503`.
- Add authentication, TLS routing, secret management, private network controls, logging policies, and data retention policies before exposing production Axolotl APIs or training controls.

## Moving To Production Axolotl

Use this template as a Phala smoke-safe upstream verifier, not as a production fine-tuning deployment.

To deploy real Axolotl training:

1. Start from the official upstream repository and release-matched source at https://github.com/axolotl-ai-cloud/axolotl.
2. Choose the exact training workflow: SFT, LoRA, QLoRA, DPO/KTO/ORPO, GRPO, reward modeling, pretraining, FSDP, DeepSpeed, Ray, or vLLM serving.
3. Provide model and dataset access explicitly, including `HF_TOKEN` if gated/private Hugging Face assets are required.
4. Provide optional tracking credentials such as `WANDB_API_KEY` only when experiment tracking is intentionally enabled.
5. Size GPU, memory, disk, and checkpoint storage for the target model, dataset, precision, sequence length, and distributed strategy.
6. Review upstream telemetry settings and set `AXOLOTL_DO_NOT_TRACK=1` if telemetry should be disabled.
7. Replace this verifier's endpoints with production readiness checks that reflect your training job, queue, storage, and checkpoint health.
