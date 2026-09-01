# Environment Variables

All environment variables recognized by the Phala CLI. Command-line flags always take precedence over environment variables when both are set.

## Authentication

- `PHALA_CLOUD_API_KEY` — API token. Overrides the token stored by `phala login`.
- `PHALA_OIDC_TOKEN` — GitHub Actions OIDC JWT. Sent as `Authorization: Bearer`. Used for keyless CI deploy when no API key is set. Prefer API key when both are present.
- `PHALA_CLOUD_WORKSPACE` — Workspace slug sent as `X-Phala-Workspace` (needed when a GitHub repo is trusted in multiple workspaces).
- `PHALA_CLOUD_API_PREFIX` — API base URL. Default: `https://cloud-api.phala.com/api/v1`.

The `@phala/cloud` JS SDK also reads both directly when `createClient()` is
called without explicit config.

## On-chain KMS

These variables apply to `deploy`, `allow-devices`, `cvms replicate`, and
`envs update` when the CVM uses Ethereum or Base KMS:

- `PRIVATE_KEY` — Private key for signing on-chain transactions.
  Precedence: `--private-key` > `PRIVATE_KEY`.
- `ETH_RPC_URL` — RPC endpoint. Follows the foundry/cast convention, so an
  existing `ETH_RPC_URL` from those tools works automatically.
  Precedence: `--rpc-url` > `ETH_RPC_URL` > chain default.

Example:

    export ETH_RPC_URL=https://mainnet.base.org
    export PRIVATE_KEY=0x...
    phala deploy --kms base

## Debug logging

`DEBUG` has two independent consumers that behave differently:

- **CLI debug output** — any non-empty value enables the CLI's own debug
  messages on stderr (gray prefix).
- **API request logging** — the `@phala/cloud` JS SDK uses the `debug` npm
  package with namespace `phala::api-client`. Set `DEBUG=phala::api-client`
  to print every HTTP request in cURL-like format (method, URL, headers,
  body).

Examples:

    # CLI debug only
    DEBUG=1 phala deploy

    # API request cURL logging (also triggers CLI debug, since "phala::api-client" is truthy)
    DEBUG=phala::api-client phala deploy

    # Everything
    DEBUG=* phala deploy

## Self-update

- `PHALA_UPDATE_CHANNEL` — Release channel for `phala self update` (e.g. `latest`, `beta`).
- `PHALA_DISABLE_UPDATE_CHECK` — Any truthy value disables the background update notice.
- `CI` — Standard CI flag. Any truthy value disables the update notice.

## Miscellaneous

- `CLOUD_URL` — Override the Phala Cloud portal URL used in printed links.
  Default: `https://cloud.phala.com`.

## Internal (undocumented)

- `PHALA_CLOUD_DIR` — Override the credentials directory. Default: `~/.phala-cloud`.
  Testing only.

## See also

- `phala api --help` for API-specific flags and env vars
- `phala login --help` for authentication flow
- `phala deploy --help` for on-chain KMS flags
