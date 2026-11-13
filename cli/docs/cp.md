# phala cp

Copy files to/from a CVM via SCP through the Phala Cloud gateway.

SCP needs the CVM to serve SSH: a dev OS image (dstack 0.5 and older) or a
`dev-box` container in its compose (dstack 0.6 and newer, added by
`phala deploy --dev-os`).

## Usage

    phala cp <source> <destination> [options]

## Arguments

| Name | Required | Description |
|------|----------|-------------|
| `source` | Yes | Source path (local or `cvm-name:path`, use `:path` for linked CVM) |
| `destination` | Yes | Destination path (same format as source) |

## Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--identity <file>` | `-i` | | SSH identity file |
| `--port <port>` | `-p` | 443 | SSH port (priority: CLI > phala.toml > 443) |
| `--gateway <domain>` | `-g` | | Gateway domain (priority: CLI > phala.toml > API) |
| `--recursive` | `-r` | false | Copy directories recursively |
| `--verbose` | `-v` | false | Verbose SCP details |
| `--dry-run` | | false | Print SCP command without executing |

## Path Format

- **Local path**: `./config.yml`, `/tmp/script.sh`
- **Linked CVM**: `:~/config.yml` (uses `cvm_id` from `phala.toml`)
- **Named CVM**: `my-app:~/logs/`, `app_abc123:/tmp/script.sh`

## HTTP Proxy

`phala cp` honours `HTTPS_PROXY` and `NO_PROXY` the same way as `phala ssh`. See [ssh.md](ssh.md#http-proxy).

## Examples

Upload file to linked CVM:

    $ phala cp ./config.yml :~/config.yml

Download directory from named CVM:

    $ phala cp my-app:~/logs/ ./logs/ -r

Upload to specific CVM by ID:

    $ phala cp ./script.sh app_abc123:/tmp/script.sh

Print SCP command without executing:

    $ phala cp --dry-run ./file.txt :~/file.txt

Copy with custom SSH identity:

    $ phala cp -i ~/.ssh/custom_key ./data.json :~/data.json

Copy with verbose output:

    $ phala cp -v -r ./dist/ my-app:/app/dist/
