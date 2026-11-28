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
name = "my-app"
profile = "default"
app_id = "50b0e827cc6c53f4010b57e588a18c5ef9388cc1"
compose_file = "docker-compose.yml"
```

`app_id` is written when the CVM has one. `compose_file` is written when the
directory has `docker-compose.yml` or `docker-compose.yaml`. `env_file` is
written when the directory has `.env.production`.

Commands such as `phala ssh`, `phala logs`, and `phala cp :path` then use this
CVM. The CLI uses the first identifier that is set, in this order: `id`,
`uuid`, `app_id`, `instance_id`, `name`. Because `phala link` writes both
`app_id` and `name`, the CLI uses `app_id`.

To point the project at one instance of an app with several instances, add
`uuid` with that instance's VM UUID, and remove any `id` entry.

Linking again, with a CVM ID or with the picker, rewrites the file. It keeps an
existing `[port_policy]` table as written, but replaces every other key. Add
`uuid` and any other keys you set by hand again after you relink. See the
[`phala.toml` reference](./phala.toml.md) for every key.
