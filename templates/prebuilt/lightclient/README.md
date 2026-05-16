# TEE Coprocessors in Dstack

This Phala Cloud prebuilt template runs the Helios Ethereum light client inside a Dstack CVM, queries the latest block through Helios, and requests a tappd attestation over the hash of the captured block response.

It is maintained locally so Phala Cloud users are not blocked on upstream template changes.

## Source

- Upstream repository: https://github.com/Dstack-TEE/dstack-examples
- Upstream template path: `tutorial/07-lightclient/`
- Inspected upstream commit: `50d05e0e2b3c8703e6abf1e21c63a8447f4fd34a`
- Upstream license: Apache License 2.0
- Base image: `ubuntu:24.04@sha256:b59d21599a2b151e23eea5f6602f4af4d7d31c4e236d22bf0b62b86d2e386b8f`

This template keeps the upstream shape: inline Dockerfile, Foundry `cast`, Helios, and `/var/run/tappd.sock`. It follows the maintained upstream tutorial behavior for Helios `0.11.0` on mainnet with fallback checkpoint endpoint `https://sync-mainnet.beaconcha.in`, while keeping `ETH_RPC_URL` required for Phala Cloud deployment. The local runtime script uses `set -euo pipefail`, waits for `eth_blockNumber`, retries `cast block`, prints block data, hashes `response.txt`, then requests the tappd quote.

## Runtime Dependency Note

The original external lightclient template used Holesky with consensus endpoint `http://testing.holesky.beacon-api.nimbus.team`. That endpoint is currently unavailable from the CVM runtime and caused Helios to fail syncing with `could not fetch bootstrap`. This local Phala-maintained template avoids that external Holesky runtime dependency by using mainnet Helios with the fallback checkpoint endpoint from `tutorial/07-lightclient`.

## Environment

- `ETH_RPC_URL` (required): Ethereum execution RPC URL used by Helios as its untrusted execution RPC.

Use a credentialed RPC endpoint for production or long-lived deployments. A public uncredentialed RPC endpoint is only appropriate for smoke testing because it may be rate-limited, unavailable, or shared with unrelated users.

## Behavior

The service is a one-shot smoke/evidence job. It does not expose public ports.

At runtime it:

1. Starts Helios mainnet on `127.0.0.1:8545`.
2. Polls `eth_blockNumber` on `localhost:8545` for up to five minutes.
3. Retries `cast block latest --rpc-url http://127.0.0.1:8545`.
4. Writes the block output to `response.txt` and prints it to logs.
5. Computes `sha256sum response.txt`.
6. Sends the hash as tappd `report_data`.
7. Appends and prints `ATTEST=<tappd response>`.

The template intentionally does not redact output. Do not put secrets in values that are expected to be printed by the workload.

## Expected Smoke Evidence

A successful Phala Cloud smoke run should show:

- Helios startup logs, including an RPC listener on `127.0.0.1:8545`.
- `Helios eth_blockNumber ready: 0x...`.
- `Fetching latest block through Helios`.
- `cast block` output with block fields such as `hash`, `number`, `timestamp`, `transactions`, and gas fields.
- `response.txt sha256=<64 hex characters>`.
- `ATTEST=...` from `/var/run/tappd.sock`.

If Helios cannot sync or the RPC endpoint is invalid, the container should exit non-zero after the retry window instead of producing attestation-only evidence.

## Local Checks

From the repository root:

```bash
ETH_RPC_URL=https://ethereum-rpc.publicnode.com docker compose -f templates/prebuilt/lightclient/docker-compose.yml config
python3 templates/validate.py
git diff --check
```

The `docker compose config` command only validates the template shape. It does not contact the RPC endpoint unless the service is built or run.

## Update Procedure

1. Inspect the current upstream `Dstack-TEE/dstack-examples/tutorial/07-lightclient` files and record the source commit in this README.
2. Compare upstream Dockerfile, Helios, Foundry, network, fallback checkpoint endpoint, and tappd request changes against this local template.
3. Keep the template self-contained with `dockerfile_inline` and `configs.run.sh.content`; do not depend on deploy-time files from the upstream repository.
4. Keep the Ubuntu base image pinned by digest and verify that the digest is still available for `linux/amd64`.
5. Re-run the local checks above.
6. Deploy a Phala Cloud smoke instance with a safe RPC URL and confirm the smoke evidence includes block data and an attestation.

Do not commit real RPC credentials or smoke secrets to this directory.
