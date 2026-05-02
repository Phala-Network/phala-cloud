# Phala Cloud CLI

Command-line tool for deploying and managing TEE (Trusted Execution Environment) applications on [Phala Cloud](https://cloud.phala.com).

## Install

```bash
npm install -g phala
```

Or run directly without installing:

```bash
npx phala <command>
bunx phala <command>
```

## Quick Start

```bash
# Authenticate (opens browser for device flow)
phala login

# Deploy from a directory with docker-compose.yml
phala deploy

# Link the directory to the CVM for future commands
phala link

# View container logs
phala logs

# SSH into the CVM
phala ssh

# List all replicas for one app, then target one by UUID
phala cvms list --app app_abc123
phala cvms restart 550e8400-e29b-41d4-a716-446655440000
```

> **Tip:** Run `phala link` after your first deploy. It creates a `phala.toml` that binds the directory to the CVM, so subsequent commands (`deploy`, `logs`, `ssh`, `cp`, `ps`) work without specifying a CVM ID. `phala.toml` is safe to commit to version control.

## Commands

### Deploy

| Command | Description |
|---------|-------------|
| [`deploy`](docs/deploy.md) | Deploy new CVM or update existing one |
| [`instance-types`](docs/instance-types.md) | List available instance types |
| [`nodes`](docs/nodes.md) | List TEE worker nodes |

### Manage

| Command | Description |
|---------|-------------|
| [`apps`](docs/apps.md) | List deployed CVMs |
| [`cvms`](docs/cvms.md) | Manage CVMs (start, stop, restart, delete, resize, ...) |
| [`link`](docs/link.md) | Link a local directory to a CVM |
| [`simulator`](docs/simulator.md) | Local TEE simulator for development |

### CVM Operations

| Command | Description |
|---------|-------------|
| [`logs`](docs/logs.md) | Fetch logs from a CVM (container, serial, stdout/stderr) |
| [`ps`](docs/ps.md) | List containers of a CVM |
| [`ssh`](docs/ssh.md) | Connect to a CVM via SSH |
| [`cp`](docs/cp.md) | Copy files to/from a CVM via SCP |

### Profile / Auth

| Command | Description |
|---------|-------------|
| [`login`](docs/login.md) | Authenticate with Phala Cloud |
| [`logout`](docs/logout.md) | Remove stored API key |
| [`status`](docs/status.md) | Check authentication status |
| [`whoami`](docs/whoami.md) | Print the current user |
| [`profiles`](docs/profiles.md) | List auth profiles |
| [`switch`](docs/switch.md) | Switch auth profiles |

### Advanced

| Command | Description |
|---------|-------------|
| [`api`](docs/api.md) | Make authenticated API requests |
| [`self`](docs/self.md) | CLI self-management (update) |
| [`completion`](docs/completion.md) | Generate shell completion scripts |

## Configuration

### Project file (`phala.toml`)

Place a `phala.toml` in your project root to bind a directory to a CVM:

```toml
app_id = "app_abc123"
compose_file = "docker-compose.yml"
env_file = ".env"
public_logs = true
listed = false
```

When `phala.toml` exists, commands like `deploy`, `logs`, `ssh`, and `cp` automatically use the configured CVM.

### Environment variables

| Variable | Description |
|----------|-------------|
| `PHALA_CLOUD_API_KEY` | Override the stored API key |
| `PHALA_CLOUD_API_PREFIX` | Override the API base URL |
| `PHALA_CLOUD_DIR` | Override the credentials directory (default: `~/.phala-cloud`) |
| `PHALA_UPDATE_CHANNEL` | Release channel for `self update` (e.g., `latest`, `beta`) |

### Profiles

Manage multiple workspaces with named profiles:

```bash
phala login --profile work
phala login --profile personal
phala switch work
phala profiles
```

Credentials are stored in `~/.phala-cloud/` with restricted file permissions.

## Documentation

Full command reference with all options, arguments, and examples:

https://github.com/Phala-Network/phala-cloud/tree/main/cli/docs

## Development

```bash
bun install
bun run src/index.ts <command>

# Quality checks
bun run fmt        # Format with Biome
bun run lint       # Lint with Biome
bun run type-check # TypeScript type checking
bun run test       # Run tests
```

## License

[Apache-2.0](LICENSE)
