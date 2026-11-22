# phala link

Link a local directory to a CVM by creating or updating `phala.toml` in the current directory.

## Usage

    phala link [cvm-id] [options]

## Arguments

| Name     | Required | Description                                             |
| -------- | -------- | ------------------------------------------------------- |
| `cvm-id` | No       | CVM ID or name (launches interactive picker if omitted) |

## Options

| Flag     | Short | Default | Description |
| -------- | ----- | ------- | ----------- |
| `--json` | `-j`  | false   | JSON output |

## Examples

Link with interactive CVM picker:

    $ phala link

Link to specific CVM by ID:

    $ phala link app_abc123

Link to specific CVM by name:

    $ phala link my-app

Link with JSON output:

    $ phala link app_abc123 --json

## Configuration File

The `phala.toml` file is created in the current directory with the following structure:

```toml
cvm_id = "app_abc123"
```

Once linked, commands like `phala ssh`, `phala logs`, and `phala cp :path` will automatically use this CVM ID.
