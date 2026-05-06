---
name: verify-attestation
description: |
  Verify a Phala Cloud TEE attestation end-to-end — Intel TDX quote
  to Intel root, NVIDIA GPU quote to NVIDIA root, report-data binding
  the signing key + nonce, OS image hash to dstack-os reproducible
  build, compose-hash to expected app, and Sigstore provenance for
  container images. Use this whenever a user asks "how do I verify
  this is really running in TEE?"
---

# Verify TEE Attestation

The hardware-rooted proof flow that other skills reference. Every step gives a separate cryptographic guarantee — together they prove a Phala Cloud workload is running on genuine TEE hardware with the exact code you registered.

## Operations

| User says | Operation |
|---|---|
| "is this really in TEE?", "verify the CVM" | **Quick Check** |
| "verify the GPU TEE", "NVIDIA quote" | **Verify NVIDIA GPU** |
| "verify the TDX quote", "Intel root" | **Verify Intel TDX** |
| "fresh nonce", "replay attack" | **Nonce Binding** |
| "OS image hash", "reproducible build" | **OS Image Verification** |
| "compose-hash matches", "exact code running" | **Compose Manifest** |
| "verify the response signature" | **Verify Signature** |
| "offline verifier", "no internet" | **Offline Verification** |

> **Authoritative doc:** [docs.phala.com/phala-cloud/confidential-ai/verify](https://docs.phala.com/phala-cloud/confidential-ai/verify) is the source of truth. This skill summarizes it as runnable steps.

---

## Quick Check

If you just want to confirm "yes, this CVM is running in TEE":

```bash
# Summary
phala cvms attestation my-app

# Full JSON (for programmatic verification)
phala cvms attestation my-app --json > attestation.json
```

The summary should report `is_online: true`, `is_public: true`, and `error: null`. The JSON contains `app_certificates[0].quote` — a hex-encoded TDX quote that's the basis for everything else below.

For inference (hosted Confidential AI API), use the per-request flow:

```bash
curl "https://api.redpill.ai/v1/attestation/report?model=phala/deepseek-chat-v3-0324&nonce=$(openssl rand -hex 32)" \
  -H "Authorization: Bearer $CONFIDENTIAL_AI_KEY" > report.json
```

The response includes `nvidia_payload`, `intel_quote`, `signing_address`, and `signing_algo`.

---

## Why every step

| Risk | Step that catches it |
|---|---|
| Replayed attestation from old/compromised hardware | **Nonce binding** — fresh per request |
| Counterfeit CPU pretending to be Intel TDX | **Verify Intel TDX** via DCAP / Phala verify endpoint |
| Counterfeit GPU pretending to be H100/H200 | **Verify NVIDIA** via NRAS |
| Signing key not actually inside the TEE | **Report-data binding** — first 32 bytes of `reportdata` = signing key |
| Operator swapped your code post-boot | **Compose manifest hash** — `mr_config` includes compose-hash |
| Operator swapped the OS image | **OS image hash** — matches dstack-os reproducible build |
| Container image swapped at registry | **Sigstore provenance** — built from expected source |

Skip any step → that risk is unguarded.

---

## Nonce Binding

Generate a fresh 32-byte nonce per attestation request. The TEE embeds this nonce into the report — replayed quotes won't match.

```python
import secrets
request_nonce = secrets.token_hex(32)   # 64 hex chars
```

Pass the nonce when you fetch the attestation report:

```python
import requests
report = requests.get(
    f"https://api.redpill.ai/v1/attestation/report?model={model}&nonce={request_nonce}",
    headers={"Authorization": f"Bearer {api_key}"},
).json()
```

For app-CVM attestation (not hosted-API), the nonce is bound at handshake time via RA-TLS, and you verify by extracting `report_data` from the TLS cert's TDX-quote extension.

---

## Verify NVIDIA GPU

Only NVIDIA can confirm their hardware is genuine — secret keys baked into each chip at manufacturing.

```python
import json, base64, requests

gpu_payload = json.loads(report["nvidia_payload"])
assert gpu_payload["nonce"].lower() == request_nonce.lower()    # check fresh

# Send to NVIDIA Remote Attestation Service (NRAS)
r = requests.post("https://nras.attestation.nvidia.com/v3/attest/gpu", json=gpu_payload)
result = r.json()

# Decode the JWT verdict
jwt_token = result[0][1]
payload_b64 = jwt_token.split(".")[1]
padded = payload_b64 + "=" * ((4 - len(payload_b64) % 4) % 4)
verdict = json.loads(base64.urlsafe_b64decode(padded))

assert verdict["x-nvidia-overall-att-result"] is True
```

A passing NRAS verdict means the GPU silicon is genuine NVIDIA, the firmware is signed, and Confidential Compute mode is active.

---

## Verify Intel TDX

Two paths — an online verifier service (easy) or local DCAP verification (offline).

### Online (Phala verifier)

```python
intel_result = requests.post(
    "https://cloud-api.phala.com/api/v1/attestations/verify",
    json={"hex": report["intel_quote"]},
).json()

assert intel_result["quote"]["verified"] is True
```

### Offline (DCAP)

Use [`dcap-qvl`](https://github.com/Phala-Network/dcap-qvl) — Phala's open-source DCAP quote verifier:

```bash
cargo install --git https://github.com/Phala-Network/dcap-qvl
echo "$INTEL_QUOTE_HEX" | xxd -r -p > quote.bin
dcap-qvl verify quote.bin
```

This chains to Intel's PCS root cert, no network call to Phala.

For an interactive sanity check without code, paste the hex `intel_quote` into the [TEE Attestation Explorer](https://proof.t16z.com/) — it decodes the quote and shows TDX version + security features.

---

## Report-Data Binding

The TDX quote's `reportdata` field is 64 bytes the application provides to the hardware at attestation time. Phala packs it as:

| Bytes | Content |
|---|---|
| 0–31 | Signing address (ECDSA: 20-byte Eth address right-padded; Ed25519: 32-byte pubkey) |
| 32–63 | Your request nonce |

Verify both halves match what you expect:

```python
report_data = bytes.fromhex(intel_result["quote"]["body"]["reportdata"].removeprefix("0x"))

embedded_address = report_data[:32]
embedded_nonce = report_data[32:64]

if report["signing_algo"] == "ecdsa":
    addr = bytes.fromhex(report["signing_address"].removeprefix("0x"))
    assert embedded_address == addr.ljust(32, b"\x00")
else:
    pubkey = bytes.fromhex(report["signing_address"])
    assert embedded_address == pubkey

assert embedded_nonce.hex() == request_nonce
```

This proves: (1) the signing key was generated inside the TEE — it's bound into hardware-attested report data; (2) the attestation is fresh — it contains your unique nonce; (3) the signing key you'll use for verifying responses actually belongs to this TEE instance.

---

## OS Image Verification

Verify the operating system the CVM booted is the dstack-os reproducible build, not a tampered image.

The TDX `mrtd` and `rtmr0..3` measurements are folded into the quote at boot. Compare them against the expected values from [meta-dstack reproducible builds](https://github.com/Dstack-TEE/meta-dstack#reproducible-build-the-guest-image):

```bash
tar -xzf dstack-0.5.5.tar.gz
cat dstack-0.5.5/digest.txt
# 0b327bcd642788b0517de3ff46d31ebd3847b6c64ea40bacde268bb9f1c8ec83
```

Then in the verification code, follow the [`osVerification.ts`](https://github.com/Phala-Network/dstack-verifier/blob/95689c41/src/verification/osVerification.ts#L13-L27) pattern from `dstack-verifier` to compute and compare TCB measurements against the digest above.

If even one byte of the OS image differs, the measurements won't match.

---

## Compose Manifest

Verify the running CVM's `app_compose.json` hash matches the registered `compose-hash`. This is what proves "the code I see is the code that's running".

```python
from hashlib import sha256, json

tcb_info = report["info"]["tcb_info"]
if isinstance(tcb_info, str):
    tcb_info = json.loads(tcb_info)

app_compose = tcb_info["app_compose"]
compose_hash = sha256(app_compose.encode()).hexdigest()

# `mr_config` field of TDX quote includes the compose hash, prefixed with "0x01"
mr_config = intel_result["quote"]["body"]["mrconfig"]
expected = "0x01" + compose_hash
assert mr_config.lower().startswith(expected.lower())

# Optional: print the actual docker-compose so the user can review
docker_compose = json.loads(app_compose)["docker_compose_file"]
print(docker_compose)
```

This proves the CVM booted with exactly the docker-compose you registered. Operator can't swap services, change images, or inject env vars after boot.

---

## Sigstore Provenance

Verify each container image in the compose was built from a known source repo (not a backdoor pushed to the registry).

```python
import re, requests

digests = set(re.findall(r'@sha256:([0-9a-f]{64})', docker_compose))

for digest in digests:
    sigstore_url = f"https://search.sigstore.dev/?hash=sha256:{digest}"
    r = requests.head(sigstore_url, timeout=10)
    if r.status_code < 400:
        print(f"✓ {sigstore_url}")
    else:
        print(f"✗ {sigstore_url} (HTTP {r.status_code})")
```

A passing Sigstore link lets the user open the URL and confirm the image was built from the expected GitHub repo, with the expected workflow, by the expected actor. If a digest has no Sigstore record, the user must trust the registry directly — flag this in your verifier UI.

---

## Verify Signature

Once you've verified the signing key is bound to a real TEE, verify response signatures from the Confidential AI API.

Every response carries:

| Header | Meaning |
|---|---|
| `x-phala-receipt-sig` | Signature over `(model_id, prompt_hash, response_hash, ts)` |
| `x-phala-compose-hash` | Compose-hash of the model serving CVM |
| `x-phala-app-id` | Per-app key identity |

```python
import hashlib
from eth_keys import keys

prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()
response_hash = hashlib.sha256(response_text.encode()).hexdigest()
payload = f"{model_id}|{prompt_hash}|{response_hash}|{timestamp}"

# ECDSA verification (signing_algo == "ecdsa")
signature = bytes.fromhex(receipt_sig.removeprefix("0x"))
recovered = keys.ecdsa_recover(hashlib.sha256(payload.encode()).digest(), keys.Signature(signature))
assert recovered.to_address() == report["signing_address"]
```

For Ed25519, use `nacl.signing.VerifyKey(pubkey).verify(payload, signature)` instead.

This is the final link: the response YOU received is bound to the (verified-genuine) TEE that produced it.

---

## Offline Verification

If you can't reach Phala's verify endpoint or NRAS:

| Step | Offline tool |
|---|---|
| Verify Intel TDX quote | [`dcap-qvl`](https://github.com/Phala-Network/dcap-qvl) — chains to Intel PCS root |
| Verify NVIDIA GPU quote | [`nvattest-verifier`](https://github.com/NVIDIA/nvtrust) — NVIDIA's local verifier (chains to NVIDIA root) |
| Verify OS image hash | Compare against `digest.txt` from [meta-dstack release tarball](https://github.com/Dstack-TEE/meta-dstack/releases) |
| Verify compose-hash | sha256 the app_compose JSON locally; check against `mr_config` byte for byte |
| Verify Sigstore record | `cosign verify --certificate-identity-regexp '...' --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' <image>` |

End-to-end offline: clone [Phala-Network/dstack-verifier](https://github.com/Phala-Network/dstack-verifier), feed it `attestation.json`, get a single PASS/FAIL.

---

## Reference: minimal end-to-end (Python)

```python
# Full flow — verify a Confidential AI API response is genuine
import secrets, requests, json, base64, hashlib

api_key = os.environ["CONFIDENTIAL_AI_KEY"]
model = "phala/deepseek-chat-v3-0324"

# 1. Fresh nonce
nonce = secrets.token_hex(32)

# 2. Get attestation report
report = requests.get(
    f"https://api.redpill.ai/v1/attestation/report?model={model}&nonce={nonce}",
    headers={"Authorization": f"Bearer {api_key}"},
).json()

# 3. Verify NVIDIA GPU
gpu_payload = json.loads(report["nvidia_payload"])
assert gpu_payload["nonce"].lower() == nonce.lower()
nras = requests.post("https://nras.attestation.nvidia.com/v3/attest/gpu", json=gpu_payload).json()
verdict = json.loads(base64.urlsafe_b64decode(nras[0][1].split(".")[1] + "=="))
assert verdict["x-nvidia-overall-att-result"] is True

# 4. Verify Intel TDX
intel = requests.post(
    "https://cloud-api.phala.com/api/v1/attestations/verify",
    json={"hex": report["intel_quote"]},
).json()
assert intel["quote"]["verified"] is True

# 5. Verify report-data binding
rd = bytes.fromhex(intel["quote"]["body"]["reportdata"].removeprefix("0x"))
addr = bytes.fromhex(report["signing_address"].removeprefix("0x"))
assert rd[:32] == addr.ljust(32, b"\x00")
assert rd[32:64].hex() == nonce

# 6. Verify compose-hash
tcb = report["info"]["tcb_info"]
if isinstance(tcb, str): tcb = json.loads(tcb)
ch = hashlib.sha256(tcb["app_compose"].encode()).hexdigest()
assert intel["quote"]["body"]["mrconfig"].lower().startswith(("0x01" + ch).lower())

print("ALL VERIFIED — request to", model, "ran on genuine GPU TEE with the expected code.")
```

A reference implementation lives at [`Phala-Network/private-ml-sdk/vllm-proxy/verifiers/attestation_verifier.py`](https://github.com/Phala-Network/private-ml-sdk/blob/main/vllm-proxy/verifiers/attestation_verifier.py) — copy it, point at your model + key, run.
