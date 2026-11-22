# phala ps

List containers running in a CVM.

## Usage

    phala ps [cvm-id] [options]

## Arguments

| Name     | Required | Description                                        |
| -------- | -------- | -------------------------------------------------- |
| `cvm-id` | No       | CVM ID, UUID, or name (uses linked CVM if omitted) |

## Options

| Flag            | Short | Default | Description      |
| --------------- | ----- | ------- | ---------------- |
| `--cvm-id <id>` |       |         | Override CVM ID  |
| `--json`        | `-j`  | false   | JSON output      |
| `--interactive` | `-i`  | false   | Interactive mode |

## Examples

List containers from linked CVM:

    $ phala ps

List containers from specific CVM:

    $ phala ps app_abc123

List containers with JSON output:

    $ phala ps --json

List containers with interactive CVM selection:

    $ phala ps --interactive
