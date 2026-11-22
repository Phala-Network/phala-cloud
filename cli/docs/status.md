# phala status

Check authentication status and display current user information.

## Usage

```bash
phala status [options]
```

## Options

| Flag                  | Short | Default | Description                         |
| --------------------- | ----- | ------- | ----------------------------------- |
| `--json`              | `-j`  | false   | Output in JSON format               |
| `--debug`             | `-d`  | false   | Enable debug output                 |
| `--api-token <token>` |       |         | Override API token for this command |

## Examples

### Check authentication status

```bash
$ phala status
✓ Authenticated as user@example.com
Workspace: my-workspace
Profile: default
```

### JSON output

```bash
$ phala status --json
{
  "authenticated": true,
  "username": "user@example.com",
  "workspace": "my-workspace",
  "profile": "default"
}
```

### Extract specific field with jq

```bash
$ phala status --json | jq '.username'
"user@example.com"
```

### Check authentication in scripts

```bash
$ phala status --json | jq -e '.authenticated' > /dev/null
$ if [ $? -eq 0 ]; then
    echo "Authenticated"
  else
    echo "Not authenticated"
  fi
```

### Override API token

```bash
$ phala status --api-token phak_abc123...
✓ Authenticated as other@example.com
```

## Exit Codes

- `0` - Authenticated successfully
- `1` - Not authenticated or error occurred
