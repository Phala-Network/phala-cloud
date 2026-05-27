# huggingface/trl on Phala Cloud

This template runs a CPU-safe TRL verifier HTTP service. At startup it installs a CPU PyTorch wheel, installs the real `trl` Python package, imports TRL trainer/config APIs, and exposes deterministic JSON probes for deployment smoke testing.

The default service intentionally does not download model weights, load a model, require CUDA, require Hugging Face or provider credentials, construct a real trainer, or call `train()`. It is a verifier for package import/version/config/data-flow readiness, not a fine-tuning job.

## Deploy on Phala Cloud

Deploy the prebuilt `trl` template and expose port `8080`.

For local Compose checks from this directory:

```bash
docker compose config
docker compose up -d
```

The first start downloads Python wheels for CPU-only PyTorch, Transformers, Accelerate, Datasets, and TRL. Those are package downloads only; the service does not download model weights or datasets from the Hugging Face Hub.

## Configuration

No credentials are required by the default verifier.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `TRL_PACKAGE_VERSION` | `0.24.0` | No | Pinned TRL package version installed by the verifier. The default exposes SFT, DPO, PPO, and reward trainer APIs for smoke checks. |
| `PYTORCH_CPU_VERSION` | `2.9.1+cpu` | No | CPU-only PyTorch wheel installed from `https://download.pytorch.org/whl/cpu` before TRL dependencies are resolved. |
| `TRANSFORMERS_PACKAGE_VERSION` | `4.57.6` | No | Transformers version pinned for the default TRL verifier. |
| `ACCELERATE_PACKAGE_VERSION` | `1.13.0` | No | Accelerate version pinned for the default TRL verifier. |
| `DATASETS_PACKAGE_VERSION` | `4.8.5` | No | Datasets version pinned for the local in-memory data-flow check. |

Only override these pins after checking compatibility together. Unconstrained TRL installs can resolve CUDA-enabled PyTorch packages; this template pins CPU PyTorch first so the default deployment remains CPU-safe on small Phala CVMs.

## Usage

The HTTP API listens on port `8080`.

```bash
curl -fsS http://localhost:8080/healthz | jq
curl -fsS http://localhost:8080/demo | jq
curl -fsS http://localhost:8080/v1/models | jq
```

Endpoints:

- `/healthz`: returns HTTP 200 only when the real `trl` package import, package version lookup, required trainer/config symbol imports, and PyTorch import checks succeeded. If imports fail, it returns HTTP 503 with the captured error.
- `/demo`: returns deterministic local metadata for a tiny smoke path: trainer classes are resolved, TRL config dataclasses are inspected, and small in-memory SFT/preference records are passed through local Datasets/TRL data-format checks. It does not construct a model, construct a trainer, or train.
- `/v1/models`: returns an OpenAI-compatible-ish model list containing `trl-cpu-safe-verifier`. It is metadata only; no inference or training model is hosted.

## Verification

After deployment, run:

```bash
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo | jq '.demo.model_downloaded, .demo.training_started, .demo.trainer_constructed'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `/demo` reports `model_downloaded: false`, `training_started: false`, and `trainer_constructed: false`.
- `/demo` includes package versions, imported trainer class metadata, config field checks, and a stable SHA-256 digest for the local records.
- `/v1/models` includes `trl-cpu-safe-verifier`.

## Production notes

TRL is designed for real post-training and alignment workflows such as SFT, DPO, PPO, reward modeling, GRPO, and related RLHF pipelines. Running those workloads in production is a different deployment from this verifier.

For real training, operators must provide appropriate model weights, tokenizers, datasets, storage, GPU resources, training configuration, and optional Hugging Face credentials or model-provider credentials. Operators should also choose a TRL/PyTorch/Transformers version set that matches their training method and hardware. This template does not include those credentials and does not start any training path by default.

For a production fine-tuning service, replace the verifier app with your own training code, configure persistent storage for checkpoints and logs, size the CVM for the selected model and batch shape, and review privacy requirements for datasets and model artifacts before deployment.

## Upstream

- Upstream repository: `https://github.com/huggingface/trl`
- Upstream author: Hugging Face
- Python package: `trl`
- Icon source: upstream `assets/logo-dark.png` from `huggingface/trl`, saved locally as `templates/icons/trl.png`

The stored icon is not hotlinked at runtime.
