# Command Reference

Complete reference for all `phala` CLI commands, grouped by category.

## Authentication

### phala login

    phala login [api-key] [options]

Authenticate with Phala Cloud. Without an API key, opens browser for device flow.

| Flag | Description |
|------|-------------|
| `--manual` | Enter API key manually |
| `--no-open` | Skip browser launch |
| `--profile <name>` | Profile name (defaults to workspace slug) |
| `--print-token` | Print token to stdout without saving |
| `--url <url>` | Custom API endpoint URL |

### phala logout

    phala logout

Remove stored API key for the active profile.

### phala status

    phala status [options]

| Flag | Description |
|------|-------------|
| `-j, --json` | JSON output |
| `-d, --debug` | Debug output |
| `--api-token <token>` | Override API token |

### phala whoami

    phala whoami [options]

| Flag | Description |
|------|-------------|
| `-j, --json` | JSON output |
| `--api-token <token>` | Override API token |

### phala profiles

    phala profiles

List all auth profiles with active indicator.

### phala switch

    phala switch <profile-name>

Switch active auth profile. Shows interactive picker if profile-name is omitted.

## Deployment

### phala deploy

    phala deploy [options]

Deploy new CVM or update existing one.

**Basic options:**

| Flag | Default | Description |
|------|---------|-------------|
| `-n, --name <name>` | dir name | CVM name |
| `-c, --compose <file>` | docker-compose.yml | Docker Compose file |
| `-t, --instance-type <type>` | auto | Instance type (tdx.small, tdx.medium, etc.) |
| `-r, --region <region>` | auto | Preferred region |
| `-e, --env <env>` | | Env var KEY=VALUE or file path (repeatable) |
| `--kms <type>` | phala | KMS type: phala, ethereum/eth, base |
| `--wait` | false | Wait for completion |
| `--ssh-pubkey <path>` | ~/.ssh/id_rsa.pub | SSH public key |
| `--dev-os` | false | Use dev OS image |
| `--public-logs` | true | Public container logs |
| `--no-public-logs` | | Disable public logs |
| `--public-sysinfo` | true | Public system info |
| `--no-public-sysinfo` | | Disable public sysinfo |
| `--listed` | false | List on Trust Center |
| `--no-listed` | | Disable listing |

**Advanced options:**

| Flag | Description |
|------|-------------|
| `--cvm-id <id>` | CVM ID for update (triggers update mode) |
| `--disk-size <size>` | Disk size with unit (e.g., 50G) |
| `--image <image>` | OS image version |
| `--node-id <id>` | Specific node ID |
| `--custom-app-id <id>` | Custom App ID |
| `--nonce <nonce>` | Nonce for deterministic app_id |
| `--pre-launch-script <path>` | Pre-launch script path |
| `--private-key <key>` | Private key for on-chain KMS |
| `--rpc-url <url>` | RPC URL for blockchain |
| `--debug` | Debug logging |

### phala instance-types

    phala instance-types [family] [options]

List available instance types. Optional `family` filter: `cpu`, `gpu`.

| Flag | Description |
|------|-------------|
| `-j, --json` | JSON output |

## App Management

### phala apps

    phala apps [options]

List deployed CVMs with filtering.

| Flag | Default | Description |
|------|---------|-------------|
| `--page <n>` | 1 | Page number |
| `--page-size <n>` | 50 | Items per page (max 100) |
| `--search <query>` | | Search by name/app_id/uuid/instance_id |
| `--status <status>` | | Filter by status (repeatable) |
| `--listed` | | Filter listed CVMs |
| `--no-listed` | | Filter unlisted CVMs |
| `--base-image <name>` | | Filter by base image |
| `--instance-type <type>` | | Filter by instance type |
| `--kms-type <type>` | | Filter by KMS type |
| `--node <name>` | | Filter by node |
| `--region <region>` | | Filter by region |
| `-j, --json` | false | JSON output |

### phala cvms list

Alias for `phala apps`. Also available as `phala cvms ls`.

### phala cvms get

    phala cvms get [cvm-id] [options]

| Flag | Description |
|------|-------------|
| `-j, --json` | JSON output |
| `-i, --interactive` | Interactive mode |

### phala cvms start

    phala cvms start [cvm-id] [-i]

Start a stopped CVM.

### phala cvms stop

    phala cvms stop [cvm-id] [-i]

Stop a running CVM.

### phala cvms restart

    phala cvms restart [cvm-id] [-i]

Restart a CVM.

### phala cvms delete

    phala cvms delete [cvm-id] [options]

| Flag | Description |
|------|-------------|
| `-i, --interactive` | Interactive mode |
| `-f, --force` | Skip confirmation |
| `-y, --yes` | Alias for --force |

### phala cvms resize

    phala cvms resize [cvm-id] [options]

| Flag | Description |
|------|-------------|
| `-v, --vcpu <n>` | Virtual CPUs |
| `-m, --memory <n>` | Memory in MB |
| `-d, --disk-size <n>` | Disk size in GB |
| `-r, --allow-restart <bool>` | Allow CVM restart |
| `-y, --yes` | Skip confirmation |
| `--json` | JSON output |
| `-i, --interactive` | Interactive mode |

### phala cvms replicate

    phala cvms replicate [cvm-id] [options]

| Flag | Description |
|------|-------------|
| `--teepod-id <id>` | TEEPod ID for replica |
| `-e, --env-file <file>` | Environment file |
| `-i, --interactive` | Interactive mode |

### phala cvms attestation

    phala cvms attestation [cvm-id] [options]

| Flag | Description |
|------|-------------|
| `-j, --json` | JSON output |
| `-i, --interactive` | Interactive mode |

### phala cvms list-nodes

    phala cvms list-nodes

List worker nodes. No arguments or options.

### phala link

    phala link [cvm-id] [-j]

Link current directory to a CVM. Creates/updates `phala.toml`.

### phala nodes list

    phala nodes list [options]

Also: `phala nodes ls`

| Flag | Default | Description |
|------|---------|-------------|
| `--page <n>` | 1 | Page number |
| `--page-size <n>` | 30 | Items per page (max 100) |
| `-j, --json` | false | JSON output |

## CVM Operations

### phala logs

    phala logs [container-name] [options]

Fetch logs from a CVM. Default: container logs.

| Flag | Default | Description |
|------|---------|-------------|
| `--serial` | false | CVM serial console (boot, kernel) |
| `--cvm-stdout` | false | CVM stdout channel |
| `--cvm-stderr` | false | CVM stderr channel |
| `--stderr` | false | Include container stderr |
| `-n, --tail <lines>` | | Lines from end |
| `-f, --follow` | false | Stream in real-time |
| `-t, --timestamps` | false | Show timestamps |
| `--since <time>` | | Start time (RFC3339 or relative e.g. 42m) |
| `--until <time>` | | End time |
| `--cvm-id <id>` | | CVM ID override |
| `-j, --json` | false | JSON output |
| `-i, --interactive` | false | Interactive mode |

**Log sources:**
- Default: Docker container stdout
- `--serial`: VM serial console — boot messages, kernel, docker-compose output
- `--cvm-stdout`: CVM-level stdout
- `--cvm-stderr`: CVM-level stderr
- `--stderr`: Include container stderr (only in container mode)

### phala ps

    phala ps [cvm-id] [options]

| Flag | Description |
|------|-------------|
| `--cvm-id <id>` | Override CVM ID |
| `-j, --json` | JSON output |
| `-i, --interactive` | Interactive mode |

### phala ssh

    phala ssh [cvm-id] [options] [-- ssh-args...]

| Flag | Default | Description |
|------|---------|-------------|
| `-p, --port <port>` | 443 | Gateway port |
| `-g, --gateway <domain>` | auto | Gateway domain |
| `-t, --timeout <sec>` | 30 | Connection timeout |
| `-v, --verbose` | false | Verbose details |
| `--dry-run` | false | Print command only |

Pass-through: all args after `--` go to ssh. `-o ProxyCommand` is blocked.

### phala cp

    phala cp <source> <destination> [options]

Path format: `local-path`, `cvm-name:remote-path`, or `:remote-path` (uses phala.toml).

| Flag | Default | Description |
|------|---------|-------------|
| `-i, --identity <file>` | | SSH identity file |
| `-p, --port <port>` | 443 | SSH port |
| `-g, --gateway <domain>` | auto | Gateway domain |
| `-r, --recursive` | false | Copy directories |
| `-v, --verbose` | false | Verbose details |
| `--dry-run` | false | Print command only |

## Advanced

### phala api

    phala api <endpoint> [options]

Make authenticated HTTP requests to the Phala Cloud API.

| Flag | Default | Description |
|------|---------|-------------|
| `-X, --method <method>` | GET | HTTP method |
| `-f, --field <k=v>` | | String param (repeatable, @file supported) |
| `-F, --raw-field <k:=v>` | | JSON param (repeatable, @file supported) |
| `-H, --header <k:v>` | | HTTP header (repeatable) |
| `-d, --data <data>` | | Request body (repeatable) |
| `--input <file>` | | Read body from file ("-" for stdin) |
| `-i, --include` | false | Print response headers |
| `-q, --jq <expr>` | | jq filter expression |
| `--silent` | false | Suppress response body |
| `--api-token <token>` | | Override API token |

### phala self update

    phala self update [options]

| Flag | Default | Description |
|------|---------|-------------|
| `-j, --json` | false | JSON output |
| `-y, --yes` | false | Skip confirmation |
| `--dry-run` | false | Print command only |
| `--package-manager <name>` | auto | npm, pnpm, yarn, or bun |
| `--channel <tag>` | latest | Release channel |

### phala config

    phala config get <key>
    phala config set <key> <value>
    phala config list [--json]

### phala completion

    phala completion [options]

| Flag | Description |
|------|-------------|
| `--shell <type>` | bash, zsh, or fish |
| `--fig` | Generate Fig/Amazon Q spec |

### phala simulator

    phala simulator              # show status
    phala simulator start [-p <port>] [-v]
    phala simulator stop

## Deprecated Commands

These commands still work but will be removed in a future version:

| Deprecated | Replacement |
|------------|-------------|
| `phala auth login` | `phala login` |
| `phala auth logout` | `phala logout` |
| `phala auth status` | `phala status` |
| `phala cvms create` | `phala deploy` |
| `phala cvms upgrade` | `phala deploy --cvm-id <id>` |
| `phala cvms logs` | `phala logs` |
| `phala cvms serial-logs` | `phala logs --serial` |
