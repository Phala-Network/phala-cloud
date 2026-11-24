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

| Flag                       | Default | Description                                                                         |
| -------------------------- | ------- | ----------------------------------------------------------------------------------- |
| `--page`                   | 1       | Page number for pagination                                                          |
| `--page-size`              | 30      | Number of items per page                                                            |
| `--search <query>`         |         | Search CVMs by name or ID                                                           |
| `--status <status>`        |         | Filter by status (repeatable: pending, starting, running, stopping, stopped, error) |
| `--listed` / `--no-listed` |         | Filter by listed status                                                             |
| `--base-image <image>`     |         | Filter by base image                                                                |
| `--instance-type <type>`   |         | Filter by instance type                                                             |
| `--kms-type <type>`        |         | Filter by KMS type                                                                  |
| `--node <node>`            |         | Filter by worker node                                                               |
| `--region <region>`        |         | Filter by region                                                                    |
| `--json` / `-j`            | false   | JSON output                                                                         |

#### Examples

    $ phala cvms list
    $ phala cvms ls --status running --status starting
    $ phala cvms list --search my-app --json
    $ phala cvms ls --region us-west --page 2

---

### cvms draft

Stage changes without updating the CVM. Review each entry's diff, then apply the entries together as one update.

    phala cvms draft list
    phala cvms draft stage my-cvm --compose docker-compose.yml
    phala cvms draft stage my-cvm --patch-file update.json
    phala cvms draft show my-cvm
    phala cvms draft undo my-cvm [entry-id]
    phala cvms draft discard my-cvm
    phala cvms draft apply my-cvm [--wait]

Use either `--compose` for a Docker Compose file or `--patch-file` for CVM update fields, for example `{"memory":8192,"public_logs":false}`. Undo removes the newest entry. If you pass an entry ID, it must match the newest entry.

To apply or discard only the draft you reviewed, use `draft show` to review the entries. Pass one `--expected-entry-id` for each entry ID in the same order, oldest first. If the entries no longer match, Phala Cloud refuses the request. Without these flags, apply and discard act on the current draft.

    phala cvms draft apply my-cvm --expected-entry-id "$first_id" --expected-entry-id "$second_id" --wait
    phala cvms draft discard my-cvm --expected-entry-id "$first_id" --expected-entry-id "$second_id"

If the CVM's compose changed since you started the draft, apply refuses to use the old draft. Review the live configuration, discard the stale draft, and stage the changes again.

If the update needs a new on-chain registration, set `PRIVATE_KEY` to the app owner's key. Registration is irreversible. Undo, discard, and cancel do not remove it or take back keys already released. Changing the draft while an update waits for finality can replace that update. If you already have the registration transaction for this draft, retry apply with both `--compose-hash` and `--transaction-hash`. Keep any `--expected-entry-id` flags from the original apply in the same order.

Without `--wait`, apply returns once Phala Cloud accepts the update. Use `--wait` to follow that exact update until it finishes. Stopping the CLI does not cancel the update.

---

### cvms get

Get detailed information about a specific CVM. API version `2026-11-11` is used by default. Compose is omitted by default; request it explicitly with `--include-compose`.

#### Usage

    phala cvms get [cvm-id] [options]

#### Arguments

| Name     | Required | Description                                        |
| -------- | -------- | -------------------------------------------------- |
| `cvm-id` | No       | CVM ID, UUID, or name (uses linked CVM if omitted) |

#### Options

| Flag                   | Default | Description                       |
| ---------------------- | ------- | --------------------------------- |
| `--json` / `-j`        | false   | JSON output                       |
| `--interactive` / `-i` | false   | Interactive mode                  |
| `--include-compose`    | false   | Include the compose configuration |

#### Examples

    $ phala cvms get
    $ phala cvms get app_abc123
    $ phala cvms get --json
    $ phala cvms get --interactive
    $ phala cvms get my-app --api-version 2026-11-11 --include-compose --json

---

### cvms gpu-status

Get observed GPU confidential-computing modes from the CVM node. CPU-only CVMs return a 404 error. The result contains `observed`, an array of GPU slots and their `cc_mode`, or null when unavailable.

    phala cvms gpu-status [cvm-id] [--json] [--interactive]

    $ phala cvms gpu-status my-app --json

---

### cvms start

Start a stopped CVM.

#### Usage

    phala cvms start [cvm-id] [options]

#### Arguments

| Name     | Required | Description                                        |
| -------- | -------- | -------------------------------------------------- |
| `cvm-id` | No       | CVM ID, UUID, or name (uses linked CVM if omitted) |

#### Options

| Flag                   | Default | Description      |
| ---------------------- | ------- | ---------------- |
| `--interactive` / `-i` | false   | Interactive mode |

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

| Name     | Required | Description                                        |
| -------- | -------- | -------------------------------------------------- |
| `cvm-id` | No       | CVM ID, UUID, or name (uses linked CVM if omitted) |

#### Options

| Flag                   | Default | Description      |
| ---------------------- | ------- | ---------------- |
| `--interactive` / `-i` | false   | Interactive mode |

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

| Name     | Required | Description                                        |
| -------- | -------- | -------------------------------------------------- |
| `cvm-id` | No       | CVM ID, UUID, or name (uses linked CVM if omitted) |

#### Options

| Flag                   | Default | Description      |
| ---------------------- | ------- | ---------------- |
| `--interactive` / `-i` | false   | Interactive mode |

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

| Name     | Required | Description                                        |
| -------- | -------- | -------------------------------------------------- |
| `cvm-id` | No       | CVM ID, UUID, or name (uses linked CVM if omitted) |

#### Options

| Flag                   | Default | Description                       |
| ---------------------- | ------- | --------------------------------- |
| `--interactive` / `-i` | false   | Interactive mode                  |
| `--force` / `-f`       | false   | Force delete without confirmation |
| `--yes` / `-y`         | false   | Skip confirmation prompt          |

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

| Name     | Required | Description                                        |
| -------- | -------- | -------------------------------------------------- |
| `cvm-id` | No       | CVM ID, UUID, or name (uses linked CVM if omitted) |

#### Options

| Flag                      | Default | Description                                                       |
| ------------------------- | ------- | ----------------------------------------------------------------- |
| `--interactive` / `-i`    | false   | Interactive mode                                                  |
| `--vcpu <cores>` / `-v`   |         | Number of vCPU cores                                              |
| `--memory <mb>` / `-m`    |         | Memory in MB                                                      |
| `--disk-size <gb>` / `-d` |         | Disk size in GB                                                   |
| `--allow-restart` / `-r`  |         | Deprecated and ignored. The CVM restarts when the resize needs it |
| `--yes` / `-y`            | false   | Skip confirmation prompt                                          |
| `--json`                  | false   | JSON output                                                       |

#### Examples

    $ phala cvms resize --vcpu 4 --memory 8192
    $ phala cvms resize app_abc123 --disk-size 100
    $ phala cvms resize -v 2 -m 4096 -y
    $ phala cvms resize --interactive

---

### cvms replicate

Create a replica of an existing CVM.

#### Usage

    phala cvms replicate [cvm-id] [options]

#### Arguments

| Name     | Required | Description                                        |
| -------- | -------- | -------------------------------------------------- |
| `cvm-id` | No       | CVM UUID to replicate (uses linked CVM if omitted) |

#### Options

| Flag                       | Default | Description                            |
| -------------------------- | ------- | -------------------------------------- |
| `--node <name>`            |         | Physical node name, such as `usw5`     |
| `--env-file <file>` / `-e` |         | Environment file to override variables |
| `--interactive` / `-i`     | false   | Interactive mode                       |

#### Examples

    $ phala cvms replicate
    $ phala cvms replicate abc-123-def-456
    $ phala cvms replicate --node usw5 --env-file .env.prod
    $ phala cvms replicate --interactive

---

### cvms attestation

Get CVM attestation data for verification.

#### Usage

    phala cvms attestation [cvm-id] [options]

#### Arguments

| Name     | Required | Description                                        |
| -------- | -------- | -------------------------------------------------- |
| `cvm-id` | No       | CVM ID, UUID, or name (uses linked CVM if omitted) |

#### Options

| Flag                   | Default | Description      |
| ---------------------- | ------- | ---------------- |
| `--json` / `-j`        | false   | JSON output      |
| `--interactive` / `-i` | false   | Interactive mode |

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
- **`cvms upgrade`** — Use `phala deploy --cvm-id <id>` instead. It now replaces only the Docker Compose file (and, with `--env-file`, the allowed env keys and encrypted env). The stored pre-launch script, visibility settings and allowed env keys are kept, and an unchanged compose does nothing. Before, it reset the pre-launch script to the platform default, reset visibility and cleared the allowed env keys. CVMs on on-chain KMS are rejected; use `phala deploy --cvm-id` for them.
- **`cvms logs`** — Use `phala logs` instead
- **`cvms serial-logs`** — Use `phala logs --serial` instead

These commands may be removed in a future version.
