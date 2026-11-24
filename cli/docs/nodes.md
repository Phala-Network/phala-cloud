# phala nodes

Manage TEE (Trusted Execution Environment) nodes in your Phala Cloud workspace.

## Usage

    phala nodes <subcommand> [options]

## Subcommands

### nodes list / nodes ls

List all TEE worker nodes available in your workspace.

#### Usage

    phala nodes list [options]
    phala nodes ls [options]

#### Options

| Flag            | Default | Description                         |
| --------------- | ------- | ----------------------------------- |
| `--page`        | 1       | Page number for pagination          |
| `--page-size`   | 30      | Number of items per page (max: 100) |
| `--json` / `-j` | false   | JSON output                         |

#### Examples

List all nodes:

    $ phala nodes list

List nodes with pagination:

    $ phala nodes ls --page 2 --page-size 50

List nodes with JSON output:

    $ phala nodes list --json
