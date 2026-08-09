# phala logout

Remove stored API key from the current profile.

Before removing the profile locally, the CLI asks the server to revoke the
profile's API token (best effort: if the token is already invalid or the
server does not support revocation, the logout still succeeds).

## Usage

```bash
phala logout
```

## Examples

### Log out from current profile

```bash
$ phala logout
✓ Logged out successfully
```

### Verify logout

```bash
$ phala logout
✓ Logged out successfully

$ phala status
✗ Not authenticated. Run 'phala login' to authenticate.
```

