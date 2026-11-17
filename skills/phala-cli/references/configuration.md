# Configuration Reference

## phala.toml

Project-level configuration file. Place in your project root directory.

Created automatically by `phala link` or manually.

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `app_id` | string | CVM App ID (e.g., `app_abc123`) |
| `id` | string | Generic CVM identifier |
| `uuid` | string | CVM UUID |
| `instance_id` | string | CVM instance ID |
| `name` | string | CVM name |
| `profile` | string | Auth profile to use |
| `api_version` | string | API version override |
| `gateway_domain` | string | SSH/SCP gateway domain |
| `gateway_port` | integer | SSH/SCP gateway port |
| `compose_file` | string | Docker Compose file path |
| `env_file` | string | Environment file path |
| `public_logs` | boolean | Make logs publicly accessible |
| `public_sysinfo` | boolean | Make system info publicly accessible |
| `listed` | boolean | List on Trust Center |

### CVM identification

Only one CVM identifier is needed. The CLI normalizes all formats:
- `app_id = "app_abc123"` — App ID format
- `uuid = "91b62ea0-6c64-4985-aa6c-fc3c88a02e64"` — UUID format
- `instance_id = "instance_abc123"` — Instance ID format
- `name = "my-app"` — Name lookup
- `id = "app_abc123"` — Auto-detected format

### Example

```toml
app_id = "app_50b0e827cc6c53f4010b57e588a18c5ef9388cc1"
compose_file = "docker-compose.yml"
env_file = ".env"
public_logs = true
public_sysinfo = true
listed = false
gateway_domain = "cloud.phala.com"
gateway_port = 443
```

### Commands that use phala.toml

| Command | Fields used |
|---------|-------------|
| `deploy` | cvm_id (triggers update), compose_file, env_file, public_logs, public_sysinfo, listed |
| `logs` | cvm_id |
| `ssh` | cvm_id, gateway_domain, gateway_port |
| `cp` | cvm_id (via `:path` syntax), gateway_domain, gateway_port |
| `ps` | cvm_id |

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PHALA_CLOUD_API_KEY` | Override stored API key | `phak_abc123...` |
| `PHALA_CLOUD_API_PREFIX` | Override API base URL | `https://cloud-api.phala.com/api/v1` |
| `PHALA_CLOUD_REQUESTS_PER_MINUTE` | Pace request starts per credential; must be a positive integer | `180` |
| `PHALA_CLOUD_DIR` | Override credentials directory | `/custom/path/.phala-cloud` |
| `PHALA_UPDATE_CHANNEL` | Release channel for `self update` | `latest`, `beta`, `next` |

### Priority order

1. Command-line flags (highest)
2. Environment variables
3. phala.toml project config
4. Stored profile credentials
5. Built-in defaults (lowest)

### CI/CD usage

```bash
export PHALA_CLOUD_API_KEY="phak_..."
phala deploy --name my-app --wait
phala logs --tail 20
```

## Profile Management

### Storage location

Credentials are stored in `~/.phala-cloud/` (override with `PHALA_CLOUD_DIR`).

Each profile stores:
- API key
- API base URL
- Workspace metadata

Files use restricted permissions (0600, user-only access).

### Commands

```bash
# Create profiles during login
phala login --profile work
phala login --profile personal

# List all profiles
phala profiles

# Switch active profile
phala switch work

# Remove active profile credentials
phala logout
```

### Profile selection priority

1. `--api-token` flag on the command (highest)
2. `PHALA_CLOUD_API_KEY` environment variable
3. `profile` field in phala.toml
4. Active profile in credentials store
5. Default profile (lowest)

## CLI Configuration (config command)

The `phala config` command manages CLI-level settings separate from project-level phala.toml.

```bash
phala config list              # show all config values
phala config get <key>         # get a specific value
phala config set <key> <value> # set a specific value
```

## Private Docker Registry

Environment variables for deploying private images:

### Docker Hub

| Variable | Required | Description |
|----------|----------|-------------|
| `DSTACK_DOCKER_USERNAME` | Yes | Docker Hub username |
| `DSTACK_DOCKER_PASSWORD` | Yes | Password or access token |
| `DSTACK_DOCKER_REGISTRY` | No | Registry URL (defaults to Docker Hub) |

### AWS ECR

| Variable | Required | Description |
|----------|----------|-------------|
| `DSTACK_AWS_ACCESS_KEY_ID` | Yes | AWS access key |
| `DSTACK_AWS_SECRET_ACCESS_KEY` | Yes | AWS secret key |
| `DSTACK_AWS_REGION` | Yes | AWS region of ECR |
| `DSTACK_AWS_ECR_REGISTRY` | Yes | Full ECR registry URL |

Set these as environment variables in your CVM's env file — they are encrypted before transmission and used at runtime to pull images.
