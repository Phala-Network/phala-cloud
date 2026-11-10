# phala ssh

Connect to a CVM via SSH through the Phala Cloud gateway.

## Usage

    phala ssh [cvm-id] [options] [-- ssh-options]

## Arguments

| Name | Required | Description |
|------|----------|-------------|
| `cvm-id` | No | CVM ID, UUID, or name (uses linked CVM if omitted) |

## Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--port <port>` | `-p` | 443 | Gateway port (priority: CLI > phala.toml > 443) |
| `--gateway <domain>` | `-g` | | Gateway domain (priority: CLI > phala.toml > API) |
| `--timeout <seconds>` | `-t` | 30 | Connection timeout |
| `--verbose` | `-v` | false | Show verbose connection details |
| `--dry-run` | | false | Print SSH command without executing |

## Pass-through Options

All arguments after `--` are passed directly to ssh. Trailing arguments are executed as remote commands.

Common pass-through options:
- `-i` — SSH identity file
- `-L` — Local port forwarding
- `-R` — Remote port forwarding
- `-D` — SOCKS proxy
- `-N` — No command (useful with port forwarding)
- `-v` — SSH verbose mode

Note: `-o ProxyCommand` is blocked for security reasons.

## HTTP Proxy

`phala ssh` and `phala cp` reach the gateway with `openssl s_client` as the SSH `ProxyCommand`. When `HTTPS_PROXY` (or `https_proxy`, which takes precedence) is set, the CLI adds `-proxy <host>:<port>` so the TLS connection goes through the proxy with HTTP CONNECT:

    $ HTTPS_PROXY=http://proxy.example.com:3128 phala ssh

`NO_PROXY` (or `no_proxy`) skips the proxy for matching hosts. It is a comma-separated list; each entry matches the host or any of its subdomains, with or without a leading dot, and `*` disables the proxy for every host.

Limits:

- Only `http://` proxies are supported. A value without a scheme is treated as `http://`, and the port defaults to 80. An `https://` or `socks5://` proxy fails with an error instead of connecting directly.
- Proxy credentials in the URL (`http://user:pass@host:port`) are not supported and fail with an error, so a password never ends up on the `ssh` command line.
- `HTTP_PROXY` and `ALL_PROXY` are not read. `NO_PROXY` entries with a port or a CIDR range are not matched.
- Requires an `openssl` with `s_client -proxy`: OpenSSL 1.1.0 or later, or LibreSSL (tested with LibreSSL 3.3.6 as shipped with macOS).

## Examples

Connect to linked CVM:

    $ phala ssh

Connect to specific CVM:

    $ phala ssh app_abc123

Forward local port 8080 to remote port 80:

    $ phala ssh -- -L 8080:localhost:80

Execute remote command:

    $ phala ssh -- ls /app

Print SSH command without executing:

    $ phala ssh --dry-run

Connect with verbose details:

    $ phala ssh --verbose

Use custom SSH identity:

    $ phala ssh -- -i ~/.ssh/custom_key

Set up SOCKS proxy on port 1080:

    $ phala ssh -- -D 1080 -N
