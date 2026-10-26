---
name: verify-attestation
description: |
  Verify Phala Cloud CVM attestation, including Intel TDX and AMD SEV-SNP.
  Covers workload identity, OS measurements, application key bindings,
  image provenance, signed outputs, and independent GPU evidence inspection.
---

# Verify TEE Attestation

Use this guide to check a Phala Cloud CVM and the software it booted. For hosted Private AI requests, start with [PAP](inference-call.md#verify-private-inference-with-pap). To reproduce that verification yourself, follow the [ACI procedure](inference-call.md#reproduce-verification-independently).

## Operations

| User says | Operation |
|---|---|
| "is this really in TEE?", "verify the CVM" | **Verify CPU Attestation** |
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

The CLI returns deployment metadata and available certificates. On legacy TDX deployments, `app_certificates[0].quote` is the raw quote. For a fresh check on TDX or SNP, use the guest API below.

---

## Nonce Binding

Generate the challenge on the machine doing verification, then ask the CVM to include it in its attestation. Compare it with the authenticated report data. This prevents an old report from passing as a fresh one.

The example below uses a nonce alone. A client connecting to an application also needs to verify the application's signing or connection key. See [Report-Data Binding](#report-data-binding).

---

## Verify CPU Attestation

The [dstack verifier](https://github.com/Dstack-TEE/dstack/blob/7f143148cc49f4a09799958835d310e050137cb3/dstack/verifier/README.md) checks the hardware signatures and OS measurements on both TDX and SNP. Use Docker to run release 0.6.1 below.

On your verifying machine, generate a challenge:

```bash
openssl rand -hex 32
```

Inside the CVM, paste that value into `NONCE` and collect the attestation:

```bash
NONCE="<challenge from your verifying machine>"
curl --fail-with-body --unix-socket /var/run/dstack.sock \
  http://dstack/v1/Attest \
  -H 'Content-Type: application/json' \
  -d "{\"report_data\":\"$NONCE\"}" \
  -o cvm-attestation.json
```

Copy `cvm-attestation.json` back to your verifying machine. Run the verifier from the directory containing that file:

```bash
VERIFIER_IMAGE=ghcr.io/dstack-tee/dstack-verifier@sha256:9f2c07a94efd3d8a1a89268e5faa35e91e3cb345b9c4ab859c86d35142f4f788
docker run --rm \
  --mount "type=bind,src=$PWD,dst=/evidence" \
  "$VERIFIER_IMAGE" --verify /evidence/cvm-attestation.json \
  > verification.json
```

The command exits with an error when cryptographic verification fails. On success, `verification.json` contains `is_valid: true` and the authenticated deployment fields under `details`.

That result establishes which deployment produced the report. To decide whether to trust it, compare these fields with the release you approved:

| Field under `details` | Expected value |
|---|---|
| `report_data` | Your original 32-byte nonce, hex-encoded, followed by 64 zero characters |
| `app_info.os_image_hash` | The approved dstack OS image hash |
| `app_info.compose_hash` | SHA-256 of the reviewed `app_compose.json` bytes |
| `app_info.app_id` | Your application ID |
| `key_provider` | The expected key-provider name and identity |
| `tee_variant` | The platform you intended to use, such as `dstack-tdx` or `dstack-amd-sev-snp` |
| `tcb_status`, `advisory_ids` | Acceptable platform status and advisories; a strict policy requires `UpToDate` with no advisories |

Get the expected release values independently of the report. `is_valid` does not apply your release allowlist or TCB policy. The maintained verifier's [output reference](https://github.com/Dstack-TEE/dstack/blob/7f143148cc49f4a09799958835d310e050137cb3/dstack/verifier/README.md#identifying-the-deployment) explains these fields.

For independently reproducing the hardware checks, the [TDX implementation](https://github.com/Phala-Network/dcap-qvl) and [SNP implementation](https://github.com/Dstack-TEE/dstack/tree/7f143148cc49f4a09799958835d310e050137cb3/dstack/sev-snp-qvl) show the platform-specific verification. The TDX examples below cover raw quotes.

## Verify Intel TDX

You can submit a raw TDX quote to Phala’s verifier or verify it locally with DCAP.

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

For local verification, install [`dcap-qvl`](https://github.com/Phala-Network/dcap-qvl):

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

Verify the OS image against the authenticated boot measurements and your approved release. The [dstack verifier above](#verify-cpu-attestation) checks this on both TDX and SNP. The manual register comparison below is specific to TDX.

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

Verify the exact `app_compose.json` hash against your approved configuration. Dstack binds this identity through the CPU attestation: TDX uses its measured identity fields; SNP uses MrConfigV3 bound by `HOST_DATA`. Compare the verifier’s `details.app_info.compose_hash` with the hash of your reviewed `app_compose.json`:

```bash
sha256sum app_compose.json
```

Review the configuration before approving its hash. Pin the container images by digest so a registry tag update cannot change what runs.

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

## Verify NVIDIA GPU

dstack's standard GPU policy checks GPU attestation and Confidential Computing mode during boot, before starting the application and provisioning workload keys. A failed check stops boot. When you approve a GPU deployment, check that its dstack image implements this gate and its configuration keeps GPU attestation enabled with production security settings.

This enforced sequence is what protects the handoff to the GPU. Collecting a valid CPU quote and a valid GPU quote on their own does not establish it. Local `nvidia-smi` output is useful for troubleshooting, but it is not remote attestation.

### GPU boot gate

On TDX, the measured event log binds the GPU policy and boot appraisal to the CPU quote. After verifying the quote and replaying RTMR3, check that `gpu-policy-hash` matches the policy you approved and that a single `gpu-attestation` event appears before `system-ready`. Its device count and security state must match the deployment. To authenticate supplied boot-time evidence, compare the event's `evidence_sha256` with the SHA-256 of the exact decoded evidence bytes.

The [dstack GPU security model](https://github.com/Dstack-TEE/dstack/blob/250334c26a97a579fe26d911d89e8e90256d8572/docs/security/security-model.md#gpu-security-for-ai-workloads) specifies the event ordering and policy digest, including device-count requirements. The verifier command above authenticates CPU evidence; it does not perform these GPU-specific policy checks.

On SNP, `HOST_DATA` binds the launch configuration, including `gpu_policy_hash` when present. The local GPU boot check still runs, but SNP has no equivalent quote-bound runtime GPU appraisal in this release. A boot record also describes startup, not continuous device identity or physical co-location.

### Independent GPU evidence inspection

Use NVIDIA's [`nvattest` CLI](https://docs.nvidia.com/attestation/nv-attestation-sdk-cpp/latest/sdk-cli/introduction.html) to appraise GPU evidence yourself. The commands below collect the saved boot record or fresh evidence for your own challenge. Independent NVIDIA appraisal supplements the CPU boot-chain verification above.

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

Install `nvattest` on the verifying machine using NVIDIA’s instructions. A successful appraisal exits normally with `result_code: 0`; check the returned claims against your GPU policy. The [command reference](https://docs.nvidia.com/attestation/nv-attestation-sdk-cpp/latest/sdk-cli/command-reference.html#attest) covers `--relying-party-policy` and NRAS-backed appraisal. Keep the nonce with the evidence. This fresh sample shows that a genuine GPU answered the challenge, but does not establish its binding to the CVM’s boot chain.

Run `python3 extract-gpu-evidence.py boot` to save the boot record as `gpu-boot-record.json`. On TDX, authenticate those exact bytes through the CPU quote and measured event log before inspecting its claims. SNP does not provide that runtime binding. The boot record contains an earlier appraisal; use the fresh evidence file as input to `nvattest attest`.

---

## Offline Verification

If you can't reach Phala's verify endpoint or NRAS:

| Step | Offline tool |
|---|---|
| Verify Intel TDX quote (TDX only) | [`dcap-qvl`](https://github.com/Phala-Network/dcap-qvl) — chains to Intel PCS root |
| Independently inspect NVIDIA GPU evidence (optional) | [`nvattest`](https://docs.nvidia.com/attestation/nv-attestation-sdk-cpp/latest/sdk-cli/command-reference.html#attest) with local verification and the required cached collateral |
| Verify AMD SEV-SNP report | Maintained dstack verifier with AMD collateral and the SNP launch measurement material |
| Verify OS image hash | Compare against `digest.txt` from [meta-dstack release tarball](https://github.com/Dstack-TEE/meta-dstack/releases) |
| Verify compose-hash | sha256 the app_compose JSON locally; check against `mr_config` byte for byte |
| Verify Sigstore record | `cosign verify --certificate-identity-regexp '...' --certificate-oidc-issuer 'https://token.actions.githubusercontent.com' <image>` |

Cache vendor collateral and release artifacts before going offline. See the [dstack verifier](https://github.com/Dstack-TEE/dstack/blob/7f143148cc49f4a09799958835d310e050137cb3/dstack/verifier/README.md) for its collateral settings and NVIDIA’s instructions for local appraisal.
