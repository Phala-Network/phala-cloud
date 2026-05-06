---
name: training-run
description: |
  Run a confidential training / fine-tuning job on Phala Cloud GPU TEE.
  SFT, DPO, RLHF, LoRA / QLoRA / PEFT, continued pre-training, or
  multimodal projector training with TRL, Unsloth, or HuggingFace.
  Use when users want to train on sealed datasets with attested checkpoints.
---

# Confidential Training on Phala GPU TEE

`phala deploy` a TRL/Unsloth/HuggingFace training job on H200 with sealed datasets and signed checkpoint output.

## Operations

| User says | Operation |
|---|---|
| "fine-tune Llama", "SFT my model" | **First Run (SFT)** |
| "DPO", "preference tuning", "RLHF" | **DPO / RLHF** |
| "LoRA", "QLoRA", "PEFT" | **LoRA / PEFT** |
| "continued pre-training", "domain adaptation" | **Continued PT** |
| "multimodal", "vision adapter" | **Multimodal** |
| "seal the dataset", "private data" | **Seal Dataset** |
| "save checkpoints", "signed manifest" | **Output & Signing** |
| "scale to 8 GPU" | **Multi-GPU** |

This skill builds on `phala-cli/SKILL.md`. Install + login per that skill first.

---

## Choose Method

| Method | Trainer | Best for | Memory |
|---|---|---|---|
| SFT | TRL `SFTTrainer`, Unsloth | Instruction tuning on chat data | Full / LoRA |
| DPO | TRL `DPOTrainer` | Preference tuning (chosen/rejected pairs) | Reference + policy |
| RLHF | TRL `PPOTrainer` + reward model | Online RL from prefs | Heaviest |
| LoRA / PEFT | TRL + PEFT, Unsloth | Cost-efficient fine-tune | Tiny — 7B fits in 1 H200 |
| QLoRA | Unsloth, BitsAndBytes | 4-bit base + LoRA adapters | Smallest |
| Continued PT | Unsloth, raw HF Trainer | Domain adaptation on raw text | Medium |
| Multimodal | TRL + projector head | Adding vision / audio to LLM | Medium |

Most teams start with **LoRA on a 7-13B model** (`h200.small`, $3.50/hr).

---

## Scaffold

### Step 1: Project layout

```bash
mkdir my-finetune && cd my-finetune
```

```
my-finetune/
├── docker-compose.yml
├── train/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── train.py            # the actual training script
├── data/                   # local-only, sealed dataset
│   └── dataset.tar.gz.enc
├── .env.example
└── .env                    # gitignored
```

### Step 2: `train/Dockerfile`

```dockerfile
FROM nvcr.io/nvidia/pytorch:24.10-py3
RUN pip install transformers trl peft accelerate bitsandbytes datasets unsloth
COPY train.py /app/train.py
WORKDIR /app
CMD ["python", "train.py"]
```

### Step 3: `train/train.py` (LoRA SFT example)

```python
from trl import SFTTrainer, SFTConfig
from peft import LoraConfig
from datasets import load_dataset
from transformers import AutoModelForCausalLM, AutoTokenizer
import os

model_id = os.environ["BASE_MODEL"]            # e.g. meta-llama/Llama-3.1-8B-Instruct
dataset_path = os.environ["DATASET_PATH"]      # mounted volume path
output_dir = os.environ.get("OUTPUT_DIR", "/output")

tok = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(model_id, torch_dtype="auto", device_map="auto")
ds = load_dataset("json", data_files=dataset_path, split="train")

trainer = SFTTrainer(
    model=model,
    tokenizer=tok,
    train_dataset=ds,
    peft_config=LoraConfig(r=32, lora_alpha=64, target_modules="all-linear"),
    args=SFTConfig(
        output_dir=output_dir,
        num_train_epochs=3,
        per_device_train_batch_size=2,
        save_strategy="epoch",
    ),
)
trainer.train()
trainer.save_model(output_dir)
```

### Step 4: `docker-compose.yml`

```yaml
services:
  trainer:
    build: ./train
    environment:
      - BASE_MODEL=meta-llama/Llama-3.1-8B-Instruct
      - DATASET_PATH=/data/dataset.jsonl
      - OUTPUT_DIR=/output
      - HF_TOKEN=${HF_TOKEN}
      - DATASET_KEY=${DATASET_KEY}        # for in-CVM dataset decryption
    volumes:
      - sealed-data:/data
      - checkpoints:/output
      - /var/run/dstack.sock:/var/run/dstack.sock
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
volumes:
  sealed-data:
  checkpoints:
```

---

## Seal Dataset

The dataset never leaves your laptop in cleartext.

### Step 1: Encrypt locally with HKDF

```python
# scripts/seal-dataset.py
import os, hashlib, hmac, json
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

KMS_PUBKEY = open("kms-pubkey.txt").read().strip()
APP_ID = os.environ["APP_ID"]
COMPOSE_HASH = os.environ["COMPOSE_HASH"]

def hkdf(material: bytes, info: bytes, length: int = 32) -> bytes:
    return hmac.new(material, info, hashlib.sha256).digest()[:length]

key = hkdf(KMS_PUBKEY.encode(), f"{APP_ID}:{COMPOSE_HASH}".encode())
aes = AESGCM(key)
nonce = os.urandom(12)
plaintext = open("dataset.jsonl", "rb").read()
ct = aes.encrypt(nonce, plaintext, None)
open("dataset.jsonl.enc", "wb").write(nonce + ct)
```

### Step 2: Upload encrypted blob

The encrypted file ships with the compose. Or to S3 (decrypt inside CVM via `--pre-launch-script`).

### Step 3: Decrypt inside the CVM

The CVM's per-app key is derived only after attestation passes. Mirror the HKDF to re-derive the same key inside the CVM:

```python
# Inside train.py — pip install dstack-sdk cryptography
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dstack_sdk import DstackClient

client = DstackClient()                    # auto-connects to /var/run/dstack.sock
derived = client.get_key("dataset/wrap", os.environ["COMPOSE_HASH"])
key = derived.decode_key()                 # 32-byte secp256k1 → use as AES key

aes = AESGCM(key)
blob = open("/data/dataset.jsonl.enc", "rb").read()
plaintext = aes.decrypt(blob[:12], blob[12:], None)
open("/tmp/dataset.jsonl", "wb").write(plaintext)
```

If the compose-hash doesn't match the registered hash, the derived key is wrong and decryption fails. Stolen ciphertext is useless.

---

## First Run (SFT)

### Step 1: Pick GPU shape

| Model size | Type | Per-device batch | GPU |
|---|---|---|---|
| 7B LoRA | `h200.small` | 4-8 | 1× H200 |
| 13B LoRA | `h200.small` | 2-4 | 1× H200 |
| 70B LoRA | `h200.16xlarge` | 1-2 | 8× H200 |
| 7B full SFT | `h200.16xlarge` | 1 | 8× H200 |

### Step 2: Deploy

```bash
phala deploy -n llama-sft -c docker-compose.yml -e .env -t h200.small --kms phala --wait
```

### Step 3: Stream logs

```bash
phala logs -f
```

Look for `loss=...` decreasing. Training duration depends on dataset size and method — typical small-data LoRA finishes in 1-3 hours.

---

## Multi-GPU

For 70B SFT or larger:

### Update `train.py` to use accelerate launcher

```python
# Replace the simple Trainer with deepspeed / FSDP via accelerate
```

### Update compose command

```yaml
command: ["accelerate", "launch", "--multi_gpu", "--num_processes=8", "train.py"]
```

### Deploy on 8× H200

```bash
phala deploy -n llama-70b-sft -c docker-compose.yml -e .env -t h200.16xlarge --kms phala --wait
```

---

## DPO / RLHF

Swap `SFTTrainer` for `DPOTrainer`:

```python
from trl import DPOTrainer, DPOConfig

trainer = DPOTrainer(
    model=model,
    ref_model=None,           # uses peft adapters disabled
    tokenizer=tok,
    train_dataset=ds,         # must have chosen/rejected fields
    args=DPOConfig(output_dir=output_dir, beta=0.1, num_train_epochs=1),
)
trainer.train()
```

For PPO/RLHF, follow TRL's `PPOTrainer` recipe — same compose, swap script.

---

## LoRA / PEFT

Already shown in **Scaffold**. Adapter files land in `/output/adapter_*` — much smaller than full checkpoints (typically 50-500 MB).

---

## Continued PT

Use Unsloth's `from_pretrained` + raw `Trainer`:

```python
from unsloth import FastLanguageModel
model, tok = FastLanguageModel.from_pretrained(model_id, load_in_4bit=True)
# ... raw text dataset, MaskedLM-style training ...
```

---

## Output & Signing

After training completes, the output dir contains:
- `pytorch_model.bin` / `safetensors` (weights)
- `config.json`
- `tokenizer.json` (if shipped)

### Sign the manifest

Use the per-app key (via `dstack-guest-agent`) to sign a manifest containing checkpoint hashes:

```python
import json, hashlib, time
from dstack_sdk import DstackClient

client = DstackClient()
ckpt = open("/output/pytorch_model.bin", "rb").read()
manifest = {
    "compose_hash": os.environ["COMPOSE_HASH"],
    "base_model": os.environ["BASE_MODEL"],
    "checkpoint_sha256": hashlib.sha256(ckpt).hexdigest(),
    "ts": int(time.time()),
}

# Bind the manifest into a fresh TDX quote — `application_data` is the
# 64-byte report_data the verifier checks.
report = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).digest()
quote = client.get_quote(report)

open("/output/manifest.signed.json", "w").write(json.dumps({
    **manifest,
    "quote": quote.quote,
    "event_log": quote.event_log,
}))
```

The signature chains to the TDX root + on-chain `DstackApp.sol` entry. Auditors verify offline.

### Pull the artifacts

```bash
phala cp :/output/ ./checkpoints/ -r
```

---

## Verify

```bash
phala cvms attestation llama-sft --json > attestation.json
phala ssh -- nvidia-smi conf-compute -q       # ConfComputeMode : ON
```

Then run the full verification flow per `verify-attestation.md` — Intel TDX + NVIDIA NRAS + report-data binding + compose-hash. The `manifest.signed.json` quote can be verified the same way: its `report_data` binds the manifest hash to a fresh TDX quote.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| OOM on 7B SFT | Batch too big | Reduce `per_device_train_batch_size` or use `gradient_accumulation_steps` |
| Slow throughput | Single-GPU FP16 70B | Move to `h200.16xlarge` + tensor parallel |
| `HF_TOKEN` 401 | Token doesn't have model access | Accept the model license on HF, regenerate token |
| Decrypt fails | Compose-hash mismatch | First deploy registers the hash; subsequent deploys must use the same compose |
| Signature fails | Wrong app-id | `phala status` to confirm workspace; pubkey must match the running app |

---

## Reference: minimal end-to-end

```bash
# 1. Scaffold + seal dataset
mkdir my-finetune && cd my-finetune
# (write Dockerfile + train.py + compose + .env)
python scripts/seal-dataset.py

# 2. Auth + deploy
phala login
phala deploy -n llama-sft -c docker-compose.yml -e .env -t h200.small --kms phala --wait

# 3. Watch + verify
phala logs -f
phala cvms attestation --json | jq
phala cp :/output/manifest.signed.json ./
```

The output is a signed checkpoint that any auditor can verify — no need to trust the trainer or Phala.
