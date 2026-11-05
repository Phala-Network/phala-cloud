# phala apps

List deployed CVMs (Confidential Virtual Machines).

## Usage

```bash
phala apps [options]
```

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--page <number>` | 1 | Page number for pagination |
| `--page-size <number>` | 50 | Number of items per page (max: 100) |
| `--search <query>` | | Search by name, app_id, vm_uuid, or instance_id |
| `--status <status>` | | Filter by CVM status (repeatable) |
| `--listed` | | Filter to only listed CVMs |
| `--no-listed` | | Filter to only unlisted CVMs |
| `--base-image <name>` | | Filter by base OS image name |
| `--instance-type <type>` | | Filter by instance type |
| `--kms-type <type>` | | Filter by KMS type (phala, ethereum, base) |
| `--node <name>` | | Filter by node name |
| `--region <region>` | | Filter by region |
| `-j, --json` | false | Output in JSON format |

## CVM Status Values

Common status values for filtering:

- `pending` - CVM is being created
- `starting` - CVM is starting up
- `running` - CVM is running normally
- `stopped` - CVM has been stopped
- `error` - CVM encountered an error
- `terminated` - CVM has been terminated

## Examples

### List all CVMs

```bash
$ phala apps
CVMs (3 total):

  app_abc123  my-production-app   running   tdx.medium  us-west
  app_def456  staging-api         running   tdx.small   us-east
  app_ghi789  test-app            stopped   tdx.small   eu-central
```

### Search by name

```bash
$ phala apps --search production
CVMs (1 total):

  app_abc123  my-production-app   running   tdx.medium  us-west
```

### Filter by status

```bash
$ phala apps --status running
CVMs (2 total):

  app_abc123  my-production-app   running   tdx.medium  us-west
  app_def456  staging-api         running   tdx.small   us-east
```

### Filter by multiple statuses

```bash
$ phala apps --status running --status starting
```

### Filter by instance type

```bash
$ phala apps --instance-type tdx.medium
CVMs (1 total):

  app_abc123  my-production-app   running   tdx.medium  us-west
```

### Filter by region

```bash
$ phala apps --region us-west
CVMs (1 total):

  app_abc123  my-production-app   running   tdx.medium  us-west
```

### Filter by KMS type

```bash
$ phala apps --kms-type ethereum
```

### Show only listed CVMs

```bash
$ phala apps --listed
```

### Show only unlisted CVMs

```bash
$ phala apps --no-listed
```

### JSON output

```bash
$ phala apps --json
{
  "apps": [
    {
      "app_id": "app_abc123",
      "name": "my-production-app",
      "status": "running",
      "instance_type": "tdx.medium",
      "region": "us-west",
      "vcpu": 4,
      "memory_gb": 8,
      "created_at": "2026-01-15T10:30:00Z",
      "url": "https://app_abc123.phala.cloud"
    }
  ],
  "total": 3,
  "page": 1,
  "page_size": 50
}
```

### Pagination

```bash
$ phala apps --page 2 --page-size 10
```

### Extract specific field with jq

```bash
$ phala apps --json | jq -r '.apps[] | .app_id'
app_abc123
app_def456
app_ghi789
```

### Count running CVMs

```bash
$ phala apps --status running --json | jq '.total'
2
```

### List all CVM URLs

```bash
$ phala apps --json | jq -r '.apps[] | .url'
https://app_abc123.phala.cloud
https://app_def456.phala.cloud
https://app_ghi789.phala.cloud
```

### Find CVMs using specific base image

```bash
$ phala apps --base-image ubuntu-22.04
```

### Search by app ID

```bash
$ phala apps --search app_abc123
```

### Combine multiple filters

```bash
$ phala apps --status running \
  --instance-type tdx.medium \
  --region us-west
```

## Launch token

`phala apps launch-token set <app_id> [--token <token>]` sets or rotates the app's launch token. Without `--token` (at least 32 bytes), Phala Cloud generates one. The token and its hash are printed once; store the token.

`phala apps launch-token clear <app_id>` removes the token.

The token gates every boot of a CVM whose compose carries `requirements.launch_token_hash`. Changing the app token does not change any compose, so after `set`, point each CVM at the new hash before its next boot, or it fails to boot:

```bash
phala apps launch-token set 0123456789abcdef0123456789abcdef01234567
phala deploy --cvm-id app_123 --launch-token-hash <printed hash>
```

Before `clear`, remove the hash from every CVM of the app with `phala deploy --cvm-id <id> --launch-token-hash ""`. Phala Cloud and the node operator can read the token, so it only protects against parties who know the public compose.
