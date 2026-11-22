# phala login

Authenticate with Phala Cloud.

## Usage

```bash
phala login [api-key] [options]
```

## Arguments

| Name      | Required | Description                                                                    |
| --------- | -------- | ------------------------------------------------------------------------------ |
| `api-key` | No       | API key starting with `phak_`. If omitted, triggers device flow authentication |

## Options

| Flag               | Short | Default                 | Description                                      |
| ------------------ | ----- | ----------------------- | ------------------------------------------------ |
| `--manual`         |       | false                   | Enter API key manually instead of device flow    |
| `--no-open`        |       | false                   | Skip automatic browser launch during device flow |
| `--profile <name>` |       | workspace slug          | Save credentials to named profile                |
| `--print-token`    |       | false                   | Print token to stdout without saving             |
| `--url <url>`      |       | https://api.phala.cloud | Custom API endpoint URL                          |

## Authentication Methods

### Device Flow (Recommended)

The simplest method. Opens a browser for authentication:

```bash
phala login
```

Follow the prompts to authorize the CLI in your browser.

### Direct API Key

Provide your API key directly:

```bash
phala login phak_abc123...
```

### Manual Entry

Enter API key interactively:

```bash
phala login --manual
```

### Environment Variable

Use API key without persisting:

```bash
export PHALA_CLOUD_API_KEY=phak_abc123...
phala status
```

## Profiles

Save credentials to different profiles for multiple workspaces:

```bash
phala login --profile work
phala login --profile personal
phala switch work
```

Profile names default to your workspace slug.

## Examples

### Basic device flow authentication

```bash
$ phala login
Opening browser for authentication...
✓ Successfully authenticated as user@example.com
```

### Direct API key login

```bash
$ phala login phak_abc123def456...
✓ Successfully authenticated as user@example.com
```

### Save to named profile

```bash
$ phala login --profile work
Opening browser for authentication...
✓ Saved credentials to profile: work
```

### Print token without saving

```bash
$ phala login --print-token
phak_abc123def456...
```

### Use environment variable (temporary)

```bash
$ export PHALA_CLOUD_API_KEY=phak_abc123...
$ phala status
✓ Authenticated as user@example.com
```

## Security Notes

- API keys are stored in `~/.phala-cloud/profiles/<profile>.json`
- File permissions are set to 600 (owner read/write only)
- Never commit API keys to version control
- Use environment variables for CI/CD environments
