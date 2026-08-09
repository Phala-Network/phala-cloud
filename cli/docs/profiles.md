# phala profiles

List all authentication profiles.

## Usage

```bash
phala profiles
```

The active profile is marked with an asterisk (*).

## Examples

### List all profiles

```bash
$ phala profiles
* default
  work
  personal
```

### Check if profiles exist in scripts

```bash
$ phala profiles | grep -q "work"
$ if [ $? -eq 0 ]; then
    echo "Work profile exists"
  fi
```

## Profile Management

### Create a new profile

Use `phala login --profile <name>`:

```bash
$ phala login --profile work
Opening browser for authentication...
✓ Saved credentials to profile: work
```

### Switch between profiles

Use `phala switch <name>`:

```bash
$ phala switch work
✓ Switched to profile: work
```

### Delete profiles

Use `phala profiles delete <name> [more-names...]` (alias: `rm`). Deleting a
profile also asks the server to revoke its API token; if the token is already
invalid or the server does not support revocation, the profile is still
removed locally.

```bash
$ phala profiles delete work
✓ Deleted profile "work"

$ phala profiles delete work personal
✓ Deleted profile "work"
✓ Deleted profile "personal"
```

If the deleted profile was active, the CLI switches to one of the remaining
profiles.

### Refresh a profile

Use `phala profiles refresh <name>` when a profile's token stopped working
(for example `phala whoami` reports "Invalid API key"). The CLI first tries
to revoke the old token on the server, then re-authenticates via the device
flow (or `--manual` to paste a new API key) and stores the fresh token under
the same profile name.

```bash
$ phala profiles refresh work
To authenticate, visit:
https://cloud.phala.network/device?user_code=XXXX-XXXX
...
✓ Profile "work" refreshed (user: alice)
```

## Profile Storage

Profiles are stored in `~/.phala-cloud/credentials.json`

Each profile contains:
- API key
- Workspace information
- User metadata

