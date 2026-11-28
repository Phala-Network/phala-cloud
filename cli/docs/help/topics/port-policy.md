# Gateway port policy

Control which guest ports the gateway forwards to a CVM, and which use PROXY protocol.

The policy uses the guest port: the left side of a Docker Compose port mapping.
With `8080:80`, list `8080`. The policy does not publish container ports or
change direct node port mappings. It needs dstack OS 0.5.9 or later.

## Set it in phala.toml

    [port_policy]
    restrict_mode = true
    ports = [{ port = 8090 }, { port = 8080 }, { port = 8443, pp = true }]

`restrict_mode = true` forwards only the listed ports. An empty list forwards
no ports. `restrict_mode = false` forwards every port, and the list only picks
which ports use PROXY protocol. Both keys are required. Each port is an
integer from 1 to 65535 and appears once. `pp` defaults to `false`.

`phala deploy` sends the whole table on create and on update. Leave the table
out and an existing CVM keeps its policy. A new CVM then gets the Phala Cloud
default: the published TCP guest ports, port 8090, and port 22 when the CVM is
set up for SSH. Do not use the table together with `--app-compose`.

## Change one CVM

    phala port-policy show --cvm-id <vm_uuid>
    phala port-policy show --app-id <app_id>
    phala port-policy allow 8080 --cvm-id <vm_uuid>
    phala port-policy deny 8080 --cvm-id <vm_uuid>
    phala port-policy replace --restrict --port 8090 --port 8080 --cvm-id <vm_uuid>

Without `--cvm-id`, the commands use the CVM in `phala.toml`. `--interactive`
picks a CVM from a list and needs a terminal. Only `show` takes `--app-id`,
to read every instance of an app. Each instance has its own policy.

A running CVM may restart. A stopped CVM stays stopped. If the new policy
behaves the same as the current one, nothing changes. Pass `--wait` to wait
for the change. `phala port-policy` never edits `phala.toml`, so the next
`phala deploy` puts the table's policy back.

## Confirm closing a port

Some changes need an extra confirmation: newly blocking port 8090, newly
blocking port 22 on an existing CVM, or blocking every port. In a terminal,
the CLI asks. In a script, pass `--confirm-close 8090`, `--confirm-close 22`,
or `--confirm-close all`. When the policy blocks every port, only
`--confirm-close all` works, and it also covers 8090 and 22. `--yes` does not
count as one of these confirmations. In scripts and JSON mode, also pass
`--yes` to confirm the update itself.

Closing port 8090 stops Phala Cloud from reading logs, status, and attestation
data from the CVM. To keep the public out but keep Phala Cloud access, change
the guest agent access setting in the Phala Cloud console instead. Closing
port 22 can cut off SSH through the gateway.

Turn on PROXY protocol only for a listener that expects a PROXY header.

## More

Run `phala port-policy <command> --help` for every option. This command is
unstable. CLI releases without it ignore `[port_policy]` without a warning.
