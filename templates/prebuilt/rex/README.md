# Rex on Phala Cloud

[Rex](https://www.superlogical.com/rex) is a terminal multiplexer from Superlogical. Sessions live in a Rex server instead of a terminal window, so shells and agents keep running when you close your laptop, switch networks, or reconnect from another machine.

This template deploys a Rex server inside a confidential VM on Phala Cloud, alongside the SSH dev box. The Rex binary, server state, and your home directory all live in persistent Docker volumes, so sessions survive container and CVM restarts. Everything runs inside the TEE and is covered by remote attestation.

You connect over the SSH access that Phala Cloud already provides: Rex shells out to your local `ssh`, and the Rex protocol is forwarded through that connection. No extra ports, no TLS proxy, no Rex-side accounts.

## Services

- `dev-box`: SSH dev box (`ghcr.io/dstack-tee/dstack-dev-box`) with a wrapper entrypoint that installs Rex on first boot and starts a personal Rex server before launching sshd.

## Optional environment variables

```bash
REX_CHANNEL=preview
```

Rex has no stable release yet; `preview` is the recommended channel. The variable only takes effect on first install — afterwards the installed binary is kept on the persistent volume.

## Persistent data

- `home`: `/root` — Rex binary (`~/.local/bin/rex`), server state (`~/.local/state/rex`), and everything in your home directory.
- `ssh-host-keys`: `/etc/ssh/host-keys` — stable SSH host identity across restarts.

## Deploy

Deploy from the Phala Cloud dashboard template gallery, or with the CLI:

```bash
phala deploy -c docker-compose.yml -n my-rex --wait
```

SSH keys come from your Phala Cloud account (workspace keys are pushed to the CVM automatically). A key pasted at deploy time rides the `DSTACK_AUTHORIZED_KEYS` env channel; the dev box merges both sources.

## Connect

Interactive shell, as usual:

```bash
phala ssh my-rex
```

Rex clients (Rex for Mac, the `rex` CLI) connect to `ssh://` hosts using your local `ssh` and `~/.ssh/config`. Phala Cloud routes SSH through a TLS gateway, so add a host stanza once (print the exact values with `phala ssh my-rex --dry-run`):

```sshconfig
Host my-rex-phala
  HostName <app-id>-22.<gateway-domain>
  Port 443
  User root
  ProxyCommand openssl s_client -quiet -connect %h:%p -servername %h -verify_hostname %h -verify_return_error 2>/dev/null
```

Then register the host and drive it from your Mac:

```bash
rex hosts add my-rex ssh://my-rex-phala
rex -S my-rex ls
```

Or open Rex for Mac, choose **Add Remote Host…**, and enter `ssh://my-rex-phala`.

Inside the CVM, the `rex` CLI talks to the local server directly:

```bash
rex new work -c ~/project
rex send -s work 'claude'
rex send-key -s work Enter
rex capture -s work
```

Agents can use the same CLI, or call the server's HTTP API over its Unix socket — every server self-documents at `http://rex/llms.txt`:

```bash
curl -s --unix-socket /root/.local/state/rex/run/server.sock http://rex/llms.txt
```

## Notes

- Rex is in public beta. The Linux server installs without an account; Rex for Mac is distributed in waves through Superlogical's mailing list. The `rex` CLI over SSH works today.
- Rex has no authentication of its own and trusts SSH. Never expose the Rex socket over the Phala Cloud HTTPS gateway.
- `rex server install ssh://...` from a Mac does not work against containers (no systemd user manager); this template handles installation and startup for you.
- Restarting the CVM restarts the Rex server. Sessions and windows come back with a fresh shell; scrollback and programs running inside terminals do not survive a server restart (upstream Rex behavior, verified against this template).
