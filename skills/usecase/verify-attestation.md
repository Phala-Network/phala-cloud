---
name: verify-attestation
description: |
  Verify a Phala Cloud TEE attestation against its platform vendor root,
  including Intel TDX and AMD SEV-SNP, the dstack CPU policy that verifies GPUs
  before application startup and keys, optional independent GPU evidence
  appraisal against NVIDIA roots, application-specific report-data binding,
  OS image hash to dstack-os reproducible
  build, compose-hash to expected app, and Sigstore provenance for
  container images. Use this whenever a user asks "how do I verify
  this is really running in TEE?"
---

# Verify TEE Attestation

Verify a Phala Cloud workload against your accepted hardware, OS image, application, and key-release policy. For dstack GPU deployments, the standard GPU policy verifies the GPU during boot, before application startup and key provisioning. Verify the CPU image and deployment policy that enforce this behavior; failed GPU checks stop boot.

For hosted Private AI requests, use [PAP](inference-call.md#verify-private-inference-with-pap) or [reproduce ACI verification independently](inference-call.md#reproduce-verification-independently). The procedures below cover general CVMs and self-hosted workloads.

## Operations

| User says | Operation |
|---|---|
| "is this really in TEE?", "verify the CVM" | **Quick Check** |
| "verify the GPU TEE", "NVIDIA quote" | **Verify NVIDIA GPU** |
| "verify the CPU", "AMD SEV-SNP", "platform verification" | **Verify CPU Attestation** |
| "verify the TDX quote", "Intel root" | **Verify Intel TDX** |
| "fresh nonce", "replay attack" | **Nonce Binding** |
| "OS image hash", "reproducible build" | **OS Image Verification** |
| "compose-hash matches", "exact code running" | **Compose Manifest** |
| "verify the response signature" | **Verify Signature** |
| "offline verifier", "no internet" | **Offline Verification** |

> **Authoritative doc:** [docs.phala.com/phala-cloud/confidential-ai/verify](https://docs.phala.com/phala-cloud/confidential-ai/verify) is the source of truth. This skill summarizes it as runnable steps.

---

## Quick Check

Collect the deployment status and available attestation evidence:

```bash
# Summary
phala cvms attestation my-app

# Full JSON (for programmatic verification)
phala cvms attestation my-app --json > attestation.json
```

The CLI reports deployment status and available certificates. On legacy Intel TDX deployments, `app_certificates[0].quote` contains a raw TDX quote. For platform-adaptive verification, collect the versioned `/v1/Attest` response and use the [complete CVM policy example](#reference-verify-a-cvm-against-an-approved-policy) below. This supports AMD SEV-SNP as well as TDX.

---

## Why every step

| Risk | Step that catches it |
|---|---|
| Replayed attestation from old/compromised hardware | **Nonce binding** — fresh per request |
| Counterfeit CPU pretending to be Intel TDX | **Verify Intel TDX** via DCAP / Phala verify endpoint |
| Counterfeit or misconfigured GPU | **GPU boot gate** — the approved dstack CPU runtime verifies NVIDIA evidence and enforces the GPU policy |
| Valid CPU and GPU evidence without an enforced handoff | **GPU boot gate** — accepted CPU code checks GPUs before readiness and key provisioning |
| Signing key not actually inside the TEE | **Report-data binding** — check the approved application’s key and nonce binding |
| Operator swapped your code post-boot | **Compose manifest hash** — `mr_config` includes compose-hash |
| Operator swapped the OS image | **OS image hash** — matches dstack-os reproducible build |
| Container image swapped at registry | **Sigstore provenance** — built from expected source |

Apply the checks for your workload. GPU workloads also require the boot gate and protected CPU-to-GPU connection described below; CPU-only CVMs do not require GPU evidence.

---

## Nonce Binding

Generate the challenge on your verifying machine, then send it to the CVM for attestation. Compare it with the hardware-authenticated report data after verification. The [CVM policy example](#reference-verify-a-cvm-against-an-approved-policy) uses a fresh 32-byte challenge and checks its exact encoding.

A signed output or TLS session also needs a binding to the key used by that connection or response. Follow the approved application's report-data format. For hosted inference, PAP handles the ACI challenge, keyset, and serving-connection bindings.

---

## Verify NVIDIA GPU

For a dstack GPU deployment using the standard GPU policy, dstack verifies GPU attestation and Confidential Computing mode during boot, before starting the application and provisioning workload keys. Failed verification stops boot.

Normal verification checks the CPU attestation, approved dstack image, and deployment policy that enforce this behavior. Collecting and appraising raw GPU evidence yourself is optional independent inspection. Two valid hardware quotes alone do not establish the enforced handoff.

### GPU boot gate

The [TDX GPU boot example](#verify-a-tdx-gpu-boot) applies these event and security-state checks after maintained CPU verification. The generic CVM profile checks identity only.

Verify the CPU quote, approved dstack image, and application configuration, including the measured GPU policy. The accepted policy must require GPU attestation and production security settings. The verified boot code enforces the GPU check before application startup and key provisioning, and the runtime uses the protected CPU-to-GPU connection for private data.

For dstack TDX releases implementing the [measured GPU boot appraisal](https://github.com/Dstack-TEE/dstack/blob/250334c26a97a579fe26d911d89e8e90256d8572/docs/security/security-model.md#gpu-security-for-ai-workloads):

1. Replay the event log against the verified quote's RTMR3. Require exactly one `gpu-policy-hash` event after `compose-hash` and any measured init scripts, matching `SHA-256(JCS(requirements.gpu_policy))`. An omitted policy uses `{}`. Check `MrConfigV3.gpu_policy_hash` too when present. Accept only a policy requiring GPU attestation and the expected production security settings.
2. Require exactly one version 3 `gpu-attestation` event before `system-ready`. Check the expected nonzero device count, CC state, and allowed DevTools/debug/secure-boot state. The accepted CPU code must enforce these checks before requesting app keys. The event itself is recorded after key provisioning for TPM-unseal compatibility.
3. When independently appraising the boot-time NVIDIA evidence, request `/v1/Attest` with `include_boottime_gpu_evidence`. Select the `nvidia-nvattest-boottime-json-v1` bundle and compare `SHA-256(hex_decode(bundle.evidence))` with the measured event's `evidence_sha256`. Hash the exact decoded bytes, then appraise the authenticated evidence.

On AMD SEV-SNP, verify the signed report and MrConfigV3 `HOST_DATA` binding. When present, `gpu_policy_hash` must match the expected GPU policy digest. This binds the policy; the current SNP path has no quote-bound runtime register binding the later GPU appraisal or boot-time evidence. The local boot check still enforces the accepted policy. See [AMD SEV-SNP attestation](https://github.com/Dstack-TEE/dstack/blob/250334c26a97a579fe26d911d89e8e90256d8572/docs/amd-sev-snp.md#attestation-and-image-identity).

The TDX bindings above use RTMR3, not application-controlled `report_data`. `/v1/AttestGpu` returns fresh evidence for a caller nonce; it does not bind that GPU to the CPU's boot appraisal. A boot appraisal records startup checks, not continuous device identity or physical co-location. See the linked security model for the platform and lifetime boundaries.

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

The response has `attestation` and `boottime_gpu_evidence`. Select the bundle with vendor `nvidia` and format `nvidia-nvattest-boottime-json-v1`. Its hex `evidence` decodes to the exact boot-time `nvattest` output, including `claims` and `detached_eat`. An empty list means no boot-time GPU output was returned. The challenge freshens the CPU report, not the historical GPU record. On TDX, authenticate the record using the CPU quote and RTMR3 event-log binding in [GPU boot gate](#gpu-boot-gate). On SNP, treat it as a local appraisal record; it has no equivalent quote-bound runtime binding.

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

Run `python3 extract-gpu-evidence.py boot` to save the boot record as `gpu-boot-record.json`. On TDX, authenticate those exact bytes through the CPU quote and measured event log before inspecting its claims. On SNP, it remains a local appraisal record without that remote runtime binding. This is an appraisal record, not the fresh raw-evidence input to `nvattest attest` above.

---

## Verify CPU Attestation

Use a verifier for the platform that produced the evidence. The versioned dstack attestation carries the platform-specific evidence and measurement material; the maintained dstack verifier selects the appropriate hardware verification path.

| Platform | Hardware and identity binding |
|---|---|
| Intel TDX | Intel DCAP signature/collateral, OS measurements, and RTMR3 application-event replay |
| AMD SEV-SNP | AMD ARK/ASK/VCEK chain, SNP report signature and launch measurements, and `HOST_DATA` binding of MrConfigV3 |

The [CVM policy example](#reference-verify-a-cvm-against-an-approved-policy) runs these checks and compares the resulting identity against your approved deployment. The TDX-specific examples below apply only to TDX evidence.

## Verify Intel TDX

Two paths — an online verifier service (easy) or local DCAP verification (offline).

### Online (Phala verifier)

```python
import json
import requests

intel_result = requests.post(
    "https://cloud-api.phala.com/api/v1/attestations/verify",
    json={"hex": json.load(open("attestation.json"))["app_certificates"][0]["quote"]},
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

For an interactive sanity check without code, paste the raw TDX quote hex into the [TEE Attestation Explorer](https://proof.t16z.com/) — it decodes the quote and shows TDX version + security features.

---

## Report-Data Binding

TDX and SNP reports cover 64 bytes of application-provided report data. The application protocol defines their meaning:

| Protocol | Binding to verify |
|---|---|
| This guide's `/v1/Attest` or `/GetQuote` challenge | The 32-byte nonce followed by 32 zero bytes. This freshens the CVM evidence. |
| Custom application or RA-TLS | The approved application's encoding of its signing or connection key and challenge. Check the actual key used to verify outputs or establish the connection. |
| Hosted ACI inference | A digest of the canonical ACI statement, binding the workload, keyset, and challenge. Use [PAP or the ACI procedure](inference-call.md#verify-private-inference-with-pap). |

A hardware signature authenticates those bytes. To establish that a key was generated and retained inside the CVM, also approve the measured code that creates and uses that key. A nonce-only CVM check does not bind a response or network connection.

---

## OS Image Verification

Verify the OS image against the authenticated boot measurements and your approved release. The platform-adaptive verifier in the [CVM policy example](#reference-verify-a-cvm-against-an-approved-policy) checks this for both TDX and SNP. The manual register comparison below is specific to TDX.

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

Verify the exact `app_compose.json` hash against your approved configuration. Dstack binds this identity through the CPU attestation: TDX uses its measured identity fields; SNP uses MrConfigV3 bound by `HOST_DATA`. The [CVM policy example](#reference-verify-a-cvm-against-an-approved-policy) checks the authenticated compose hash on both platforms.

The reference example compares the authenticated compose hash with an independently approved value. To prepare that value, hash the exact reviewed `app_compose.json` bytes on the verifying machine:

```bash
sha256sum app_compose.json
```

Review its container digests, environment configuration, GPU policy when applicable, and any init scripts before approving the hash. A compose hash identifies the configuration; image provenance and the approved OS determine what that configuration runs.

---

## Sigstore Provenance

Verify each reviewed container digest against the expected source and builder before approving the compose hash. For a GitHub Actions release with Sigstore provenance, install [Cosign](https://docs.sigstore.dev/cosign/system_config/installation/) and set `IMAGE_AT_DIGEST` to the exact image reference (`registry/repository@sha256:...`) and `EXPECTED_WORKFLOW_IDENTITY` to the independently approved workflow identity:

```bash
cosign verify-attestation \
  --type slsaprovenance \
  --certificate-identity "$EXPECTED_WORKFLOW_IDENTITY" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  "$IMAGE_AT_DIGEST"
```

Check the authenticated provenance's source repository, commit, builder, and build inputs against the approved release. Use the predicate type and issuer published by that release. See [Sigstore attestation verification](https://docs.sigstore.dev/cosign/verifying/attestation/) for applying provenance policy. Opening a transparency-log URL alone does not verify provenance.

---

## Verify Signature

For a custom CVM application's signed outputs, first authenticate the signing key through its documented attestation binding and approved code. Then verify the signature over the exact bytes defined by that application's protocol, using a maintained library for its signature scheme. For example, for an Ed25519 application:

```python
from pathlib import Path
from nacl.signing import VerifyKey

# Set this to the public key authenticated through the application's attestation.
public_key_hex = "<authenticated Ed25519 public key>"
VerifyKey(bytes.fromhex(public_key_hex)).verify(
    Path("message.bin").read_bytes(), Path("signature.bin").read_bytes()
)
```

Install PyNaCl on the verifying machine. A successful call returns the verified message; a modified message, signature, or key raises an error. Check the application's request binding and freshness rules as well.

For hosted inference, [PAP verifies ACI receipts](inference-call.md#verify-private-inference-with-pap), including the request and response wire hashes and the cited upstream session. To implement those checks independently, follow the linked ACI procedure.

---

## Offline Verification

If you can't reach Phala's verify endpoint or NRAS:

| Step | Offline tool |
|---|---|
| Verify Intel TDX quote (TDX only) | [`dcap-qvl`](https://github.com/Phala-Network/dcap-qvl) — chains to Intel PCS root |
| Independently inspect NVIDIA GPU evidence (optional) | [`nvattest`](https://docs.nvidia.com/attestation/nv-attestation-sdk-cpp/latest/sdk-cli/command-reference.html#attest) with local verification and the required cached collateral |
| Verify AMD SEV-SNP report | Maintained dstack verifier with AMD collateral and the SNP launch measurement material |
| Verify GPU boot policy | Approved CPU image and configuration; TDX runtime binding and SNP policy binding differ as described above |
| Verify OS image hash | Compare against `digest.txt` from [meta-dstack release tarball](https://github.com/Dstack-TEE/meta-dstack/releases) |
| Verify compose-hash | sha256 the app_compose JSON locally; check against `mr_config` byte for byte |
| Verify Sigstore record | `cosign verify --certificate-identity-regexp '...' --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' <image>` |

Offline verification requires the relevant vendor collateral and release artifacts in advance. Use [Phala-Network/dstack-verifier](https://github.com/Phala-Network/dstack-verifier) for the checks it supports. For dstack GPU workloads, verify the CPU image and policy that enforce the GPU boot gate. Use NVIDIA’s verifier and cached collateral when independently inspecting raw GPU evidence.

---

## Reference: verify a CVM against an approved policy

Use Python 3, Docker, OpenSSL, and a guest image exposing the dstack v1 API. This example uses the maintained [dstack verifier](https://github.com/Dstack-TEE/dstack/blob/250334c26a97a579fe26d911d89e8e90256d8572/dstack/verifier/README.md) for platform signatures, application-identity binding, and OS measurement verification. It supports Intel TDX and AMD SEV-SNP. The pinned verifier image below is release 0.6.1.

On your **verifying machine**, generate the challenge:

```bash
NONCE=$(openssl rand -hex 32)
echo "$NONCE"
```

Inside the CVM, use that challenge to collect a versioned attestation:

```bash
NONCE="<challenge from your verifying machine>"
curl --fail-with-body --unix-socket /var/run/dstack.sock \
  http://dstack/v1/Attest \
  -H 'Content-Type: application/json' \
  -d "{\"report_data\":\"$NONCE\"}" \
  -o cvm-attestation.json
```

Copy `cvm-attestation.json` back to your verifying machine. Prepare `approved-policy.json` from your independently reviewed OS release, application configuration, and key-provider identity. Use the exact SHA-256 of the reviewed `app_compose.json` bytes for `compose_hash`; pin container digests and verify their provenance before approving that configuration. For GPU event verification on TDX, also follow the GPU boot procedure below. The `gpu: null` profile checks CVM identity only. Obtain these trust inputs independently of the report being checked.

```json
{
  "tee_variant": "dstack-tdx",
  "app_id": "<expected application ID>",
  "compose_hash": "<approved 64-character hex compose hash>",
  "os_image_hash": "<approved 64-character hex OS image hash>",
  "key_provider": {"name": "kms", "id": "<approved KMS identity>"},
  "accepted_tcb_statuses": ["UpToDate"],
  "allowed_advisory_ids": [],
  "gpu": null
}
```

For AMD SEV-SNP, use `dstack-amd-sev-snp` and that deployment's approved values. The verifier authenticates the SNP report, launch measurements, and `HOST_DATA` binding instead of TDX registers. Its cryptographic `is_valid` result does not enforce your TCB or deployment policy; the following code does. Save it as `verify-cvm.py`:

```python
import json
import subprocess
import sys
import tempfile
from pathlib import Path

IMAGE = "ghcr.io/dstack-tee/dstack-verifier@sha256:9f2c07a94efd3d8a1a89268e5faa35e91e3cb345b9c4ab859c86d35142f4f788"
report_path, policy_path, nonce_hex = sys.argv[1:]
policy = json.loads(Path(policy_path).read_text())
required = {"tee_variant", "app_id", "compose_hash", "os_image_hash",
            "key_provider", "accepted_tcb_statuses", "allowed_advisory_ids", "gpu"}
if set(policy) != required:
    raise ValueError("Policy must specify every required field")
report_bytes = Path(report_path).read_bytes()
report = json.loads(report_bytes)
nonce = bytes.fromhex(nonce_hex)
if len(nonce) != 32:
    raise ValueError("Expected the original 32-byte challenge")

with tempfile.TemporaryDirectory() as directory:
    (Path(directory) / "attestation.json").write_bytes(report_bytes)
    result = subprocess.run([
        "docker", "run", "--rm", "--mount",
        f"type=bind,src={directory},dst=/evidence", IMAGE,
        "--verify", "/evidence/attestation.json",
    ], check=True, capture_output=True, text=True)
    verified = json.loads(result.stdout)

details = verified["details"]
if verified["is_valid"] is not True or any(details.get(field) is not True
        for field in ("quote_verified", "event_log_verified", "os_image_hash_verified")):
    raise ValueError("Hardware, application identity, or OS binding failed")
if details["report_data"] != (nonce + bytes(32)).hex():
    raise ValueError("Challenge mismatch")
if details["tee_variant"] != policy["tee_variant"]:
    raise ValueError("Unexpected TEE platform")
if details["tcb_status"] not in policy["accepted_tcb_statuses"]:
    raise ValueError("Unaccepted TCB status")
if not set(details["advisory_ids"]).issubset(policy["allowed_advisory_ids"]):
    raise ValueError("Unaccepted security advisory")
for field in ("app_id", "compose_hash", "os_image_hash"):
    if details["app_info"][field] != policy[field]:
        raise ValueError(f"Unexpected {field}")
if details["key_provider"] != policy["key_provider"]:
    raise ValueError("Unexpected key provider")
if policy["gpu"] is not None:
    gpu = policy["gpu"]
    if set(gpu) != {"devices", "policy_hash"}:
        raise ValueError("GPU policy must specify devices and policy_hash")
    if type(gpu["devices"]) is not int or gpu["devices"] < 1:
        raise ValueError("Expected a positive GPU count")
    expected_policy_hash = bytes.fromhex(gpu["policy_hash"])
    if len(expected_policy_hash) != 32:
        raise ValueError("Expected a SHA-256 GPU policy digest")
    if details["tee_variant"] != "dstack-tdx" or "attestation" in report:
        raise ValueError("GPU event checks require a raw dstack TDX GetQuote response")
    events = json.loads(report["event_log"])
    runtime = [e for e in events if e["imr"] == 3]
    def unique(name):
        matches = [(i, e) for i, e in enumerate(runtime) if e["event"] == name]
        if len(matches) != 1:
            raise ValueError(f"Expected exactly one {name} event")
        index, event = matches[0]
        if event["event_type"] != 0x08000001:
            raise ValueError("Unexpected runtime event type")
        return index, bytes.fromhex(event["event_payload"])
    compose_index, _ = unique("compose-hash")
    policy_index, policy_bytes = unique("gpu-policy-hash")
    appraisal_index, appraisal_bytes = unique("gpu-attestation")
    ready_index, _ = unique("system-ready")
    if not compose_index < policy_index < appraisal_index < ready_index:
        raise ValueError("Unexpected GPU boot event order")
    if any(e["event"] != "init-script-hash"
           for e in runtime[compose_index + 1:policy_index]):
        raise ValueError("GPU policy must follow compose and init-script measurements")
    if policy_bytes != expected_policy_hash:
        raise ValueError("Unexpected GPU policy digest")
    appraisal = json.loads(appraisal_bytes)
    expected = {"version": 3, "provider": "nvidia", "devices": gpu["devices"],
                "cc_mode": "on", "devtools": False, "dbgstat": "disabled", "secboot": True}
    if any(type(appraisal.get(k)) is not type(v) or appraisal[k] != v
           for k, v in expected.items()):
        raise ValueError("GPU count or production security state mismatch")
    print("TDX GPU BOOT VERIFIED against the approved image and deployment policy")
else:
    print("CVM IDENTITY VERIFIED against the approved image and deployment policy")
```

Run on the verifying machine, using the original challenge:

```bash
python3 verify-cvm.py cvm-attestation.json approved-policy.json "$NONCE"
```

A successful run with `gpu: null` prints `CVM IDENTITY VERIFIED against the approved image and deployment policy`. Signature, measurement, nonce, image, application, key-provider, TCB, or advisory failures exit unsuccessfully. This profile authenticates CVM identity; it does not check GPU boot events or a serving connection.

### Verify a TDX GPU boot

For a dstack TDX GPU deployment using the version 3 GPU event contract above, use the same script with a fresh `/GetQuote` response. This TDX-specific endpoint exposes the event log for policy checks. The maintained verifier authenticates the quote, event-log replay, and OS image before the script checks the measured GPU events. Other platforms continue to use `/v1/Attest` for their CPU identity checks.

Approve the guest image and exact application configuration independently. Require GPU attestation, production security settings, and your expected device count. For example, a one-GPU deployment can include this fragment in its dstack `app_compose.json` (not `docker-compose.yml`):

```json
{
  "requirements": {
    "gpu_policy": {
      "attest_gpu": true,
      "allow_devtools": false,
      "allow_debug": false,
      "allow_insecure_boot": false,
      "rego": "package policy\ndefault nv_match = false\nnv_match { count(input) == 1 }\n"
    }
  }
}
```

The Rego rule also rejects an empty GPU inventory. Set the count for your deployment before approving its compose hash. On the verifying machine, compute the GPU policy digest from the reviewed `app_compose.json`, using the RFC 8785 canonicalization library:

```bash
python3 -m pip install rfc8785
```

```python
import hashlib
import json
from pathlib import Path
import rfc8785

compose = json.loads(Path("app_compose.json").read_text())
policy_bytes = rfc8785.dumps(compose["requirements"]["gpu_policy"])
print(hashlib.sha256(policy_bytes).hexdigest())
```

Preserve this independently approved `policy_hash` alongside the OS and compose hashes; do not copy it from the report under test.

Copy `approved-policy.json` to `approved-gpu-policy.json`, keep its independently approved identity fields, and replace `gpu: null` with:

```json
{
  "devices": 1,
  "policy_hash": "<approved 64-character hex GPU policy digest>"
}
```

Generate a new `NONCE` on the verifying machine. Inside the TDX GPU CVM, collect evidence using that challenge:

```bash
NONCE="<challenge from your verifying machine>"
curl --fail-with-body --unix-socket /var/run/dstack.sock \
  http://dstack/GetQuote \
  -H 'Content-Type: application/json' \
  -d "{\"report_data\":\"$NONCE\"}" \
  -o gpu-cvm-quote.json
```

Copy `gpu-cvm-quote.json` back to the verifying machine and run:

```bash
python3 verify-cvm.py gpu-cvm-quote.json approved-gpu-policy.json "$NONCE"
```

A successful run prints `TDX GPU BOOT VERIFIED against the approved image and deployment policy`. It requires a single measured GPU policy and appraisal before `system-ready`, the approved policy digest, expected device count, and production security state. This verifies the recorded boot checks. For independent NVIDIA appraisal, use the optional evidence retrieval procedure above. A network client must separately bind its serving connection to the approved workload before sending secrets.

On SNP, the CVM profile verifies the signed CPU report, image, and approved configuration, including a GPU policy that rejects missing GPUs. The local GPU boot check still applies, but SNP has no quote-bound runtime GPU appraisal in this release. The TDX GPU profile deliberately rejects SNP evidence rather than reporting equivalent GPU boot evidence.

For hosted Private AI connection and response-receipt verification, follow the [PAP guide](https://phala.com/confidential-ai-models/verification). For a custom CVM application's signed outputs, also verify its key binding and signature as described in this guide.
