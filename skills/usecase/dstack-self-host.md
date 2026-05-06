---
name: dstack-self-host
description: |
  Self-host the dstack control plane on your own bare-metal Intel TDX
  hardware. Use when users need data residency, regulatory boundary
  control, or want to run dstack outside Phala's managed cloud. Covers
  building dstack-vmm / dstack-kms / dstack-gateway from source, using
  the vmm-cli.py app deployer, and choosing an auth server (auth-simple
  vs auth-eth on-chain).
---

# Self-Hosted dstack

Run `dstack-vmm`, `dstack-kms`, and `dstack-gateway` on your own bare-metal Intel TDX hardware. App developers use `vmm-cli.py` to deploy CVMs to your dstack instance.

## Operations

| User says | Operation |
|---|---|
| "self-host dstack", "BYOH", "data residency" | **End-to-End** |
| "dev setup", "try locally" | **Dev Deployment** |
| "production setup" | **Production Deployment** |
| "deploy KMS", "auth-simple", "auth-eth" | **KMS + Auth Server** |
| "deploy Gateway", "TLS termination" | **Gateway** |
| "deploy an app to my dstack", "vmm-cli" | **App Deployment (vmm-cli.py)** |
| "compare to managed Phala" | **Self-host vs Managed** |

> **Source of truth:** all canonical operator commands are in
> [github.com/Dstack-TEE/dstack/docs/deployment.md](https://github.com/Dstack-TEE/dstack/blob/master/docs/deployment.md)
> and the [VMM CLI User Guide](https://github.com/Dstack-TEE/dstack/blob/master/docs/vmm-cli-user-guide.md).
> This skill summarizes them — verify against the current release before
> running anything in production.

> **Heads up:** there is **no `dstack` command-line tool**. Self-hosting
> means running the Rust binaries `dstack-vmm` / `dstack-kms` /
> `dstack-gateway` directly, plus `vmm-cli.py` for app management. This is
> separate from the npm-installed `phala` CLI used against managed Phala
> Cloud.

---

## Self-host vs Managed

| Aspect | Managed (`phala` CLI) | Self-Hosted (`dstack-vmm` + `vmm-cli.py`) |
|---|---|---|
| Hardware | Phala provides H200 + TDX hosts | You provide bare-metal TDX |
| Operator | Phala | You |
| Trust path | Same: TDX quote + on-chain registry | Same: TDX quote + on-chain registry |
| Best for | Most teams. Lower TCO. | Strict data residency, regulatory boundary, providers building their own confidential cloud |
| Open source | Yes (dstack runtime) | Yes (you run the same code) |
| App CLI | `phala deploy` | `./vmm-cli.py deploy` |

The trust model is identical. The only real difference is who operates the hardware.

---

## Hardware Prerequisites

- Bare-metal TDX-capable server (Sapphire Rapids+ Xeon, BIOS TDX enabled). See [canonical/tdx](https://github.com/canonical/tdx) for the host setup.
- ≥16GB RAM, ≥100GB free disk
- Public IPv4 + DNS access
- Optional: NVIDIA H100 or Blackwell for GPU TEE workloads

Verify TDX is active on the host:

```bash
dmesg | grep -i tdx
```

---

## Dev Deployment

For local development / testing only. **No security guarantees** — KMS runs in dev mode.

### Step 1: Install build deps

```bash
# Ubuntu 24.04
sudo apt install -y build-essential chrpath diffstat lz4 wireguard-tools xorriso

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Step 2: Build host config

```bash
git clone https://github.com/Dstack-TEE/meta-dstack.git --recursive
cd meta-dstack/
mkdir build && cd build
../build.sh hostcfg
```

Edit the generated `build-config.sh`:

| Variable | Description |
|---|---|
| `KMS_DOMAIN` | DNS domain for KMS RPC, e.g. `kms.example.com` |
| `GATEWAY_DOMAIN` | DNS domain for Gateway RPC, e.g. `gateway.example.com` |
| `GATEWAY_PUBLIC_DOMAIN` | Public base domain for app routing, e.g. `apps.example.com` |
| `CERTBOT_ENABLED` | `true` (for ACME via Cloudflare) |
| `CF_API_TOKEN` | your Cloudflare API token |

```bash
vim build-config.sh
../build.sh hostcfg
../build.sh dl 0.5.5     # download guest image
```

### Step 3: Run components in separate terminals

```bash
# Terminal 1: KMS
./dstack-kms -c kms.toml

# Terminal 2: Gateway (needs sudo for port 443)
sudo ./dstack-gateway -c gateway.toml

# Terminal 3: VMM
./dstack-vmm -c vmm.toml
```

VMM listens on `http://localhost:8080` by default. App deployers point `vmm-cli.py` at this URL.

---

## Production Deployment

Production runs KMS and Gateway each as their own CVMs, behind an auth server. The summary below tracks the canonical guide; see `docs/deployment.md` for the latest.

### Production checklist

1. Set up TDX host with `dstack-vmm`
2. Deploy KMS as CVM (with auth server; capture its attestation; allowlist its `mrAggregated` before bootstrap)
3. Deploy Gateway as CVM
4. Optional: Zero-Trust HTTPS, CT monitoring, multi-node, on-chain governance

### Step 1: Build dstack-vmm

```bash
git clone https://github.com/Dstack-TEE/dstack
cd dstack
cargo build --release -p dstack-vmm -p supervisor
mkdir -p vmm-data
cp target/release/dstack-vmm vmm-data/
cp target/release/supervisor vmm-data/
cd vmm-data/
```

### Step 2: Configure VMM

Create `vmm.toml`:

```toml
address = "tcp:0.0.0.0:9080"
reuse = true
image_path = "./images"
run_path = "./run/vm"

[cvm]
kms_urls = []
gateway_urls = []
cid_start = 30000
cid_pool_size = 1000

[cvm.port_mapping]
enabled = true
address = "127.0.0.1"
range = [
  { protocol = "tcp", from = 1, to = 20000 },
  { protocol = "udp", from = 1, to = 20000 },
]

[host_api]
address = "vsock:2"
port = 10000
```

Download guest images from [meta-dstack releases](https://github.com/Dstack-TEE/meta-dstack/releases) and extract them to `./images/`. Then start VMM:

```bash
./dstack-vmm -c vmm.toml
```

---

## KMS + Auth Server

Production KMS requires an **auth server** that validates boot requests via webhook. Two stock implementations:

| Auth server | Use case | Config |
|---|---|---|
| `auth-simple` | Config-file whitelisting | JSON config file |
| `auth-eth` | On-chain governance via smart contracts | Ethereum RPC + contract |
| Custom | Your own logic | Implement the webhook interface |

All auth servers expose:
- `GET /` — health
- `POST /bootAuth/app` — app boot authz
- `POST /bootAuth/kms` — KMS boot authz

### auth-simple (config-based)

Create `auth-config.json`:

```json
{
  "osImages": ["0x<os-image-hash>"],
  "kms": {
    "mrAggregated": ["0x<kms-mr-aggregated>"],
    "allowAnyDevice": true
  },
  "apps": {}
}
```

Get the OS image hash:

```bash
tar -xzf dstack-0.5.5.tar.gz
cat dstack-0.5.5/digest.txt
# 0b327bcd642788b0517de3ff46d31ebd3847b6c64ea40bacde268bb9f1c8ec83
# prefix with 0x in the JSON
```

Run auth-simple:

```bash
cd kms/auth-simple
bun install
PORT=3001 AUTH_CONFIG_PATH=/path/to/auth-config.json bun run start
```

> **Important:** an empty `kms.mrAggregated` allowlist is treated as deny-all
> for KMS. Capture the current KMS measurement with `Onboard.GetAttestationInfo`
> and add it before bootstrap, or KMS will refuse to onboard.

### auth-eth (on-chain governance)

Use this for decentralized governance — the allowlist lives in a smart contract instead of a JSON file. See [docs/onchain-governance.md](https://github.com/Dstack-TEE/dstack/blob/master/docs/onchain-governance.md).

### Deploy KMS as CVM

Production KMS runs inside its own CVM, NOT on the host:

```bash
cd dstack/kms/dstack-app/
# Use the deploy script matching your auth server (auth-simple vs auth-eth)
# Capture the KMS attestation info, allowlist its mrAggregated, then bootstrap
```

The exact script and bootstrap dance is version-specific — follow `docs/deployment.md` for the current release.

---

## Gateway

Gateway terminates public TLS and routes traffic to apps. It also runs as a CVM in production.

Gateway config sets:
- Public domain (e.g. `apps.example.com`)
- ACME provider (Let's Encrypt via Cloudflare DNS-01)
- Authorization endpoint (your auth server)

App URLs follow the shape `https://<app_id>-<port>.<gateway_public_domain>` — the same scheme as managed Phala (just with your domain).

---

## App Deployment (vmm-cli.py)

App developers (not operators) use `vmm-cli.py` against your VMM endpoint.

### Install + configure

```bash
# Get the script
curl -O https://raw.githubusercontent.com/Dstack-TEE/dstack/master/vmm-cli.py
chmod +x vmm-cli.py

# Point at your VMM
export DSTACK_VMM_URL=http://your-vmm-host:8080

# (optional) auth
export DSTACK_VMM_AUTH_USER=username
export DSTACK_VMM_AUTH_PASSWORD=password

./vmm-cli.py --help
```

Server URL precedence: CLI `--url` > `DSTACK_VMM_URL` > default `http://localhost:8080`.

### Discover what's available

```bash
./vmm-cli.py lsimage         # available OS images
./vmm-cli.py lsgpu           # available GPU slots
./vmm-cli.py lsvm            # current VMs (basic)
./vmm-cli.py lsvm -v         # detailed (vCPU, memory, image, GPUs)
```

### Deploy an app (two-step)

```bash
# Step 1: build the app-compose.json from your docker-compose
./vmm-cli.py compose \
  --name "my-web-app" \
  --docker-compose ./docker-compose.yml \
  --output ./app-compose.json

# Step 2: deploy to a VM
./vmm-cli.py deploy --app-compose ./app-compose.json [other flags per --help]
```

### VM lifecycle

```bash
./vmm-cli.py start <vm-id>
./vmm-cli.py stop <vm-id>           # graceful
./vmm-cli.py stop -f <vm-id>        # force
./vmm-cli.py logs <vm-id>           # last 20 lines
./vmm-cli.py logs <vm-id> -n 50     # last 50
./vmm-cli.py logs <vm-id> -f        # stream
./vmm-cli.py remove <vm-id>         # permanent — wipes data
```

### KMS key management

```bash
./vmm-cli.py kms list
./vmm-cli.py kms add <key>
./vmm-cli.py kms remove <key>
```

For full reference: [VMM CLI User Guide](https://github.com/Dstack-TEE/dstack/blob/master/docs/vmm-cli-user-guide.md).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `dstack-vmm` won't start | TDX not enabled in BIOS | Reboot, enable TDX, check `dmesg \| grep -i tdx` |
| KMS rejects bootstrap | `mrAggregated` not in allowlist | Capture KMS measurement via `Onboard.GetAttestationInfo`, add to `auth-config.json` |
| Gateway 5xx after first boot | ACME cert not yet issued | Wait 1-3 min on first start (DNS-01 challenge) |
| `vmm-cli.py` connection refused | `DSTACK_VMM_URL` wrong | Confirm VMM listens on `0.0.0.0:8080` (not just `127.0.0.1`) |
| App deploy fails with "image hash not allowlisted" | OS image not in `auth-config.json` | Add the image's `digest.txt` hash with `0x` prefix |

---

## Reference: minimal end-to-end (dev)

```bash
# Operator
git clone https://github.com/Dstack-TEE/meta-dstack.git --recursive
cd meta-dstack && mkdir build && cd build
../build.sh hostcfg
vim build-config.sh        # set domains, CF token
../build.sh hostcfg
../build.sh dl 0.5.5

# Run in separate terminals
./dstack-kms -c kms.toml
sudo ./dstack-gateway -c gateway.toml
./dstack-vmm -c vmm.toml

# App developer (separate machine)
export DSTACK_VMM_URL=http://operator-host:8080
curl -O https://raw.githubusercontent.com/Dstack-TEE/dstack/master/vmm-cli.py
./vmm-cli.py compose --name my-app --docker-compose ./docker-compose.yml --output ./app-compose.json
./vmm-cli.py deploy --app-compose ./app-compose.json
./vmm-cli.py lsvm
```

The same `docker-compose.yml` ships unchanged between managed Phala and self-hosted dstack — the trust path is identical.

For production deployment (KMS as CVM, auth server, on-chain governance), follow [docs/deployment.md](https://github.com/Dstack-TEE/dstack/blob/master/docs/deployment.md) line-by-line — version-specific bootstrap details change between releases.
