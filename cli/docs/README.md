# Phala Cloud CLI — Command Reference

Complete reference for all `phala` CLI commands.

For installation and quick start, see the [README](../README.md).

## Authentication

| Command | Description |
|---------|-------------|
| [login](./login.md) | Authenticate with Phala Cloud |
| [logout](./logout.md) | Remove stored API key |
| [status](./status.md) | Check authentication status |
| [whoami](./whoami.md) | Print the current user |
| [profiles](./profiles.md) | List auth profiles |
| [switch](./switch.md) | Switch auth profiles |

## Deployment

| Command | Description |
|---------|-------------|
| [deploy](./deploy.md) | Deploy new CVM or update existing one |
| [instance-types](./instance-types.md) | List available instance types |

## App Management

| Command | Description |
|---------|-------------|
| [apps](./apps.md) | List deployed CVMs |
| [cvms](./cvms.md) | Manage CVMs (start, stop, restart, delete, resize, ...) |
| [link](./link.md) | Link a local directory to a CVM |
| [nodes](./nodes.md) | List TEE worker nodes |
| [ssh-keys](./ssh-keys.md) | Manage SSH keys (list, add, remove, import from GitHub) |

## CVM Operations

| Command | Description |
|---------|-------------|
| [logs](./logs.md) | Fetch logs from a CVM (container, serial, stdout/stderr) |
| [ps](./ps.md) | List containers of a CVM |
| [ssh](./ssh.md) | Connect to a CVM via SSH |
| [cp](./cp.md) | Copy files to/from a CVM via SCP |
| [runtime-config](./runtime-config.md) | Show CVM runtime configuration |

## Advanced

| Command | Description |
|---------|-------------|
| [api](./api.md) | Make authenticated API requests |
| [self](./self.md) | CLI self-management (update) |
| [config](./config.md) | Manage local CLI configuration |
| [simulator](./simulator.md) | Local TEE simulator for development |
| [completion](./completion.md) | Generate shell completion scripts |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PHALA_CLOUD_API_KEY` | Override the stored API key |
| `PHALA_CLOUD_API_PREFIX` | Override the API base URL |
| `PHALA_CLOUD_DIR` | Override the credentials directory (default: `~/.phala-cloud`) |
| `PHALA_UPDATE_CHANNEL` | Release channel for `self update` (e.g., `latest`, `beta`) |

## Configuration

- Project config: `phala.toml` in working directory (see [deploy](./deploy.md))
- Credentials: `~/.phala-cloud/`
