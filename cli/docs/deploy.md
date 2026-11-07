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
| `--wait` | false | Wait for the deployment to finish and fail if it failed. New CVM: wait until it is running. Update (`--cvm-id`): wait until the CVM is running again, or stays stopped if it was not running before the update |
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
| `--node <name>` | | Deploy to specific physical node name |
| `--custom-app-id <id>` | | Use custom App ID (requires --nonce for PHALA KMS) |
| `--nonce <nonce>` | | Nonce for deterministic app_id generation |
| `--pre-launch-script <path>` | | Path to pre-launch script. An empty file is treated as unspecified and keeps the Phala Cloud default |
| `--no-pre-launch-script` | false | Deploy without any pre-launch script (do not use the Phala Cloud default); cannot be combined with `--pre-launch-script` |
| `--private-key <key>` | | Private key for on-chain KMS (ethereum/base) |
| `--rpc-url <url>` | | RPC URL for blockchain interaction |
| `--runner <runner>` | docker-compose | App runner: `docker-compose`, `nerdctl-compose` or `bash`. With `bash`, `--compose` is the script to run. `nerdctl-compose` and `bash` need the `compose_advanced` feature |
| `--app-compose <path>` | | Whole app-compose JSON file, sent instead of `--compose` and the compose flags. Needs the `compose_advanced` feature |
| `--init-script <slug>` | | Platform init script to run on every boot: `docker_cleanup` or `env_merge`. Repeatable. On update, replaces the current set |
| `--launch-token <token>` | | Launch token (at least 32 bytes) the CVM must boot with |
| `--generate-launch-token` | false | Gate the CVM with a launch token Phala Cloud generates for a new app (printed once), or with the app's existing token |
| `--clear-init-scripts` | false | Update only: remove every platform init script; cannot be combined with `--init-script` |
| `--launch-token-hash <hash>` | | Update only: set `requirements.launch_token_hash` to the hash printed by `phala apps launch-token set`; `""` removes it |
| `--event-log-version <1\|2>` | | Event log digest format (dstack OS 0.6.0+) |
| `--ephemeral-data-disk` | | Format the data disk on every boot (dstack OS 0.6.3+); `--no-ephemeral-data-disk` sets it to false |
| `--gateway` / `--no-gateway` | true | Route the CVM through the gateway |
| `--confirm-data-wipe` | false | Confirm an update that turns on `docker_cleanup` or `--ephemeral-data-disk`, which erase data on every boot |
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

## Updating an existing CVM

With `--cvm-id` (or a CVM ID in `phala.toml`), deploy sends the compose file and these flags to the CVM update:

- `--instance-type`, `--vcpu`, `--memory`, `--disk-size`, `--image`
- `--public-logs`, `--public-sysinfo`, `--public-tcbinfo` and their `--no-` forms
- `--pre-launch-script`, `--no-pre-launch-script`, `-e`, `--force-stop`, `--prepare-only`
- `--secure-time`, `--gateway` / `--no-gateway`, `--event-log-version`, `--ephemeral-data-disk` / `--no-ephemeral-data-disk` (sent as a compose merge patch)
- `--init-script` (replaces the CVM's init scripts), `--clear-init-scripts` (removes them all) and `--confirm-data-wipe`
- `--launch-token-hash` (must be the hash of the app's launch token; `""` removes it)

Turning on `docker_cleanup` or `--ephemeral-data-disk` erases data on every boot, so the update needs `--confirm-data-wipe`. Turning the gateway off removes the CVM from the gateway after the update.

A flag you leave out keeps the CVM's current value. In particular, an update without `--pre-launch-script` or `--no-pre-launch-script` keeps the CVM's current pre-launch script; it does not switch to the Phala Cloud default.

`--listed` / `--no-listed` changes the Trust Center listing through its own request, sent only after the update is accepted (or, for on-chain KMS, after it is confirmed or committed with `--commit`). It is not sent with `--prepare-only`. The listing applies to the whole app, and its endpoint needs an API key or a login session: GitHub Actions OIDC tokens are not accepted for it.

These flags set how a CVM is created and cannot be changed afterwards: `--name`, `--region`, `--node`, `--custom-app-id`, `--nonce`, `--key-provider-mode`, `--dev-os` / `--no-dev-os`, `--ssh-pubkey`, `--fs`, `--skip-gateway`, `--kms`, `--kms-id`, `--kms-contract`, `--kms-contract-id`, `--experimental-key-provider-type`, `--runner`, `--app-compose`, `--launch-token` and `--generate-launch-token`. An update that passes any of them fails before any request is sent.

## Raw app compose

`--app-compose <path>` sends a whole app-compose JSON file. Phala Cloud parses it with the same rules as a compose built from flags, so the deployed bytes and compose hash follow its canonical form, not the file's bytes. The compose flags (`--compose`, `--runner`, `--pre-launch-script`, `--no-pre-launch-script`, `--fs`, `--secure-time`, `--public-*`, `--event-log-version`, `--ephemeral-data-disk`, `--gateway`, `--experimental-key-provider-type`) cannot be combined with it; set those fields in the file. `-e` still encrypts the env values; their keys must be in the file's `allowed_envs`.

## Launch token

`--launch-token` or `--generate-launch-token` makes the guest check the app's launch token on every boot before it gets its keys. A generated token is printed once, after the CVM is created; store it. Phala Cloud and the node operator can read the token, so it only protects against parties who know the public compose. To rotate or clear an app's token, see `phala apps launch-token` in [apps](./apps.md).

## Pre-launch script behavior

By default, deploy leaves the pre-launch script field out of the request. When creating a CVM, Phala Cloud then uses its official default script; when updating one, the current script is kept (see [Updating an existing CVM](#updating-an-existing-cvm)). Use `--pre-launch-script <path>` to supply a script. If that file is empty, the field is still omitted: a new CVM gets the default script, and an updated CVM keeps its current script. To explicitly deploy with no pre-launch script, use `--no-pre-launch-script`; it cannot be combined with `--pre-launch-script`.

```bash
$ phala deploy --no-pre-launch-script
```

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
$ phala deploy --node usw5
```

### Deploy with pre-launch script

```bash
$ phala deploy --pre-launch-script ./setup.sh
```

An empty script file keeps the default Phala Cloud script. To explicitly disable all pre-launch scripts instead:

```bash
$ phala deploy --no-pre-launch-script
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
| ERR-2005 | Node not accessible | Node may be offline, try different node or omit `--node` |

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

