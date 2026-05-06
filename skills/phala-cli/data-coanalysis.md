---
name: data-coanalysis
description: |
  Set up multi-party cohort analysis on Phala Cloud — multiple data owners
  each seal datasets locally, then a sealed Analysis CVM joins them in
  TDX+H200 memory under multi-sig DstackApp approval. Use for healthcare
  consortia, financial risk, fraud detection, supply-chain audits — any
  case where data must stay at source but compute happens jointly.
---

# Multi-Party Confidential Cohort Analysis

Compute-to-data: sealed datasets stay at source, the model travels, multi-owner approval gates every key release.

## Operations

| User says | Operation |
|---|---|
| "set up multi-party analysis", "consortium", "data clean room" | **End-to-End** |
| "seal my dataset", "encrypt at source" | **Owner Sealing** |
| "register on-chain", "multi-sig approval" | **Register & Approve** |
| "deploy the analysis CVM" | **Deploy Analysis** |
| "differential privacy aggregate", "DP" | **DP Output** |
| "revoke", "stop the analysis" | **Revoke** |

This skill builds on `phala-cli/SKILL.md`. Install + login per that skill first.

---

## Architecture (skim this once)

```
Owner A laptop                        Owner B laptop
[seal-cli encrypts ds-A.jsonl]        [seal-cli encrypts ds-B.jsonl]
        |                                     |
        +-> S3/IPFS ciphertext blobs <--------+
                          |
                          v
            Analysis CVM (TDX + H200)
            - reads blobs
            - calls KMS via RA-TLS for per-dataset keys
            - joins, embeds, runs the model
            - emits ONLY contract-allowed output (DP-aggregate)
                          |
                          v
            DstackApp.sol (multi-sig)
            - owners = [A, B, ...] are signers
            - compose-hash added only after threshold met
            - any owner can withdraw signature → halt all subsequent compute
```

Phala is not in the trust chain. Owners verify everything offline.

---

## Owner Sealing

Each data owner does this on their own laptop. Phala/operator never sees plaintext.

### Step 1: Get the analysis compose-hash

The analyst publishes the analysis `docker-compose.yml`. Each owner reviews it (it's small and reviewable; data is large and sensitive). The compose-hash is the contract.

```bash
# Owner: clone the analyst's repo, review, then compute the hash
sha256sum docker-compose.yml
# 0xa3f2c1...  (this is the compose-hash)
```

### Step 2: Get the analysis app-id

After the analyst publishes the compose, the analyst registers it on `DstackApp.sol` (or shares the app-id):

```
APP_ID=app_d8e2f1...
COMPOSE_HASH=a3f2c1...
KMS_ROOT_PUBKEY=0x04abc...   # from kms.phala.com or hardcoded in dstack
```

### Step 3: Seal the dataset locally

```python
# seal-dataset.py
import os, sys, hashlib, hmac
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

OWNER_ID = sys.argv[1]            # e.g. "hospital-a"
INPUT = sys.argv[2]               # e.g. "ehr-data.jsonl"
OUTPUT = sys.argv[3]              # e.g. "ehr-data.sealed"

KMS = bytes.fromhex(os.environ["KMS_ROOT_PUBKEY"][2:])
APP = os.environ["APP_ID"].encode()
HASH = os.environ["COMPOSE_HASH"].encode()
INFO = b"|".join([APP, HASH, OWNER_ID.encode()])

# HKDF-Expand simulation
key = hmac.new(KMS, INFO, hashlib.sha256).digest()
aes = AESGCM(key)
nonce = os.urandom(12)

plaintext = open(INPUT, "rb").read()
ct = aes.encrypt(nonce, plaintext, INFO)
open(OUTPUT, "wb").write(nonce + ct)
print(f"Sealed {len(plaintext)} bytes -> {OUTPUT} ({len(ct) + 12} bytes)")
```

```bash
python seal-dataset.py hospital-a ehr-data.jsonl ehr-data.sealed
```

### Step 4: Publish the ciphertext

Owners ship `*.sealed` blobs to a shared S3 bucket / IPFS / wherever the analysis CVM can read them. Plaintext never leaves the owner's machine.

---

## Register & Approve

### Step 1: Analyst registers the compose

```bash
phala deploy -n cohort-analysis -c docker-compose.yml --kms ethereum \
  --private-key $ANALYST_KEY --rpc-url $ETH_RPC \
  --custom-app-id app_cohort_v1 --nonce 1 \
  --prepare-only
```

`--prepare-only` produces a commit token (no on-chain transaction yet — for multi-sig flow).

### Step 2: Owners approve via multisig wallet

Each owner uses Safe / Gnosis to approve the `DstackApp.addAllowedHash(compose_hash)` transaction. The DstackApp owner is configured as a multi-sig with each data owner as a signer.

### Step 3: Once threshold met, commit

```bash
phala deploy --commit --token $COMMIT_TOKEN --transaction-hash $TX
```

The compose-hash is now on-chain. The CVM can boot.

---

## Deploy Analysis

### Step 1: Compose with sealed data ingestion

```yaml
services:
  analysis:
    image: ghcr.io/<your-org>/cohort-analysis:v1
    environment:
      - APP_ID=${APP_ID}
      - COMPOSE_HASH=${COMPOSE_HASH}
      - SEALED_BLOBS=s3://cohort/sealed/   # paths owners published
      - OWNER_LIST=hospital-a,hospital-b   # whose keys to derive
    volumes:
      - /var/run/dstack.sock:/var/run/dstack.sock
    deploy:
      resources:
        reservations:
          devices: [{ driver: nvidia, count: all, capabilities: [gpu] }]
```

### Step 2: Inside the analysis container

```python
# analysis.py — pip install dstack-sdk cryptography
import os
from dstack_sdk import DstackClient
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

client = DstackClient()                                  # /var/run/dstack.sock
owners = os.environ["OWNER_LIST"].split(",")

for owner in owners:
    derived = client.get_key(f"cohort/{owner}", os.environ["COMPOSE_HASH"])
    key = derived.decode_key()                           # 32 bytes
    blob = read_s3(f"s3://cohort/sealed/{owner}.sealed")
    aes = AESGCM(key)
    plaintext = aes.decrypt(blob[:12], blob[12:], None)
    # join into a polars/pandas frame, run the model, etc.
```

The keys ONLY re-derive if the running compose-hash matches the on-chain registered hash — i.e. the verifier already passed.

### Step 3: Deploy

```bash
phala deploy -n cohort-analysis -c docker-compose.yml \
  -e APP_ID=app_cohort_v1 -e COMPOSE_HASH=$HASH \
  -t h200.small --kms ethereum \
  --private-key $ANALYST_KEY --rpc-url $ETH_RPC --listed --wait
```

`--listed` makes the CVM visible on the public Trust Center so owners can independently verify it's running their registered build.

---

## DP Output

The analysis container should emit ONLY contract-allowed output — typically:
- Aggregate statistics (mean, count, ratio)
- Differential-privacy-noised aggregates
- Embedding vectors (without row provenance)
- Signed labels (without the row's full features)

Anything that could leak per-row provenance must be guarded by the compose itself. The compose is the contract owners reviewed.

```python
# In analysis.py — emit only DP-aggregate
from diffprivlib import LaplaceMechanism
mech = LaplaceMechanism(epsilon=1.0, sensitivity=1)
result = {
    "cohort_size": mech.randomise(len(joined_df)),
    "mean_risk_score": mech.randomise(float(joined_df["risk"].mean())),
}

# Bind the result into a TDX quote so anyone can verify it offline
import hashlib
report = hashlib.sha256(json.dumps(result, sort_keys=True).encode()).digest()
quote = client.get_quote(report)
print(json.dumps({**result, "quote": quote.quote, "compose_hash": compose_hash}))
```

---

## Revoke

Any single owner can halt all subsequent compute by withdrawing their multi-sig approval on `DstackApp.sol`.

```bash
# Owner's wallet:
DstackApp.removeAllowedHash(compose_hash)
```

The next time the Analysis CVM tries to refresh keys via KMS, the verifier sees the hash is no longer allowed, and the key derivation fails. In-flight compute that already has unwrapped data is in TDX memory only — it cannot persist anything to disk that's readable elsewhere.

---

## Verify

### Each owner runs locally:

```bash
phala cvms attestation cohort-analysis --json > attestation.json
# Then run the full verification per verify-attestation.md:
#   - TDX quote chains to Intel root (DCAP / Phala verify endpoint)
#   - GPU NV-CSE quote chains to NVIDIA root (NRAS)
#   - report_data binds to the signing key + your nonce
#   - mr_config binds to the expected compose_hash
#   - container images have Sigstore provenance from expected source repos
```

### Each owner checks DstackApp.sol:

```
DstackApp.allowedHashes(compose_hash) == true
DstackApp.owners() == [hospital-a-addr, hospital-b-addr, ...]
DstackApp.threshold() == 2  # or whatever k-of-n is in use
```

### Output verification

The signed aggregate's signature must verify against the per-app pubkey — and that pubkey only exists if attestation + on-chain approval both passed.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Decrypt fails inside CVM | Compose-hash mismatch | Confirm `phala cvms get` returns the same compose-hash you sealed against |
| `--prepare-only` token expired | Not committed within window | Re-run `--prepare-only` and have owners approve quickly |
| KMS query 403 | On-chain `addAllowedHash` not yet confirmed | Wait for tx confirmation; `phala cvms restart` |
| Output too aggressive | DP epsilon too small or aggregate too narrow | Tune `epsilon`; coarsen the aggregation function |
| Owner can't decrypt their own dataset locally | Used wrong KMS pubkey | Pull from `kms.phala.com` per current epoch |

---

## Reference: minimal end-to-end

```bash
# Owner side (each owner)
python seal-dataset.py hospital-a ./ehr-data.jsonl ./ehr-data.sealed
aws s3 cp ehr-data.sealed s3://cohort/sealed/hospital-a.sealed

# Analyst side
phala login
phala deploy -n cohort-analysis -c docker-compose.yml --kms ethereum \
  --private-key $ANALYST_KEY --rpc-url $ETH_RPC --prepare-only
# (owners approve in multisig wallet)
phala deploy --commit --token $TOKEN --transaction-hash $TX
phala cvms attestation cohort-analysis --json > attestation.json
phala logs -f                                 # watch the join + DP-aggregate
```

The output is a DP-aggregate signed by an attested CVM whose compose-hash was multi-owner approved on-chain. Each owner can verify offline without trusting the analyst, the operator, or Phala.
