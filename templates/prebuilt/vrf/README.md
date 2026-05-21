# VRF in TEE

Deploy a VRF generator on Phala Cloud.

This template runs the VRF off-chain service inside a TEE-enabled container. The service connects to an EVM RPC endpoint, watches the configured contract, and serves the VRF app on port `3000`.

## Services

- `app`: VRF off-chain dstack service.

## Ports

- `3000`: VRF app endpoint.

## Required environment variables

- `RPC_URL`: RPC endpoint for the target EVM chain.
- `CONTRACT_ADDRESS`: VRF contract address that the service should use.

## Mounted sockets

- `/var/run/tappd.sock`: TEE attestation socket mounted into the app container.

## Deploy

1. Deploy or identify the VRF contract for your target chain.
2. Set `RPC_URL` and `CONTRACT_ADDRESS` in Phala Cloud.
3. Deploy the template.
4. Open `https://<your-app-domain>` or call the exposed API on port `3000`.

## Verify

```bash
curl -I https://<your-app-domain>
```

Check container logs if the app starts but cannot reach the target chain. RPC connectivity and contract address correctness are the two main runtime dependencies.
