---
name: phala-cli
description: |
  Phala Cloud CLI reference and usage guide. Covers all phala commands
  for deploying, managing, and debugging TEE applications (CVMs).
  Use when: users ask about phala CLI commands, deployment workflows,
  CVM management, log viewing, SSH access, or troubleshooting deploy errors.
---

# Phala Cloud CLI

`phala` (npm) — deploy and manage TEE applications (CVMs) on Phala Cloud.

## Operations

Determine what the user wants, then follow the matching procedure:

| User says | Operation |
|-----------|-----------|
| "deploy", "上线", "launch", "create a CVM" | **First Deploy** |
| "update", "redeploy", "upgrade", "push changes" | **Update Existing CVM** |
| "multiple instances", "many nodes", "scale out", "replicas" | **Add Instances to an App** |
| "not working", "error", "logs", "debug", "为什么挂了" | **Debug a CVM** |
| "SSH", "connect", "shell", "copy files" | **SSH & File Transfer** |
| "CI/CD", "automate", "pipeline", "GitHub Actions" | **CI/CD Setup** |
| "attestation", "verify", "proof" | **Attestation** |
| "list", "status", "which CVMs" | `phala apps` or `phala cvms get <id>` |

---

## First Deploy

### Step 1: Authenticate

```bash
phala login                   # opens browser (device flow)
```

Headless environment? Use `phala login --no-open` (prints URL) or `phala login phak_xxx` (direct key).

### Step 2: Deploy

```bash
phala deploy -n my-app -c docker-compose.yml -e .env
```

The compose file must use publicly pullable images, or set `DSTACK_DOCKER_USERNAME` / `DSTACK_DOCKER_PASSWORD` in the env file for private registries.

Instance type is auto-selected. Override with `-t tdx.small`, `-t tdx.medium`, etc. Check available types: `phala instance-types`.

### Step 3: Link the project

```bash
phala link
git add phala.toml            # safe to commit — no secrets
```

This creates `phala.toml` binding the directory to the CVM. From now on, `deploy`, `logs`, `ssh`, `cp`, `ps` all work without specifying a CVM ID. Everyone on the team gets the same binding.

### Step 4: Verify

```bash
phala ps                      # containers running?
phala logs -f                 # app output
```

If containers aren't running, go to **Debug a CVM**.

---

## Update Existing CVM

With `phala.toml` in the directory (from `phala link`):

```bash
phala deploy                  # updates the linked CVM
```

Without `phala.toml`:

```bash
phala deploy --cvm-id app_abc123
```

The CLI detects a CVM identifier and switches to update mode automatically. Changed compose file, env vars, or deploy flags are applied.

---

## Add Instances to an App

Create the app and first CVM once:

```bash
phala deploy --name my-app --node node-a --wait
```

Then add one instance per target node:

```bash
set -euo pipefail

for node in node-b node-c node-d; do
  phala instances add --app-id <app-id> --node "$node"
done
```

Do not start multiple concurrent `phala deploy` commands with the same compose file in one workspace. Those commands compete for one in-progress compose commit, so one can invalidate another command's commit token. Use `phala instances add` for additional CVMs under the same app.

## Debug a CVM

Three log sources, escalate in order:

| Step | Command | When to use |
|------|---------|-------------|
| 1 | `phala logs -f` | Container is running but app has errors |
| 2 | `phala logs --serial` | Container didn't start — shows docker-compose errors, image pull failures, kernel/boot messages |
| 3 | `phala logs --cvm-stderr` | CVM itself has process-level issues (rare) |

### Procedure

1. **Check what's running:**
   ```bash
   phala ps
   ```
   If the container is listed and running, go to step 2. If no containers or container is restarting, skip to step 3.

2. **Read container logs:**
   ```bash
   phala logs -f                     # stream all
   phala logs my-container           # specific container
   phala logs --since 30m            # last 30 minutes only
   ```

3. **Container not starting? Check serial:**
   ```bash
   phala logs --serial --tail 200
   ```
   Look for: `docker-compose` errors, image pull failures (`manifest unknown`, `unauthorized`), OOM kills.

4. **CVM not booting at all?**
   ```bash
   phala logs --cvm-stderr
   ```

### Common failures in serial logs

| Serial log message | Cause | Fix |
|-------------------|-------|-----|
| `manifest unknown` | Image tag doesn't exist | Fix image tag in compose file, redeploy |
| `unauthorized` / `authentication required` | Private registry, no credentials | Add `DSTACK_DOCKER_USERNAME` + `DSTACK_DOCKER_PASSWORD` to env file |
| `no space left on device` | Disk full | Redeploy with `--disk-size 50G` |
| `OOMKilled` | Out of memory | Use larger instance type: `-t tdx.medium` or `-t tdx.large` |

---

## SSH & File Transfer

### SSH into CVM

```bash
phala ssh                             # interactive shell (uses phala.toml)
phala ssh app_abc123                  # by CVM ID
phala ssh -- ls /app                  # run single command
phala ssh -- -L 8080:localhost:80     # port forwarding
```

Everything after `--` is passed to ssh. **`-o ProxyCommand` is blocked** for security.

To enable SSH on a CVM, deploy with `--dev` (it picks the newest dstack release; add `--image <slug>` to choose one, see `phala os-images`). On dstack 0.6+ this **edits the local compose file**: it adds a `dev-box` service to the file passed with `-c`, prints a diff on stderr, and deploys exactly what it wrote. Tell the user the file changed so they can review and commit it. Nothing is written for pre-0.6 releases or for `--app-compose`.

### Copy files

```bash
phala cp ./config.yml :~/             # upload to linked CVM (: prefix = phala.toml CVM)
phala cp my-app:~/logs/ ./logs/ -r    # download from named CVM
```

Path format: `local-path`, `cvm-name:remote-path`, or `:remote-path` (linked CVM from phala.toml).

### SSH not working?

```bash
phala ssh --dry-run                   # print the actual ssh command
phala ssh --verbose                   # connection details
```

Common causes:
- CVM not running → `phala apps --search my-app` to check status
- No SSH key → redeploy with `--ssh-pubkey ~/.ssh/id_rsa.pub`
- Key mismatch → `phala ssh -- -i ~/.ssh/correct_key`

---

## CI/CD Setup

```bash
export PHALA_CLOUD_API_KEY="phak_..."
phala deploy --name my-app --wait     # --wait blocks until CVM is ready
phala logs --tail 20                  # verify startup
```

`--wait` is critical in CI — without it, deploy returns immediately and the CVM may not be ready when subsequent steps run.

With `phala.toml` committed to the repo, CI just needs `PHALA_CLOUD_API_KEY` and `phala deploy --wait`.

---

## Attestation

```bash
phala cvms attestation                # human-readable (uses phala.toml)
phala cvms attestation app_abc123     # by CVM ID
phala cvms attestation --json | jq '.quote'   # extract quote for verification
```

---

## On-chain KMS Deploy

For Ethereum or Base KMS instead of the default Phala KMS:

```bash
phala deploy -n my-app -c docker-compose.yml \
  --kms ethereum --private-key 0x... --rpc-url https://eth.merkle.io

phala deploy -n my-app -c docker-compose.yml \
  --kms base --private-key 0x... --rpc-url https://mainnet.base.org
```

---

## Multiple Workspaces

```bash
phala login --profile work            # creates "work" profile
phala login --profile personal        # creates "personal" profile
phala switch work                     # switch active profile
phala profiles                        # list all (active marked with *)
phala whoami                          # verify current user
```

A `phala.toml` can also pin a profile: add `profile = "work"` so commands in that directory always use the right workspace.

---

## CVM Identification

Commands accept CVM identifiers in any format:
- App ID: `app_abc123def456`
- Instance ID: `instance_abc123`
- UUID: `91b62ea0-6c64-...`
- Name: `my-app`

With `phala.toml` present, no identifier needed.

---

## Gotchas

| Issue | Detail |
|-------|--------|
| `phala.toml` must be in CWD | The CLI reads from the current working directory only. `cd` to the project root before running commands. |
| `:path` in cp means linked CVM | `phala cp ./f :~/f` copies to the phala.toml CVM. Without the `:`, it's a local path. Easy to miss. |
| `--` required for ssh pass-through | `phala ssh -L 8080:...` fails — the CLI eats the flag. Use `phala ssh -- -L 8080:...`. |
| `-o ProxyCommand` blocked | Security restriction in `phala ssh`. Cannot override. |
| Deploy auto-detects update mode | If `phala.toml` or `--cvm-id` provides a CVM identifier, deploy updates instead of creating. No separate "update" command. |
| Same-compose fan-out uses instances | Run `phala deploy` once, then use `phala instances add --app-id <app-id> --node <node>` for each additional CVM. Concurrent deploys can collide on the compose commit. |
| `--wait` only for deploy | Only `phala deploy --wait` blocks until ready. Other commands don't have `--wait`. |
| Env file secrets are encrypted | `DSTACK_*` and other env vars in `-e .env` are encrypted before transmission. The CVM decrypts at runtime. Safe to include registry passwords. |
| Serial logs show boot-time only | `--serial` captures the VM boot sequence. If you need runtime container logs, use default `phala logs`. |
| `phala apps` pagination | Default 50 items. Use `--page-size 100` for up to 100. No way to get all in one call if >100 CVMs. |

## Reference Files

| File | Contents |
|------|----------|
| [commands.md](references/commands.md) | All commands with flags and arguments |
| [configuration.md](references/configuration.md) | phala.toml fields, env vars, profiles, Docker registry setup |
| [troubleshooting.md](references/troubleshooting.md) | Deploy error codes (ERR-1xxx, ERR-2xxx), auth issues, Docker issues, log source guide |
