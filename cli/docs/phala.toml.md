# `phala.toml` reference

`phala.toml` links a project directory to a CVM and stores defaults for the
`phala` commands you run there. The CLI reads it from the directory you run
`phala` in. Every key is optional.

Do not put API keys or environment variable values in this file. Keep secrets
in the file that `env_file` points to, and do not commit that file.

```toml
uuid = "550e8400-e29b-41d4-a716-446655440000"
profile = "production"
compose_file = "docker-compose.yml"
env_file = ".env.production"
public_logs = false

[port_policy]
restrict_mode = true
ports = [{ port = 8090 }, { port = 8080 }]
```

If the file is not valid, `phala` commands run in that directory fail until you
fix it, and the error says which key is wrong. Only `--help` and `--version`
still work.

## Which CVM does the CLI use?

When you do not pick a CVM on the command line, the CLI uses the first of these
keys that is set, in this order:

| Key | Type | What it selects |
| --- | --- | --- |
| `id` | String | Any identifier Phala Cloud accepts, such as a VM UUID, an App ID, or a name. |
| `uuid` | String | One CVM by its VM UUID, with or without hyphens. Use this to pick one instance of an app with several instances. |
| `app_id` | String | An app by its App ID. If the app has several instances and the command needs one CVM, the command fails. Use `uuid` instead. |
| `instance_id` | String | An instance by its instance ID. Write it with the `instance_` prefix, or the CLI reads it as an App ID. |
| `name` | String | A CVM by name. A name has 5 to 63 letters, digits, or hyphens, and starts with a letter. |

`phala link` writes both `app_id` and `name`, so the CLI uses `app_id`. To point
the project at one instance, set `uuid` and remove any `id` entry.

`--cvm-id` on the command line wins over this file. Commands that support
`--interactive` let you pick a CVM from a list instead. If no identifier is set
anywhere, `phala deploy` creates a new CVM.

## Which defaults can I set?

| Key | Type | What it does |
| --- | --- | --- |
| `profile` | String | The saved login profile to use. `--profile` and `PHALA_CLOUD_PROFILE` win over it. |
| `api_version` | String | Checked against the supported API versions, but no command reads it. Use `--api-version` to pick a version. |
| `gateway_domain` | String | The gateway domain for `phala ssh` and `phala cp`. `--gateway` wins over it. |
| `gateway_port` | Positive integer | The gateway port for `phala ssh` and `phala cp`. `--port` wins over it. Default: `443`. |
| `compose_file` | String | The Docker Compose file `phala deploy` uses when you do not pass `--compose`. |
| `env_file` | String | The environment file `phala deploy` uses when you do not pass `-e`. It can hold secrets, so do not commit it. |
| `port_policy` | Table | Which guest ports the gateway forwards, and which use PROXY protocol. See [`[port_policy]`](#port_policy). |

## Which keys apply only when a CVM is created?

These keys are read only when `phala deploy` creates a new CVM. An update of an
existing CVM ignores them. To change these settings on an existing CVM, pass the
matching `phala deploy` flag.

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `public_logs` | Boolean | `true` | Anyone can read the CVM's guest logs without logging in. |
| `public_sysinfo` | Boolean | `true` | Anyone can read the CVM's system information without logging in. |
| `public_tcbinfo` | Boolean | `true` | Anyone can read the CVM's attestation data without logging in. |
| `secure_time` | Boolean | `false` | Turns secure time in the guest on or off. |
| `listed` | Boolean | `false` | Lists the CVM on the public Trust Center. |

A `phala deploy` flag wins over the key in this file.

## `[port_policy]`

The table tells the gateway which guest ports it may forward. Unlike the keys
above, `phala deploy` applies it both when it creates a CVM and when it updates
one.

| Key | Type | What it does |
| --- | --- | --- |
| `restrict_mode` | Boolean | Required. `true` forwards only the listed ports. `false` forwards every port. |
| `ports` | Array of tables | Required. Each entry has a `port` from 1 to 65535 and an optional `pp` boolean. `pp = true` turns on PROXY protocol for that port. `pp` defaults to `false`. |

List each port once. An entry can only have `port` and `pp`, and the table can
only have `restrict_mode` and `ports`.

List the guest port, not the container port. For `8080:80` in Docker Compose,
list `8080`. A restricted policy with an empty list forwards no ports. When
`restrict_mode = false`, the list only picks which ports use PROXY protocol.

`phala deploy` sends the whole table. It does not merge it with the policy the
CVM already has. If you leave the table out, an existing CVM keeps its policy,
and a new CVM gets the Phala Cloud default. Do not use the table together with
`--app-compose`.

Some changes need an extra confirmation: newly blocking port `8090`, newly
blocking port `22` on an existing CVM, or blocking every port. In a terminal,
the CLI asks. In a script, pass `--confirm-close 8090`, `--confirm-close 22`,
or `--confirm-close all`. When the policy blocks every port, only
`--confirm-close all` works, and it also covers `8090` and `22`. `--yes` does
not count as one of these confirmations.

`phala port-policy` changes the CVM only. It never edits this table, so the
next `phala deploy` puts the table's policy back. `phala link` keeps the table
as written when it rewrites the file.

CLI releases that do not have `phala port-policy` ignore this table without a
warning.

The [Gateway port policy](./port-policy.md) guide explains the default policy,
the dstack OS version you need, and what closing port `8090` or `22` does.
