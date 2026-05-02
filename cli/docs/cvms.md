# phala cvms

Manage CVMs (Confidential Virtual Machines) in your Phala Cloud workspace.

## Usage

    phala cvms <subcommand> [args] [options]

## Subcommands

### cvms list / cvms ls

List CVMs in your workspace with filtering and pagination.

#### Usage

    phala cvms list [options]
    phala cvms ls [options]

#### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--app <app-id>` | | List all CVMs belonging to a specific app |
| `--page` | 1 | Page number for pagination |
| `--page-size` | 30 | Number of items per page |
| `--search <query>` | | Search CVMs by name or ID |
| `--status <status>` | | Filter by status (repeatable: pending, starting, running, stopping, stopped, error) |
| `--listed` / `--no-listed` | | Filter by listed status |
| `--base-image <image>` | | Filter by base image |
| `--instance-type <type>` | | Filter by instance type |
| `--kms-type <type>` | | Filter by KMS type |
| `--node <node>` | | Filter by worker node |
| `--region <region>` | | Filter by region |
| `--json` / `-j` | false | JSON output |

#### Examples

    $ phala cvms list
    $ phala cvms list --app app_abc123
    $ phala cvms ls --status running --status starting
    $ phala cvms list --search my-app --json
    $ phala cvms ls --region us-west --page 2

---

### cvms get

Get detailed information about a specific CVM.

#### Usage

    phala cvms get [cvm-id] [options]

#### Arguments

| Name | Required | Description |
|------|----------|-------------|
| `cvm-id` | No | CVM ID, UUID, or name (uses linked CVM if omitted) |

#### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--json` / `-j` | false | JSON output |
| `--interactive` / `-i` | false | Interactive mode |

#### Examples

    $ phala cvms get
    $ phala cvms get app_abc123
    $ phala cvms get 550e8400-e29b-41d4-a716-446655440000
    $ phala cvms get --json
    $ phala cvms get --interactive

---

### cvms start

Start a stopped CVM.

#### Usage

    phala cvms start [cvm-id] [options]

#### Arguments

| Name | Required | Description |
|------|----------|-------------|
| `cvm-id` | No | CVM ID, UUID, or name (uses linked CVM if omitted) |

#### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--interactive` / `-i` | false | Interactive mode |

#### Examples

    $ phala cvms start
    $ phala cvms start app_abc123
    $ phala cvms start --interactive

---

### cvms stop

Stop a running CVM.

#### Usage

    phala cvms stop [cvm-id] [options]

#### Arguments

| Name | Required | Description |
|------|----------|-------------|
| `cvm-id` | No | CVM ID, UUID, or name (uses linked CVM if omitted) |

#### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--interactive` / `-i` | false | Interactive mode |

#### Examples

    $ phala cvms stop
    $ phala cvms stop app_abc123
    $ phala cvms stop --interactive

---

### cvms restart

Restart a CVM (stop then start).

#### Usage

    phala cvms restart [cvm-id] [options]

#### Arguments

| Name | Required | Description |
|------|----------|-------------|
| `cvm-id` | No | CVM ID, UUID, or name (uses linked CVM if omitted) |

#### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--interactive` / `-i` | false | Interactive mode |

#### Examples

    $ phala cvms restart
    $ phala cvms restart app_abc123
    $ phala cvms restart --interactive

---

### cvms delete

Delete a CVM permanently.

#### Usage

    phala cvms delete [cvm-id] [options]

#### Arguments

| Name | Required | Description |
|------|----------|-------------|
| `cvm-id` | No | CVM ID, UUID, or name (uses linked CVM if omitted) |

#### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--interactive` / `-i` | false | Interactive mode |
| `--force` / `-f` | false | Force delete without confirmation |
| `--yes` / `-y` | false | Skip confirmation prompt |

#### Examples

    $ phala cvms delete
    $ phala cvms delete app_abc123
    $ phala cvms delete --force --yes
    $ phala cvms delete --interactive

---

### cvms resize

Resize CVM resources (vCPU, memory, disk).

#### Usage

    phala cvms resize [cvm-id] [options]

#### Arguments

| Name | Required | Description |
|------|----------|-------------|
| `cvm-id` | No | CVM ID, UUID, or name (uses linked CVM if omitted) |

#### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--interactive` / `-i` | false | Interactive mode |
| `--vcpu <cores>` / `-v` | | Number of vCPU cores |
| `--memory <mb>` / `-m` | | Memory in MB |
| `--disk-size <gb>` / `-d` | | Disk size in GB |
| `--allow-restart` / `-r` | false | Allow CVM restart if required |
| `--yes` / `-y` | false | Skip confirmation prompt |
| `--json` | false | JSON output |

#### Examples

    $ phala cvms resize --vcpu 4 --memory 8192
    $ phala cvms resize app_abc123 --disk-size 100 --allow-restart
    $ phala cvms resize -v 2 -m 4096 -y
    $ phala cvms resize --interactive

---

### cvms replicate

Create a replica of an existing CVM.

#### Usage

    phala cvms replicate [cvm-id] [options]

#### Arguments

| Name | Required | Description |
|------|----------|-------------|
| `cvm-id` | No | CVM UUID to replicate (uses linked CVM if omitted) |

#### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--teepod-id <id>` | | Target TeePod ID |
| `--env-file <file>` / `-e` | | Environment file to override variables |
| `--interactive` / `-i` | false | Interactive mode |

#### Examples

    $ phala cvms replicate
    $ phala cvms replicate abc-123-def-456
    $ phala cvms replicate --teepod-id pod_xyz --env-file .env.prod
    $ phala cvms replicate --interactive

---

### cvms attestation

Get CVM attestation data for verification.

#### Usage

    phala cvms attestation [cvm-id] [options]

#### Arguments

| Name | Required | Description |
|------|----------|-------------|
| `cvm-id` | No | CVM ID, UUID, or name (uses linked CVM if omitted) |

#### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--json` / `-j` | false | JSON output |
| `--interactive` / `-i` | false | Interactive mode |

#### Examples

    $ phala cvms attestation
    $ phala cvms attestation app_abc123
    $ phala cvms attestation --json
    $ phala cvms attestation --interactive

---

### cvms list-nodes

List available worker nodes in the workspace.

#### Usage

    phala cvms list-nodes

#### Examples

    $ phala cvms list-nodes

---

## Deprecated Commands

The following commands are deprecated and have been replaced:

- **`cvms create`** — Use `phala deploy` instead
- **`cvms upgrade`** — Use `phala deploy --cvm-id <id>` instead
- **`cvms logs`** — Use `phala logs` instead
- **`cvms serial-logs`** — Use `phala logs --serial` instead

These commands may be removed in a future version.
