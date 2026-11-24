# phala whoami

Print the current authenticated user.

## Usage

```bash
phala whoami [options]
```

## Options

| Flag                  | Short | Default | Description                         |
| --------------------- | ----- | ------- | ----------------------------------- |
| `--json`              | `-j`  | false   | Output in JSON format               |
| `--api-token <token>` |       |         | Override API token for this command |

## Examples

### Print current user

```bash
$ phala whoami
user@example.com
```

### JSON output

```bash
$ phala whoami --json
{
  "username": "user@example.com",
  "email": "user@example.com"
}
```

### Use in scripts

```bash
$ CURRENT_USER=$(phala whoami)
$ echo "Deploying as $CURRENT_USER"
Deploying as user@example.com
```

### Override API token

```bash
$ phala whoami --api-token phak_abc123...
other@example.com
```

## Exit Codes

- `0` - Successfully retrieved user information
- `1` - Not authenticated or error occurred
