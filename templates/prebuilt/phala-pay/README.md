# Phala Pay

[Phala Pay](https://github.com/Phala-Network/phala-pay) v0.13.1 is non-custodial payment software with price-locking quotes on each customer's fixed deposit address per chain.
This **testnet quick start** accepts PHA, USDC and USDT on Sepolia, and USDC on Base Sepolia.
Its `docker-compose.yml` is the release's `phala-cloud-template.yml` byte for byte, with immutable image digests.
For production, follow the [self-hosting guide][self-hosting].

[![Deploy on Phala Cloud](https://cloud.phala.com/deploy-button.svg)](https://cloud.phala.com/templates/phala-pay)

## Environment fields

Values go into Phala Cloud's encrypted environment.

| Variable | Required | Value |
| --- | --- | --- |
| `TOPUP_ADMIN_PUBLIC_KEY` | yes | Admin public key generated below; keep its seed offline. |
| `TOPUP_RPC_ANKR_KEY` | yes | Ankr read API key with access to Sepolia, Base Sepolia, Ethereum and Base (prices). |
| `TOPUP_RPC_INFURA_KEY` | yes | Infura verify API key for the same four chains. |
| `AWS_ENDPOINT` | yes | S3-compatible HTTPS endpoint, e.g. `https://<account>.r2.cloudflarestorage.com`. |
| `AWS_ACCESS_KEY_ID` | yes | Access key with read/write access to this deployment's backup prefix. |
| `AWS_SECRET_ACCESS_KEY` | yes | Secret half of the backup access key. |
| `AWS_REGION` | yes | `auto` for R2 (default), or the bucket's region for other stores. |
| `WALG_S3_PREFIX` | yes | `s3://BUCKET/PATH`, empty and used by no other deployment. |
| `SENTRY_DSN` | no | Optional Sentry DSN; omit to disable reporting. |

## Deploy

1. [Verify v0.13.1 and prepare its deploy kit][verify-release], including the locked Phala Cloud CLI, at `kit/`. Authenticate with `kit/deploy/phala login` or `PHALA_CLOUD_API_KEY`.
2. Generate the admin key on your own machine (Python 3.12+ and uv); use the printed `public_key` for `TOPUP_ADMIN_PUBLIC_KEY`. Never upload `admin.seed`:

   ```sh
   uvx --from phala-pay==0.13.1 topup-sdk keygen --keyid admin/v1 --seed-out ~/phala-pay/admin.seed
   ```

3. Create the backup bucket/prefix and obtain both RPC keys. Put the required fields above in `phala-pay.env` and keep that file private.
4. From this directory, deploy with the release's pre-launch script, 2 vCPU / 4 GB RAM / 20 GB disk, and the approved non-dev `dstack-0.6.1` image:

   ```sh
   kit/deploy/phala deploy -n phala-pay -c docker-compose.yml -e phala-pay.env -t tdx.medium \
     --pre-launch-script kit/deploy/phala-cloud-pre-launch.sh --fs ext4 --kms phala \
     --disk-size 20G --image dstack-0.6.1 --no-dev-os --no-public-logs --no-public-sysinfo \
     --public-tcbinfo --secure-time
   ```

5. Wait for startup, then check the app's gateway URL, without a `-80` suffix in the host:

   ```sh
   ORIGIN='https://<app-id>.<gateway-domain>'
   curl -fsS -o /dev/null -w '%{http_code}\n' "$ORIGIN/healthz"  # 200
   curl -fsS "$ORIGIN/openapi.json" | jq -r .info.version       # 0.13.1
   ```

For the interactive one-command alternative and its prerequisites, see [One-command deploy][one-command].

## Verify attestation

Before creating accounts, set `CVM_ID` to the deployed CVM's id and use the verified kit:

```sh
kit/deploy/phala cvms get "$CVM_ID" --json > cvm.json
kit/deploy/phala cvms attestation "$CVM_ID" --json > attestation.json
APP_ID=$(jq -er '.app_id' cvm.json)
GATEWAY_DOMAIN=$(jq -er '.gateway.base_domain' cvm.json)
curl -fsS "https://${APP_ID#0x}-8090.$GATEWAY_DOMAIN/prpc/Info" > info.json
kit/deploy/verify-attestation.sh attestation.json info.json "$APP_ID" docker-compose.yml template \
  "$(cat kit/deploy/environments/phala-cloud-template/topup/os-image-hash)"
```

The verifier checks the TDX quote, TCB, OS image, app id, compose and template policy.
The admin public key, public origin and backup location come from runtime environment values and are **not attested**; the template also has **no restore-check path**.
See the [template's trust limits][template] before using it beyond testnets.

For account onboarding, backups, upgrades and production deployment, use the [v0.13.1 self-hosting guide][self-hosting].
For merchant keys, treasury setup, payment settings, checkout and verified webhooks, use the [v0.13.1 integration guide][integration].

[self-hosting]: https://github.com/Phala-Network/phala-pay/blob/v0.13.1/docs/self-hosting.md
[integration]: https://github.com/Phala-Network/phala-pay/blob/v0.13.1/docs/integration.md
[verify-release]: https://github.com/Phala-Network/phala-pay/blob/v0.13.1/docs/self-hosting.md#2-your-environment-repository
[one-command]: https://github.com/Phala-Network/phala-pay/blob/v0.13.1/docs/self-hosting.md#one-command-deploy
[template]: https://github.com/Phala-Network/phala-pay/blob/v0.13.1/docs/self-hosting.md#the-phala-cloud-template
