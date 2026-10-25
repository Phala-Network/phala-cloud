---
name: verify-attestation
description: |
  Verify a Phala Cloud TEE attestation end-to-end — Intel TDX quote
  to Intel root, the measured dstack CPU policy that verifies GPUs
  before application startup and keys, optional independent GPU evidence
  appraisal against NVIDIA roots, report-data binding
  the signing key + nonce, OS image hash to dstack-os reproducible
  build, compose-hash to expected app, and Sigstore provenance for
  container images. Use this whenever a user asks "how do I verify
  this is really running in TEE?"
---

# Verify TEE Attestation

Verify a Phala Cloud workload against your accepted hardware, OS image, application, and key-release policy. For dstack GPU deployments, the standard GPU policy verifies the GPU during boot, before application startup and key provisioning. Verify the CPU image and deployment policy that enforce this behavior; failed GPU checks stop boot.

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

For inference (hosted Private AI API), use the per-request flow:

```bash
curl "https://api.redpill.ai/v1/attestation/report?model=phala/deepseek-chat-v3-0324&nonce=$(openssl rand -hex 32)" \
  -H "Authorization: Bearer $PRIVATE_AI_API_KEY" > report.json
```

The response includes `nvidia_payload`, `intel_quote`, `signing_address`, and `signing_algo`.

---

## Why every step

| Risk | Step that catches it |
|---|---|
| Replayed attestation from old/compromised hardware | **Nonce binding** — fresh per request |
| Counterfeit CPU pretending to be Intel TDX | **Verify Intel TDX** via DCAP / Phala verify endpoint |
| Counterfeit or misconfigured GPU | **GPU boot gate** — the approved dstack CPU runtime verifies NVIDIA evidence and enforces the GPU policy |
| Valid CPU and GPU evidence without an enforced handoff | **GPU boot gate** — accepted CPU code checks GPUs before readiness and key provisioning |
| Signing key not actually inside the TEE | **Report-data binding** — first 32 bytes of `reportdata` = signing key |
| Operator swapped your code post-boot | **Compose manifest hash** — `mr_config` includes compose-hash |
| Operator swapped the OS image | **OS image hash** — matches dstack-os reproducible build |
| Container image swapped at registry | **Sigstore provenance** — built from expected source |

Apply the checks for your workload. GPU workloads also require the boot gate and protected CPU-to-GPU connection described below; CPU-only CVMs do not require GPU evidence.

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

For a dstack GPU deployment using the standard GPU policy, dstack verifies GPU attestation and Confidential Computing mode during boot, before starting the application and provisioning workload keys. Failed verification stops boot.

Normal verification checks the CPU attestation, approved dstack image, and deployment policy that enforce this behavior. Collecting and appraising raw GPU evidence yourself is optional independent inspection. Two valid hardware quotes alone do not establish the enforced handoff.

### GPU boot gate

Verify the CPU quote, approved dstack image, and application configuration, including the measured GPU policy. The accepted policy must require GPU attestation and production security settings. The verified boot code enforces the GPU check before application startup and key provisioning, and the runtime uses the protected CPU-to-GPU connection for private data.

For dstack TDX releases implementing the [measured GPU boot appraisal](https://github.com/Dstack-TEE/dstack/blob/250334c26a97a579fe26d911d89e8e90256d8572/docs/security/security-model.md#gpu-security-for-ai-workloads):

1. Replay the event log against the verified quote's RTMR3. Require exactly one `gpu-policy-hash` event immediately after `compose-hash`, matching `SHA-256(JCS(requirements.gpu_policy))`. An omitted policy uses `{}`. Check `MrConfigV3.gpu_policy_hash` too when present. Accept only a policy requiring GPU attestation and the expected production security settings.
2. Require exactly one `gpu-attestation` event before `system-ready`. Check the expected nonzero device count, CC state, and allowed DevTools/debug/secure-boot state. The accepted CPU code must enforce these checks before requesting app keys. The event itself is recorded after key provisioning for TPM-unseal compatibility.
3. When independently appraising the boot-time NVIDIA evidence, request `/v1/Attest` with `include_boottime_gpu_evidence`. Select the `nvidia-nvattest-boottime-json-v1` bundle and compare `SHA-256(hex_decode(bundle.evidence))` with the measured event's `evidence_sha256`. Hash the exact decoded bytes, then appraise the authenticated evidence.

These bindings use RTMR3, not application-controlled `report_data`. `/v1/AttestGpu` returns fresh evidence for a caller nonce; it does not bind that GPU to the CPU's boot appraisal. A boot appraisal records startup checks, not continuous device identity or physical co-location. See the linked security model for the platform and lifetime boundaries.

Use the evidence contract for the deployed dstack release. If the accepted CPU image, required policy, or boot-gate evidence cannot be established, report GPU workload verification as incomplete and withhold secrets. A standalone GPU quote or local `nvidia-smi` status does not complete this verification.

### Independent GPU evidence inspection

Use the following procedure when you want to fetch and appraise GPU evidence yourself. It supplements verification of the dstack CPU boot chain and policy; ordinary application integrations rely on dstack to perform the GPU check during boot.

#### NVIDIA evidence appraisal

Use NVIDIA's [`nvattest` CLI and SDK](https://docs.nvidia.com/attestation/nv-attestation-sdk-cpp/latest/sdk-cli/introduction.html) for local or NRAS-backed verification. Use versions compatible with the deployment's evidence format.

Verify the evidence signatures, NVIDIA certificate chain and reference measurements, freshness, and accepted firmware/security state. For NRAS, authenticate the signed verdict, its issuer, validity, and nonce before applying policy. Decoding a JWT payload is not signature verification. Check Confidential Computing mode, debug/DevTools settings, and the expected device count explicitly.

#### Get GPU evidence yourself

These commands run **inside your GPU CVM**, or a container with `/var/run/dstack.sock` mounted. They use the [dstack v1 guest API](https://github.com/Dstack-TEE/dstack/blob/250334c26a97a579fe26d911d89e8e90256d8572/sdk/curl/api.md#7-attest-gpu-v1). Check that your deployed guest image supports these methods:

```bash
curl --fail-with-body --unix-socket /var/run/dstack.sock \
  http://dstack/v1/Version
```

The frozen v0.5.x API does not expose these GPU methods. A 404 means v1 is unavailable; a 501 from `AttestGpu` means the image has no GPU evidence collector. Use a compatible GPU guest image for this procedure. These are internal guest endpoints, not URLs on `inference.phala.com`. Hosted API clients need evidence published by their selected model deployment; a gateway's CPU quote describes the gateway.

**Boot-time evidence:** fetch the CPU attestation and the NVIDIA appraisal saved during boot together:

```bash
CHALLENGE=$(openssl rand -hex 32)
curl --fail-with-body --unix-socket /var/run/dstack.sock \
  http://dstack/v1/Attest \
  -H 'Content-Type: application/json' \
  -d "{\"report_data\":\"$CHALLENGE\",\"include_boottime_gpu_evidence\":true}" \
  -o boot-attestation.json
```

The response has `attestation` and `boottime_gpu_evidence`. Select the bundle with vendor `nvidia` and format `nvidia-nvattest-boottime-json-v1`. Its hex `evidence` decodes to the exact boot-time `nvattest` output, including `claims` and `detached_eat`. An empty list means no boot-time GPU output was returned. The challenge freshens the CPU report, not the historical GPU record. Authenticate the record using the CPU quote and event-log binding in [GPU boot gate](#gpu-boot-gate).

**Fresh GPU evidence:** ask the GPU to answer your own 32-byte challenge:

```bash
GPU_NONCE=$(openssl rand -hex 32)
curl --fail-with-body --unix-socket /var/run/dstack.sock \
  http://dstack/v1/AttestGpu \
  -H 'Content-Type: application/json' \
  -d "{\"nonce\":\"$GPU_NONCE\"}" \
  -o gpu-attestation.json
```

Select `bundles` with vendor `nvidia` and format `nvidia-nvattest-collect-evidence-json-v1`. Decode the hex `evidence` bytes into a file without reformatting them. For example, save this as `extract-gpu-evidence.py`:

```python
import json
import sys
from pathlib import Path

source, field, evidence_format, output = {
    "fresh": ("gpu-attestation.json", "bundles",
              "nvidia-nvattest-collect-evidence-json-v1", "gpu-evidence.json"),
    "boot": ("boot-attestation.json", "boottime_gpu_evidence",
             "nvidia-nvattest-boottime-json-v1", "gpu-boot-record.json"),
}[sys.argv[1]]
report = json.loads(Path(source).read_text())
bundles = [b for b in report[field]
           if b["vendor"] == "nvidia"
           and b["format"] == evidence_format]
if len(bundles) != 1:
    raise ValueError("Expected one NVIDIA evidence bundle")
Path(output).write_bytes(bytes.fromhex(bundles[0]["evidence"]))
```

Appraise all devices in that evidence with NVIDIA's verifier, using the same nonce:

```bash
python3 extract-gpu-evidence.py fresh
nvattest attest --device gpu --verifier local \
  --gpu-evidence-source file --gpu-evidence-file gpu-evidence.json \
  --nonce "$GPU_NONCE" --format json > gpu-appraisal.json
```

Install `nvattest` on the verifying machine using NVIDIA's linked instructions. Expect a successful exit and `result_code: 0`; then apply your accepted GPU policy to all returned claims. See the [command reference](https://docs.nvidia.com/attestation/nv-attestation-sdk-cpp/latest/sdk-cli/command-reference.html#attest) for `--relying-party-policy` and NRAS-backed appraisal. This appraises the GPU evidence independently; it does not establish the CPU boot gate or bind that GPU to this CVM. Keep the nonce with the saved evidence for later verification.

Run `python3 extract-gpu-evidence.py boot` to save the boot record as `gpu-boot-record.json`. Authenticate those exact bytes through the CPU quote and measured event log before inspecting its claims. This is an appraisal record, not the fresh raw-evidence input to `nvattest attest` above.

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
mr_config = intel_result["quote"]["body"]["mr_config_id"]
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

Once you've verified the signing key is bound to a real TEE, verify response signatures from the Private AI API.

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
| Independently inspect NVIDIA GPU evidence (optional) | [`nvattest`](https://docs.nvidia.com/attestation/nv-attestation-sdk-cpp/latest/sdk-cli/command-reference.html#attest) with local verification and the required cached collateral |
| Verify GPU boot gate | Accepted CPU image and GPU policy; replay TDX RTMR3 events and bind any boot-time NVIDIA evidence as above |
| Verify OS image hash | Compare against `digest.txt` from [meta-dstack release tarball](https://github.com/Dstack-TEE/meta-dstack/releases) |
| Verify compose-hash | sha256 the app_compose JSON locally; check against `mr_config` byte for byte |
| Verify Sigstore record | `cosign verify --certificate-identity-regexp '...' --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' <image>` |

Offline verification requires the relevant vendor collateral and release artifacts in advance. Use [Phala-Network/dstack-verifier](https://github.com/Phala-Network/dstack-verifier) for the checks it supports. For dstack GPU workloads, verify the CPU image and policy that enforce the GPU boot gate. Use NVIDIA’s verifier and cached collateral when independently inspecting raw GPU evidence.

---

## Reference: CPU field checks (Python)

```python
# Partial example: CPU fields and application binding; complete all policy checks above
import os, secrets, requests, json, hashlib

api_key = os.environ["PRIVATE_AI_API_KEY"]
model = "phala/deepseek-chat-v3-0324"

# 1. Fresh nonce
nonce = secrets.token_hex(32)

# 2. Get attestation report
report = requests.get(
    f"https://api.redpill.ai/v1/attestation/report?model={model}&nonce={nonce}",
    headers={"Authorization": f"Bearer {api_key}"},
).json()

# 3. Complete NVIDIA appraisal and the CPU-enforced GPU boot gate
# using the evidence retrieval and verification procedures above.

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
assert intel["quote"]["body"]["mr_config_id"].lower().startswith(("0x01" + ch).lower())

print("CPU FIELDS MATCH — complete GPU boot-gate, image, policy, and signature checks before releasing secrets.")
```

When evaluating an existing verifier, check its GPU appraisal, accepted CPU image and policy, and boot-gate coverage against the procedures above. A passing CPU quote check and a passing GPU quote check are separate inputs to that verification.
