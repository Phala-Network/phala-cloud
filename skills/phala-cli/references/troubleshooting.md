# Troubleshooting

## Deploy Error Codes

The `phala deploy` command returns structured errors with codes for easy diagnosis.

Error format:
```
Error [ERR-XXXX]: <message>

Details:
  - <field>: <value>

Suggestions:
  - <actionable fix>
```

### Resource Errors (ERR-1xxx)

| Code | Message | Common Cause | Fix |
|------|---------|-------------|-----|
| ERR-1001 | Instance type not found | Typo in `--instance-type` | Run `phala instance-types` to see available types |
| ERR-1002 | No available resources | All matching nodes are full | Try a different region, instance type, or remove `--node-id` |
| ERR-1003 | Insufficient CPU capacity | Node lacks CPU | Use smaller instance type or omit `--node-id` |
| ERR-1004 | Insufficient memory | Node lacks memory | Use smaller instance type or omit `--node-id` |

### Image/Node Errors (ERR-2xxx)

| Code | Message | Common Cause | Fix |
|------|---------|-------------|-----|
| ERR-2003 | OS image not available | Image version doesn't exist on node | Omit `--image` for auto-selection, or check available images |
| ERR-2005 | Node not accessible | Node is offline or maintenance | Remove `--node-id` to auto-select, or try later |

### General troubleshooting for deploy errors

1. **Remove explicit node/region constraints** — let the system auto-select
2. **Check instance types** — `phala instance-types` shows what's available
3. **Verify compose file** — ensure `docker-compose.yml` is valid
4. **Check image accessibility** — the Docker image must be publicly pullable or configured with registry credentials

## Authentication Issues

### "API token is required"

```
API token is required. Please run 'phala login' or set PHALA_CLOUD_API_KEY environment variable
```

**Causes:**
- Not logged in
- Profile credentials expired or removed
- Wrong profile active

**Fix:**
```bash
phala status          # check current auth state
phala login           # re-authenticate
# or
export PHALA_CLOUD_API_KEY="phak_..."
```

### "Could not open browser"

Device flow login can't open browser (headless/SSH environment).

**Fix:**
```bash
phala login --no-open    # prints URL to copy manually
# or
phala login --manual     # enter API key directly
# or
phala login phak_xxx     # provide API key as argument
```

### Wrong workspace

Authenticated but commands show wrong CVMs.

**Fix:**
```bash
phala whoami              # check current user/workspace
phala profiles            # list all profiles
phala switch <profile>    # switch to correct profile
```

## Docker Issues

### Image pull fails during CVM boot

**Check serial logs:**
```bash
phala logs --serial       # look for Docker pull errors
```

**Common causes:**
- Image doesn't exist or is private without credentials
- Registry rate limiting

**Fix for private registries:**
Add these to your env file:
```
DSTACK_DOCKER_USERNAME=your-username
DSTACK_DOCKER_PASSWORD=your-token
```

### Docker build fails locally

```bash
# Verify Docker is running
docker info

# Check Dockerfile path
docker build -t my-app:v1 -f ./path/to/Dockerfile .
```

## SSH/SCP Issues

### Connection timeout

```bash
phala ssh --verbose       # show connection details
phala ssh --dry-run       # print the SSH command for debugging
```

**Common causes:**
- CVM is not running (`phala cvms get <id>` to check)
- Gateway port blocked by firewall
- SSH key not added to CVM (need `--ssh-pubkey` during deploy or `--dev-os`)

**Fix:**
```bash
# Check CVM status
phala apps --search my-app

# Redeploy with SSH key
phala deploy --cvm-id app_abc123 --ssh-pubkey ~/.ssh/id_rsa.pub --dev-os
```

### Permission denied

SSH key mismatch.

**Fix:**
```bash
# Use specific identity file
phala ssh -- -i ~/.ssh/my_key

# Or for cp
phala cp -i ~/.ssh/my_key ./file :~/file
```

## Log Source Guide

Different log sources show different information:

| Source | Flag | Shows |
|--------|------|-------|
| Container logs | (default) | Application stdout/stderr from Docker containers |
| Serial console | `--serial` | VM boot, kernel messages, docker-compose up output |
| CVM stdout | `--cvm-stdout` | CVM-level stdout stream |
| CVM stderr | `--cvm-stderr` | CVM-level stderr stream |

### Debugging checklist

1. **App not responding?** Start with container logs: `phala logs -f`
2. **Container not starting?** Check serial: `phala logs --serial`
3. **CVM not booting?** Check serial for kernel/boot errors: `phala logs --serial --tail 200`
4. **Which container?** List them first: `phala ps`, then `phala logs <container-name>`

### Time-based filtering

```bash
phala logs --since 30m           # last 30 minutes
phala logs --since 2h            # last 2 hours
phala logs --since 2024-01-01T00:00:00Z  # since specific time
phala logs --since 1h --until 30m        # between 1h ago and 30m ago
```

## Node Availability

### No nodes available

```bash
phala nodes list          # check available nodes
phala instance-types      # check what instance types exist
```

If no nodes match requirements:
- Try a different region
- Try a smaller instance type
- Try at a different time (nodes may be at capacity)

## Config Issues

### phala.toml not detected

The file must be in the current working directory. Verify:
```bash
ls phala.toml             # check it exists
cat phala.toml            # check contents
phala status              # shows if phala.toml is loaded
```

### Profile not found after switch

```bash
phala profiles            # list all available profiles
phala login --profile <name>  # re-create if missing
```

## Getting Help

```bash
phala --help              # list all commands
phala <command> --help    # help for specific command
phala api /api/v1/status  # check API connectivity
```

Report issues: https://github.com/Phala-Network/phala-cloud/issues
