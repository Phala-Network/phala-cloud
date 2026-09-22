# phala deploy

Deploy a new CVM or update an existing one.

## Usage

```bash
phala deploy [options]
```

Creates a new CVM by default. If `--cvm-id` is provided or `phala.toml` contains a CVM ID, updates the existing CVM instead.

## Basic Options

| Flag | Default | Description |
|------|---------|-------------|
| `-n, --name <name>` | directory name | CVM name |
| `-c, --compose <path>` | docker-compose.yml | Docker Compose file path |
| `-t, --instance-type <type>` | auto-selected | Instance type (e.g., tdx.small, tdx.medium) |
| `-r, --region <region>` | auto-selected | Preferred region (e.g., us-west, eu-central) |
| `-e, --env <value>` | | Environment variable (KEY=VALUE) or path to .env file. Repeatable |
| `--kms <type>` | phala | KMS type: phala, ethereum/eth, or base |
| `--wait` | false | Wait for deployment/update to complete |
| `--dev-os` | false | Use development OS image (requires SSH key) |
| `--public-logs` | true | Make CVM logs publicly accessible |
| `--no-public-logs` | | Disable public log access |
| `--public-sysinfo` | true | Make CVM system info publicly accessible |
| `--no-public-sysinfo` | | Disable public system info access |
| `--listed` | false | List CVM on Phala Trust Center |
| `--no-listed` | | Don't list CVM on Trust Center |

## Advanced Options

| Flag | Default | Description |
|------|---------|-------------|
| `--cvm-id <id>` | | CVM ID for updating existing deployment |
| `--disk-size <size>` | 20G | Disk size with unit (e.g., 50G, 100G) |
| `--image <image>` | latest | OS image version |
| `--node-id <id>` | | Deploy to specific node ID |
| `--custom-app-id <id>` | | Use custom App ID (requires --nonce for PHALA KMS) |
| `--nonce <nonce>` | | Nonce for deterministic app_id generation |
| `--pre-launch-script <path>` | | Path to pre-launch script |
| `--private-key <key>` | | Private key for on-chain KMS (ethereum/base) |
| `--rpc-url <url>` | | RPC URL for blockchain interaction |
| `--debug` | false | Enable debug logging |

## Deprecated Options

The following options are deprecated and will be removed in future versions:

- `--vcpu <count>` - Use `--instance-type` instead
- `--memory <size>` - Use `--instance-type` instead
- `--env-file <path>` - Use `-e <path>` instead
- `--kms-id <id>` - Use `--custom-app-id` instead
- `--uuid <uuid>` - Use `--custom-app-id` instead
- `--ssh-pubkey <path>` - Register the key with `phala ssh-keys add` and manage per-CVM access with `phala ssh-keys grant`. Provision already authorizes all of your account keys by default.

`--ssh-pubkey` still injects `DSTACK_AUTHORIZED_KEYS` into the encrypted env. That path only works when the CVM compose includes the platform pre-launch script, and it has no effect on images that do not ship an SSH server.

## Examples

### Simplest deployment (auto-select everything)

```bash
$ phala deploy
Analyzing docker-compose.yml...
Selected instance type: tdx.small
Selected region: us-west
Deploying CVM...
✓ CVM deployed successfully
App ID: app_abc123
URL: https://app_abc123.phala.cloud
```

### Specify instance type and region

```bash
$ phala deploy -t tdx.medium -r us-west
```

### Deploy with environment variables

```bash
$ phala deploy -e DATABASE_URL=postgres://... -e API_KEY=secret
```

### Deploy with .env file

```bash
$ phala deploy -e .env
```

### Deploy and wait for completion

```bash
$ phala deploy --wait
Deploying CVM...
Waiting for CVM to start...
✓ CVM is running
✓ All containers are healthy
```

### Update existing CVM

```bash
$ phala deploy --cvm-id app_abc123 --wait
Updating CVM app_abc123...
✓ CVM updated successfully
```

### Deploy with custom name

```bash
$ phala deploy -n my-production-app
```

### Deploy with larger disk

```bash
$ phala deploy --disk-size 100G
```

### Deploy with dev OS image and SSH access

```bash
$ phala deploy --dev-os --ssh-pubkey ~/.ssh/id_ed25519.pub
```

### Deploy with Ethereum KMS

```bash
$ phala deploy --kms ethereum \
  --private-key 0x1234... \
  --rpc-url https://eth-mainnet.g.alchemy.com/v2/...
```

### Deploy with Base KMS

```bash
$ phala deploy --kms base \
  --private-key 0x1234... \
  --rpc-url https://base-mainnet.g.alchemy.com/v2/...
```

### Deploy with custom App ID

```bash
$ phala deploy --custom-app-id app_custom123 --nonce 42
```

### Deploy to specific node

```bash
$ phala deploy --node-id node_xyz789
```

### Deploy with pre-launch script

```bash
$ phala deploy --pre-launch-script ./setup.sh
```

### Deploy unlisted CVM (private)

```bash
$ phala deploy --no-listed --no-public-logs --no-public-sysinfo
```

## Error Codes

Common deployment errors:

| Code | Description | Solution |
|------|-------------|----------|
| ERR-1001 | Instance type not found | Check available types with `phala instance-types` |
| ERR-1002 | No available resources match requirements | Try different instance type or region |
| ERR-1003 | Insufficient CPU capacity | Reduce CPU requirements or try different region |
| ERR-1004 | Insufficient memory | Reduce memory requirements or try different region |
| ERR-2003 | OS image not available | Use `--image` to specify valid image version |
| ERR-2005 | Node not accessible | Node may be offline, try different node or omit `--node-id` |

## Instance Types

Common instance types:

- `tdx.small` - 2 vCPU, 4GB RAM
- `tdx.medium` - 4 vCPU, 8GB RAM
- `tdx.large` - 8 vCPU, 16GB RAM
- `tdx.xlarge` - 16 vCPU, 32GB RAM

See all types: `phala instance-types`

## Regions

Available regions:

- `us-west` - US West Coast
- `us-east` - US East Coast
- `eu-central` - Central Europe
- `ap-southeast` - Southeast Asia

## KMS Types

### Phala KMS (Default)

Managed by Phala Cloud:

```bash
$ phala deploy --kms phala
```

### Ethereum KMS

Use Ethereum wallet for key management:

```bash
$ phala deploy --kms ethereum \
  --private-key 0x... \
  --rpc-url https://eth-mainnet.g.alchemy.com/v2/...
```

### Base KMS

Use Base network wallet:

```bash
$ phala deploy --kms base \
  --private-key 0x... \
  --rpc-url https://base-mainnet.g.alchemy.com/v2/...
```

