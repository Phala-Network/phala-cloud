# phala ssh-keys

Manage SSH keys associated with your Phala Cloud account, and which of those keys a CVM authorizes.

Account commands (`list` / `add` / `rm` / `import-github`) change the keys on your account. CVM commands (`show` / `grant` / `revoke`) change which existing workspace-member keys a CVM boots with. They are different objects: revoking an authorization leaves the account key intact.

## Usage

    phala ssh-keys <subcommand> [args] [options]

## Subcommands

### ssh-keys list / ssh-keys ls

List SSH keys for the current user.

#### Usage

    phala ssh-keys list [options]
    phala ssh-keys ls [options]

#### Examples

    $ phala ssh-keys list
    $ phala ssh-keys ls
    $ phala ssh-keys list --json

---

### ssh-keys add

Add a local SSH public key to your account.

If no `--key-file` is specified, the command looks for a default key in `~/.ssh/` (tries `id_ed25519.pub`, `id_rsa.pub`, `id_ecdsa.pub` in order). If no `--name` is given, defaults to `<hostname>-<key-filename>`.

#### Usage

    phala ssh-keys add [options]

#### Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--name <name>` | | `<hostname>-<keyfile>` | Name for the SSH key |
| `--key-file <path>` | | Auto-detected | Path to SSH public key file |

#### Examples

    $ phala ssh-keys add
    $ phala ssh-keys add --name my-laptop --key-file ~/.ssh/id_ed25519.pub

---

### ssh-keys remove / ssh-keys rm

Remove an SSH key from your account.

#### Usage

    phala ssh-keys remove [key_id] [options]
    phala ssh-keys rm [key_id] [options]

#### Arguments

| Name | Required | Description |
|------|----------|-------------|
| `key_id` | No | SSH key ID to remove (from `phala ssh-keys list`) |

#### Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--interactive` | `-i` | false | Select key from list |

#### Examples

    $ phala ssh-keys rm sshkey_xxx
    $ phala ssh-keys rm -i

---

### ssh-keys import-github

Import SSH keys from a GitHub user's public profile. Keys that already exist are skipped.

#### Usage

    phala ssh-keys import-github <github_username>

#### Arguments

| Name | Required | Description |
|------|----------|-------------|
| `github_username` | Yes | GitHub username to import SSH keys from |

#### Examples

    $ phala ssh-keys import-github octocat
    $ phala ssh-keys import-github myuser --json

---

### ssh-keys show

Show the SSH keys a CVM is configured to authorize, including owner username/email and whether a restart is needed. This is the stored set, not the live `user_config` printed by `phala runtime-config`.

#### Usage

    phala ssh-keys show [cvm_id] [options]

#### Examples

    $ phala ssh-keys show app_123
    $ phala ssh-keys show

---

### ssh-keys grant

Authorize a workspace member's keys on a CVM. The nickname is resolved server-side to every active key that member holds. `--id` grants a single key. The two may be combined.

#### Usage

    phala ssh-keys grant [cvm_id] [user_nickname] [options]

#### Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--id <sshkey_id>` | | | SSH key hashid to grant |
| `--apply-now` | | false | Restart the CVM so the change takes effect immediately |

#### Examples

    $ phala ssh-keys grant app_123 alice
    $ phala ssh-keys grant app_123 --id sshkey_abc
    $ phala ssh-keys grant app_123 alice --apply-now

---

### ssh-keys revoke

Withdraw SSH keys from a CVM. The account key is left intact and can be re-granted.

#### Usage

    phala ssh-keys revoke [cvm_id] [user_nickname] [options]

#### Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--id <sshkey_id>` | | | SSH key hashid to withdraw |
| `--apply-now` | | false | Restart the CVM so the change takes effect immediately |

#### Examples

    $ phala ssh-keys revoke app_123 alice
    $ phala ssh-keys revoke app_123 --id sshkey_abc
