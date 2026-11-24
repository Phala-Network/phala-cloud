# phala config

Manage local CLI configuration

## Usage

```
phala config <subcommand> [args] [options]
```

## Subcommands

### config get

Get a configuration value

#### Arguments

| Argument | Required | Description                   |
| -------- | -------- | ----------------------------- |
| `key`    | Yes      | Configuration key to retrieve |

#### Examples

```bash
$ phala config get api_prefix
$ phala config get default_region
```

### config set

Set a configuration value

#### Arguments

| Argument | Required | Description                |
| -------- | -------- | -------------------------- |
| `key`    | Yes      | Configuration key to set   |
| `value`  | Yes      | Value to assign to the key |

#### Examples

```bash
$ phala config set api_prefix https://custom-api.example.com
$ phala config set default_region us-west-2
```

### config list

List all configuration values

Aliases: `config ls`

#### Options

| Flag     | Short | Default | Description           |
| -------- | ----- | ------- | --------------------- |
| `--json` | `-j`  | false   | Output in JSON format |

#### Examples

```bash
$ phala config list
$ phala config ls
$ phala config ls --json
```
