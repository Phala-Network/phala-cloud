---
name: cloud-migration
description: |
  Migrate a confidential workload from AWS Nitro Enclaves, GCP
  Confidential VMs, or Tinfoil to Phala Cloud. Use when users have an
  existing TEE workload elsewhere and want to move it — covers auth,
  compose adaptation, attestation diff, and cutover.
---

# Migrate to Phala Cloud

Port a confidential workload to Phala from another TEE provider.

## Operations

| User says | Operation |
|---|---|
| "migrate from AWS Nitro" | **From AWS Nitro** |
| "migrate from GCP CC VM" | **From GCP** |
| "migrate from Tinfoil" | **From Tinfoil** |
| "general migration", "where to start" | **Diff Map** |
| "cutover", "DNS switch" | **Cutover** |

This skill builds on `phala-cli/SKILL.md`. Install + login per that skill first.

---

## Diff Map

| Concern | AWS Nitro Enclaves | GCP Confidential VM | Tinfoil | Phala Cloud |
|---|---|---|---|---|
| Hardware TEE | AWS Nitro hypervisor | AMD SEV-SNP / Intel TDX | TDX (managed) | Intel TDX + NVIDIA NV-CSE (GPU) |
| Container model | EIF (Enclave Image Format) | Standard VM, you bring TEE-aware images | Custom AMI | Standard `docker-compose.yml` |
| Auth | IAM roles + KMS | gcloud + IAM | proprietary CLI | `phala login` (device flow) |
| Deploy | `nitro-cli build-enclave` + `run-enclave` | `gcloud compute instances create --confidential-compute` | proprietary | `phala deploy -c docker-compose.yml` |
| Secrets | KMS + parent instance | Cloud KMS | proprietary | `phala deploy -e .env --kms phala` (sealed to compose-hash) |
| Attestation | NSM PCRs (PCR0/1/2) | `vTPM` quote | proprietary | TDX quote + on-chain registry |
| Verify offline | AWS-signed PCRs | GCP attestation library | trust the provider | DCAP → Intel root + `DstackApp.sol` (anyone can verify) |
| GPU TEE | not natively | not yet (preview) | yes (limited) | yes (H200 today, more SKUs coming) |
| Multi-party | bilateral DPAs | Confidential Space (workload identity) | n/a | multi-sig DstackApp + on-chain compose-hash |

The biggest deltas:
1. **Compose vs custom image format** — dstack runs vanilla Docker Compose; no need to build an EIF or AMI.
2. **Sealed env vars** — Phala's `--kms phala` flag seals env to the compose-hash automatically.
3. **Verifiable offline** — Phala attestation chains to Intel/NVIDIA roots + on-chain registry; no need to trust the provider.

---

## From AWS Nitro

### Step 1: Convert EIF → Docker Compose

Nitro EIFs are typically built from a `Dockerfile` already. Reuse the same Dockerfile, package as a compose service:

```yaml
# was: nitro-cli build-enclave --docker-uri myapp:latest
# becomes:
services:
  app:
    image: myapp:latest
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - /var/run/dstack.sock:/var/run/dstack.sock
    environment:
      - YOUR_VARS=${YOUR_VARS}
```

### Step 2: Migrate KMS

AWS KMS calls go to your provider's KMS. With Phala:

```python
# was: boto3.client('kms').decrypt(CiphertextBlob=blob)
# becomes (inside the CVM):
from dstack_sdk import DstackClient
client = DstackClient()                                  # /var/run/dstack.sock
key = client.get_key("aws-migration", compose_hash).decode_key()
plaintext = AESGCM(key).decrypt(nonce, ct, None)
```

The key is derived only after attestation passes — equivalent guarantee to KMS gating, but on-chain auditable.

### Step 3: Migrate attestation verification

```diff
- # AWS NSM PCR verification
- nsm-cli describe-pcr --index 0
- # client checks PCR0 == expected_hash
+ # Phala attestation
+ phala cvms attestation my-app --json > attestation.json
+ # client checks: TDX quote → Intel root, mrtd matches expected, app_id matches
```

### Step 4: Deploy to Phala

```bash
phala login
phala deploy -n my-app -c docker-compose.yml -e .env --kms phala --wait
phala cvms attestation my-app --json
```

### Step 5: Update client code

Clients that previously verified Nitro PCRs now verify Phala attestation. Follow `verify-attestation.md` for the full flow (Intel TDX root + NVIDIA NRAS + report-data binding + compose-hash). Reference implementation: [`Phala-Network/private-ml-sdk/vllm-proxy/verifiers/attestation_verifier.py`](https://github.com/Phala-Network/private-ml-sdk/blob/main/vllm-proxy/verifiers/attestation_verifier.py).

---

## From GCP

### Step 1: Compose

GCP Confidential VMs run regular VM images. Your TEE-aware service runs as a systemd unit or a Docker container. Move it to a compose:

```yaml
services:
  app:
    image: gcr.io/<your-project>/<your-image>:tag
    # ... env, volumes, ports as before ...
```

GCR images work as long as they're publicly pullable, or use `DSTACK_DOCKER_USERNAME/PASSWORD` for private GCR.

### Step 2: Migrate Cloud KMS calls

Replace `gcloud kms decrypt` calls with `dstack-sdk` key derivation (see AWS section above).

### Step 3: Migrate vTPM attestation

GCP exposes a vTPM quote via `go-attestation`. Phala provides a TDX quote via `phala cvms attestation`. Both chain to a hardware root; the verification API differs:

```diff
- # GCP go-attestation
- attest.NewClient(...).Attest(...)
+ # Phala
+ phala cvms attestation my-app --json
```

### Step 4: Deploy

```bash
phala login
phala deploy -n my-app -c docker-compose.yml -e .env --kms phala --wait
```

For GPU workloads (which GCP doesn't yet support in CC mode), use `-t h200.small`.

---

## From Tinfoil

Tinfoil is closest in spirit to Phala — managed TDX, OpenAI-compatible inference for some flows. Migration is mostly endpoint swap + (optionally) self-deploy.

### Inference users

If you're calling Tinfoil's API:

```diff
- base_url = "https://inference.tinfoil.sh/v1"
+ base_url = "https://api.redpill.ai/v1"
```

Model names may differ — check `https://redpill.ai/models`.

### Custom-deploy users

If you're running a custom container on Tinfoil:

```bash
# was: tinfoil deploy --image myimage:tag
# becomes:
phala deploy -n my-app -c docker-compose.yml --kms phala --wait
```

The compose flow is more flexible than Tinfoil's single-image model — multi-service apps, sealed env, GPU TEE all work natively.

---

## Cutover

A safe cutover keeps both providers running until verification is solid.

### Step 1: Deploy to Phala in parallel

```bash
phala deploy -n my-app-phala -c docker-compose.yml -e .env --kms phala --wait
PHALA_URL=$(phala cvms get my-app-phala --json | jq -r '.endpoints[0]')
```

### Step 2: Shadow traffic

Send 1-5% of production traffic to Phala. Compare:
- Latency (Phala TDX overhead is ~3-5%, GPU CC ~5-7%)
- Output equivalence (same model, same input → same output)
- Attestation availability (`/_phala/attestation` should respond on every request)

### Step 3: Increase traffic gradually

10% → 50% → 100% over a week. Monitor your metrics.

### Step 4: Decommission

Once 100% on Phala for a stable period:

```bash
# AWS
nitro-cli terminate-enclave --enclave-id <id>

# GCP
gcloud compute instances delete <vm>

# Tinfoil
tinfoil delete <app>
```

### Step 5: Update DNS

Point your customer-facing DNS to the Phala endpoint. Real format is
`<app_id>-<port>.<gateway_base_domain>` — pull it live from the CVM JSON:

```bash
phala cvms get my-app-phala --json | jq -r '.endpoints[0].app'
# e.g. https://e029a4b8...-8080.dstack-pha-prod5.phala.network
```

```
api.example.com.  CNAME  e029a4b8...-8080.dstack-pha-prod5.phala.network.
```

`dstack-gateway` can also bind a custom domain via the dashboard so the URL
doesn't expose the app_id.

---

## Common gotchas

| Provider | Gotcha | Mitigation |
|---|---|---|
| AWS Nitro | App was using parent-instance file system | Move to a Docker volume (Phala persists volumes by default) |
| AWS Nitro | Used IMDS for IAM creds | Switch to sealed env vars via `phala deploy -e` |
| GCP | Hardcoded `metadata.google.internal` | Replace with sealed env or `dstack-gateway`-routed config |
| Tinfoil | Tinfoil-specific signing extensions | Replace with Phala's Sign-RPC (or generic JWT signed by per-app key) |
| All | Outbound network was unrestricted | Phala routes egress via `dstack-gateway` — check allowlist for your destination domains |

---

## Reference: typical migration

```bash
# 1. Audit your existing workload
#    - what TEE primitive (PCR / vTPM / proprietary)?
#    - what KMS calls?
#    - what is your verification flow?

# 2. Adapt to Phala primitives
#    - compose file from your existing Dockerfile
#    - .env with secrets you used to fetch from KMS
#    - swap attestation library to dstack-verifier

# 3. Deploy in shadow
phala login
phala deploy -n my-app -c docker-compose.yml -e .env --kms phala --wait

# 4. Verify equivalence
phala cvms attestation my-app --json
# A/B test endpoints

# 5. Cutover
# DNS swap, decommission old enclave/VM
```

For provider-specific deep dives, see the comparison pages on `https://phala.com/compare/`.
