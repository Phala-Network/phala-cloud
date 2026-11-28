# Gateway port policy

The gateway is how traffic from the internet reaches your CVM. A port policy
tells the gateway which ports of the CVM it may forward to. It also says which
of those ports get a PROXY protocol header.

You can set the policy in two ways. Put a `[port_policy]` table in `phala.toml`
and run `phala deploy`, or change one CVM directly with `phala port-policy`.

`phala port-policy` is marked unstable in `phala --help`. CLI releases that do
not have this command ignore `[port_policy]` in `phala.toml` without a warning.
Upgrade the CLI before you add the table to a deployment script.

## Which port does the policy control?

The guest port. That is the left side of a Docker Compose port mapping.

1. Your container listens on a container port. For example, Nginx listens on `80`.
2. Docker Compose publishes it on a guest port. In `ports: ["8080:80"]`, the
   guest port is `8080`. A port bound only to loopback, such as
   `127.0.0.1:8080:80`, cannot be reached from the gateway.
3. The gateway forwards traffic to the guest port. So the policy lists `8080`,
   not `80`.

The policy does not publish container ports for you. It does not change direct
node port mappings. It does nothing while the gateway is turned off for the CVM.

## What does each setting do?

A policy has two keys: `restrict_mode` and a list of `ports`.

| Policy | What the gateway does |
| --- | --- |
| `restrict_mode = true` | Forwards only the ports in the list. |
| `restrict_mode = true` with an empty list | Forwards no ports at all. |
| `restrict_mode = false` | Forwards every port. The list only picks which ports use PROXY protocol. |
| No policy declared | Forwards every port, without PROXY protocol. |

Each entry in the list is a port number. Add `pp = true` to turn on PROXY
protocol for that port. See
[When should I turn on PROXY protocol?](#when-should-i-turn-on-proxy-protocol)
before you do.

## What policy does a new CVM get?

If you do not declare a policy, Phala Cloud normally sets one for you when it
creates the CVM. It turns on `restrict_mode` and allows:

- every TCP guest port that Docker Compose publishes,
- port `8090`, for the guest agent,
- port `22`, when the CVM is set up for SSH access.

Phala Cloud cannot always tell which ports your app listens on. In these cases
it sets no default, so the gateway forwards every port:

- the OS image is older than dstack OS 0.5.9,
- the CVM uses the Bash runner,
- a service uses host networking or another non-default network mode.

A published port that comes from an environment variable, such as
`"${PORT}:80"`, cannot be read ahead of time. It is not in the default policy,
so it stays closed. Add it yourself with `phala port-policy allow`.

## Which dstack OS version do I need?

dstack OS 0.5.9 or later. On an older image, Phala Cloud rejects a new policy
and any change to an existing one. Upgrade the OS image first.

## How do I declare a policy in `phala.toml`?

Add a top-level `[port_policy]` table:

```toml
[port_policy]
restrict_mode = true
ports = [
  { port = 8090 },
  { port = 8080 },
  { port = 8443, pp = true },
]
```

The rules:

- Both `restrict_mode` and `ports` are required.
- Each `port` is an integer from 1 to 65535. List each port once.
- `pp` is optional and defaults to `false`.
- An entry can only have `port` and `pp`. The table can only have
  `restrict_mode` and `ports`.

If the table is not valid, `phala` commands run in that directory fail until
you fix it. Only `--help` and `--version` still work. The error lists the
problem and shows an example table.

`phala deploy` sends the whole table. It does not merge it with the policy the
CVM already has. If you leave the table out, an existing CVM keeps its policy
and a new CVM gets the default above. Do not use the table together with
`--app-compose`. Choose one place to declare the policy.

Deploy asks before it closes some ports. See
[Which changes need an extra confirmation?](#which-changes-need-an-extra-confirmation)

All other `phala.toml` keys are in the [`phala.toml` reference](./phala.toml.md).

## How do I see the current policy?

```bash
phala port-policy show --cvm-id "$VM_UUID"
phala port-policy show --app-id "$APP_ID"
```

Without `--cvm-id`, `show` uses the CVM that `phala.toml` points to. To pick a
CVM from a list, pass `--interactive`. The picker needs a terminal and selects
the CVM by its VM UUID.

`show` prints the CVM name, VM UUID, compose hash, and the policy in plain
words. It also tells you when the gateway is turned off for the CVM, when an
operation is still running, and when an on-chain update is pending. Add
`--json` for machine-readable output.

`show` reads the policy declared in the CVM's app compose. It does not show an
override that Phala Cloud applies on the gateway side.

## How do policies work in an app with several instances?

Each instance has its own policy. For a request on a port, the gateway sends
traffic only to instances whose policy allows that port.

`phala port-policy show --app-id "$APP_ID"` reads the policy of every instance.
At the end it says whether the instances have the same behavior or different
behavior. It says unknown if one of the instances could not be read.

Only `show` takes `--app-id`. `allow`, `deny`, and `replace` change one CVM at a
time. To change every instance, run the command once for each VM UUID.
`phala deploy` with a `[port_policy]` table also changes one CVM: the one that
`--cvm-id` or `phala.toml` points to.

If an identifier matches more than one CVM, the command fails. Run
`phala instances ls --app-id "$APP_ID"` to list the instances, then pass the VM
UUID with `--cvm-id`. To point a project at one instance for good, set `uuid`
in `phala.toml` and remove any `id` entry. See
[Which CVM does the CLI use?](./phala.toml.md#which-cvm-does-the-cli-use).

## How do I change one CVM?

```bash
phala port-policy allow 8080 --cvm-id "$VM_UUID"
phala port-policy deny 8080 --cvm-id "$VM_UUID"
phala port-policy replace --restrict --port 8090 --port 8080 --proxy-protocol-port 8443 --cvm-id "$VM_UUID"
```

Each command shows the policy before and after the change, then asks
"Continue with this policy update?". Pass `--yes` to skip that question.

`allow` adds ports to the list. A port that is already in the list keeps its
PROXY protocol setting, unless you pass `--proxy-protocol` or
`--no-proxy-protocol`. When the policy already forwards every port, `allow`
needs one of those two flags, because it can only change the PROXY setting.

`deny` removes ports from a restricted policy. It cannot block single ports
when the policy forwards every port. Use `replace --restrict` for that. If
`deny` removes the last port in the list, the policy blocks every port.

`replace` sets the whole policy. Choose exactly one of these:

- `--restrict` with at least one `--port` or `--proxy-protocol-port`, to forward
  only those ports,
- `--no-restrict`, to forward every port; any `--proxy-protocol-port` turns on
  PROXY protocol for that port,
- `--deny-all`, to block every port,
- `--file <path>`, to read a JSON policy from a file, or `--file -` to read it
  from stdin.

Repeat `--port` and `--proxy-protocol-port` as often as you need.
`--deny-all` and `--file` cannot be combined with any other policy flag.

To change several CVMs, see
[How do policies work in an app with several instances?](#how-do-policies-work-in-an-app-with-several-instances)

## How do I copy a policy to another CVM?

Read it with `show --json`, take the `port_policy` object, and pass it to
`replace --file -`:

```bash
phala port-policy show --cvm-id "$SOURCE_VM_UUID" --json \
  | jq '.port_policy' \
  | phala port-policy replace --cvm-id "$TARGET_VM_UUID" --file - --yes
```

`show --json` always returns a `port_policy` object you can pass to `replace`.
When the source CVM has no declared policy, it returns
`{"restrict_mode": false, "ports": []}` and sets `port_policy_declared` to
`false`.

With `--file -`, stdin carries the policy, so the CLI cannot ask you anything.
Pass `--yes`, and any `--confirm-close` flag the change needs.

## Can I run these commands in a script?

Yes. In a script, in JSON mode, or with `--file -`, the CLI cannot ask
questions. Pass `--yes` to confirm the update. If the change closes port `8090`,
port `22`, or every port, also pass the matching `--confirm-close` flag. See
[Which changes need an extra confirmation?](#which-changes-need-an-extra-confirmation)

## Will my CVM restart?

A running CVM may restart. A stopped CVM stays stopped.

If the new policy behaves the same as the current one, the command makes no
change and does not restart the CVM. Two policies behave the same when they
forward the same ports with the same PROXY settings.

After Phala Cloud accepts the change, the CLI prints the operation ID. Pass
`--wait` to wait until the change is done. Otherwise, check the result with
`phala port-policy show`.

## What if someone else changes the CVM at the same time?

The CLI reads the CVM's compose hash before the change and sends it with the
change. If another update changed the CVM in between, Phala Cloud rejects the
change instead of overwriting the other update. Run `phala port-policy show`
again, check the policy, and retry.

If an on-chain update for the CVM is still pending, the CLI does not start a
new change. Wait for that update to finish, or cancel it, then retry.

## How do I change a CVM that uses on-chain KMS?

The new compose hash must be registered on-chain before the change applies.
You can let the CLI do it, or do it yourself.

To let the CLI register it, pass `--private-key` and `--rpc-url`. If you leave
them out, the CLI reads `PRIVATE_KEY` and `ETH_RPC_URL` from the environment.

To register it yourself:

1. Run the change with `--prepare-only`. The CLI prints the compose hash and the
   command to run next.
2. Register the compose hash on-chain.
3. Run the printed command with your transaction hash:

   ```bash
   phala port-policy replace --cvm-id "$VM_UUID" --yes --compose-hash "$COMPOSE_HASH" --transaction-hash "$TX_HASH"
   ```

   Do not pass any policy flags in this step. The CLI applies the policy you
   prepared in step 1.

If the CVM does not use on-chain KMS, `--prepare-only` has no effect. Phala
Cloud applies the change at once, and the CLI tells you so.

## Why did deploy put my old policy back?

Because `phala.toml` still has the old policy. `phala port-policy` changes the
CVM only. It never edits `phala.toml`. The next `phala deploy` from the project
sends the table in `phala.toml` again.

When the CVM you changed is the one `phala.toml` points to, and the file has a
different `[port_policy]`, the CLI prints a new table for you. Paste it into
`phala.toml` to keep your change.

## What happens when I close port 8090?

Phala Cloud can no longer read logs, status, or attestation data from the CVM.

Port `8090` is the guest agent. It is how Phala Cloud reads those things. You
can set access to it in three ways:

- **Open to everyone.** Anyone who can reach the gateway can reach the guest
  agent.
- **Phala Cloud only.** Change the guest agent access setting in the Phala
  Cloud console. The public is blocked, and Phala Cloud logs, status, and
  attestation keep working. The policy keeps port `8090`.
- **Closed to everyone.** Leave port `8090` out of a restricted policy. No one
  can reach the guest agent, not even Phala Cloud.

If you only want to keep the public out, use the console setting. Close port
`8090` only if you mean to cut off Phala Cloud too.

## What happens when I close port 22?

SSH through the gateway on port `22` can stop working. If you reach the CVM
over SSH this way, keep port `22` in the policy.

## Which changes need an extra confirmation?

Some changes need an extra confirmation: newly blocking port `8090`, newly
blocking port `22` on an existing CVM, or blocking every port. In a terminal,
the CLI asks. In a script, pass `--confirm-close 8090`, `--confirm-close 22`,
or `--confirm-close all`. When the policy blocks every port, only
`--confirm-close all` works, and it also covers `8090` and `22`. `--yes` does
not count as one of these confirmations.

## When should I turn on PROXY protocol?

Only when the program listening on that port expects a PROXY header before the
application data.

- The gateway writes PROXY protocol v2 headers.
- When a load balancer sits in front of the gateway, the gateway can pass on
  that balancer's header instead, which may be v1. Accept both versions.
- A listener that expects plain HTTP, TLS, or SSH may reject a connection that
  starts with a PROXY header.

Change the listener and the policy in the same deployment, so they always agree.

## Why does the CLI warn about a published port?

After an update, Phala Cloud can report TCP ports that Docker Compose publishes
but a restricted policy does not allow. The gateway does not forward traffic to
those ports. The CLI prints a warning for each one, with the command that
allows it:

```text
Published port 3000 is not allowed by the gateway policy. To allow it, run phala port-policy allow 3000 --cvm-id 550e8400-e29b-41d4-a716-446655440000.
```

If `phala.toml` declares the policy, add the port to the table instead.
Otherwise the next `phala deploy` closes it again. If you left the port out on
purpose, ignore the warning. Ports set through environment variables or picked
at run time may not show up in this warning.
