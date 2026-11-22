# phala logs

Fetch logs from a CVM with multiple log sources: container logs (default), serial console, and CVM stdout/stderr channels.

## Usage

    phala logs [container-name] [options]

## Arguments

| Name             | Required | Description                                             |
| ---------------- | -------- | ------------------------------------------------------- |
| `container-name` | No       | Container name to fetch logs from (container mode only) |

## Options

| Flag             | Short | Default | Description                                                  |
| ---------------- | ----- | ------- | ------------------------------------------------------------ |
| `--serial`       |       | false   | Fetch CVM serial console logs (boot, kernel, docker-compose) |
| `--cvm-stdout`   |       | false   | Fetch CVM stdout channel                                     |
| `--cvm-stderr`   |       | false   | Fetch CVM stderr channel                                     |
| `--stderr`       |       | false   | Include container stderr (container mode only)               |
| `--tail <lines>` | `-n`  |         | Number of lines from end                                     |
| `--follow`       | `-f`  | false   | Stream logs in real-time                                     |
| `--timestamps`   | `-t`  | false   | Show timestamps                                              |
| `--since <time>` |       |         | Start time (RFC3339 or relative, e.g., 42m)                  |
| `--until <time>` |       |         | End time (RFC3339 or relative)                               |
| `--cvm-id <id>`  |       |         | CVM ID override                                              |
| `--json`         | `-j`  | false   | JSON output                                                  |
| `--interactive`  | `-i`  | false   | Interactive mode                                             |

## Log Sources

- **Container logs** (default): Docker container stdout/stderr
- **Serial console** (`--serial`): VM boot, kernel, docker-compose output
- **CVM stdout** (`--cvm-stdout`): CVM-level stdout
- **CVM stderr** (`--cvm-stderr`): CVM-level stderr

## Examples

Fetch container logs from linked CVM:

    $ phala logs

Fetch logs from specific CVM:

    $ phala logs --cvm-id app_abc123

Fetch serial console logs:

    $ phala logs --serial

Fetch CVM stdout:

    $ phala logs --cvm-stdout

Stream logs in real-time:

    $ phala logs -f --tail 100

Fetch logs from last 30 minutes:

    $ phala logs --since 30m

Fetch logs from specific container:

    $ phala logs my-container

Fetch logs with timestamps:

    $ phala logs -t --since 1h --until 30m
