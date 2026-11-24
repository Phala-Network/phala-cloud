# phala runtime-config

Show the runtime configuration of a CVM, including hostname, gateway domain, and SSH authorized keys.

## Usage

    phala runtime-config [cvm-id] [options]

## Arguments

| Name     | Required | Description                                                                      |
| -------- | -------- | -------------------------------------------------------------------------------- |
| `cvm-id` | No       | CVM identifier (UUID, app_id, instance_id, or name). Uses linked CVM if omitted. |

## Options

| Flag            | Short | Default | Description               |
| --------------- | ----- | ------- | ------------------------- |
| `--interactive` | `-i`  | false   | Interactive CVM selection |
| `--json`        | `-j`  | false   | JSON output               |

## Examples

Show runtime config by app ID:

    $ phala runtime-config app_123

JSON output:

    $ phala runtime-config app_123 --json

Interactive CVM selection:

    $ phala runtime-config -i
