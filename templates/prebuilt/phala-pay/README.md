# Phala Pay

[Phala Pay](https://github.com/Phala-Network/phala-pay) is open-source, non-custodial crypto
payments software with a Stripe-shaped API: quotes, deposit addresses that can only pay the
merchant's own treasury, refunds, and webhooks signed with keys that merchants pin from the CVM's
attestation. The service holds no funds and sends no transactions.

This template is a **testnet quick start**: one Phala Pay instance in a Phala Cloud CVM, serving the
same four test routes as Phala's staging instance, at the app's Phala Cloud domain. For a
production instance whose merchants verify the service, follow Phala Pay's
[self-hosting guide](https://github.com/Phala-Network/phala-pay/blob/main/docs/self-hosting.md)
instead (see [What the attestation covers](#what-the-attestation-covers)).

[![Deploy on Phala Cloud](https://cloud.phala.com/deploy-button.svg)](https://cloud.phala.com/templates/phala-pay)

## What it deploys

The service variant of Phala Pay's
[`deploy/docker-compose.yml`](https://github.com/Phala-Network/phala-pay/blob/main/deploy/docker-compose.yml)
at commit `51f07b3c2cf0`, with the images of its
[Release images run 36643452638](https://github.com/Phala-Network/phala-pay/actions/runs/36643452638),
pinned by digest:

| Service | Image | What it does |
| --- | --- | --- |
| `keys` | `phala-pay` | Derives the database passwords and the backup encryption key from the app's KMS keys into tmpfs volumes. With `topup`, the only container with the dstack socket. |
| `postgres` | `postgres-walg` | PostgreSQL 18 with WAL-G. Archives WAL every minute to your bucket. |
| `migrate` | `phala-pay` | One-shot schema migration. |
| `topup` | `phala-pay` | The API and the chain scanners, on port 80 behind the Phala Cloud gateway. |
| `smokescreen` | `phala-pay` | Stripe's smokescreen: every webhook delivery leaves through it, and it refuses any address that is not publicly routable (private ranges, loopback, cloud metadata). |
| `heartbeat` | `phala-pay` | Liveness heartbeat. |
| `backup` | `postgres-walg` | An encrypted WAL-G base backup every day at 03:00 UTC, keeping seven. |

- `ghcr.io/phala-network/phala-pay@sha256:dc89124852faf922177c9eacc9235ad6f31c07cd0803e416044850d407613789`
  (bit-for-bit reproducible from the commit)
- `ghcr.io/phala-network/postgres-walg@sha256:6df9588c21e57cdbedbae216575fa39ed5693cd6a4a0a9268441590ead7f445a`

Each service mounts only the credentials it needs: `topup` and `heartbeat` see only the application
login, never the database owner's password or the backup key, and no environment variable carries a
database password. `topup` is the only published port.

**Routes.** Four test-mode routes (`livemode: false`), inlined as compose configs exactly as in
Phala Pay's [`deploy/config/routes/`](https://github.com/Phala-Network/phala-pay/tree/main/deploy/config/routes):

| Route | Chain | Token |
| --- | --- | --- |
| `phala-cloud-sepolia-pha-usd` | Sepolia (11155111), credited at 2 confirmations | test PHA `0x8F40e7E99678F44c88158f049E62817580ab113B` (`mint` is public) |
| `phala-cloud-sepolia-usdc-usd` | Sepolia | Circle test USDC `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` ([faucet](https://faucet.circle.com)) |
| `phala-cloud-base-sepolia-pha-usd` | Base Sepolia (84532), credited at the `safe` head | test PHA `0x1a6F260377e42ead1418C7C1afDFD5DE371A9284` (`mint` is public) |
| `phala-cloud-base-sepolia-usdc-usd` | Base Sepolia | Circle test USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` ([faucet](https://faucet.circle.com)) |

Every route uses the permissionless forwarder factory `0x45466D37587E6E46DC35eB96b74ba3D3b1E5b747`
(implementation `0x49F2F1F1a25269Ea0C6FF2AB1C7B09dCBE9c5bA9`), deployed at the same address on
every chain. `topup` refuses to start unless each RPC provider shows exactly that code there.

**Public origin.** `https://${DSTACK_APP_DOMAIN}`, the app's Phala Cloud domain
(`<app-id>.<gateway-domain>`, which the gateway serves from port 80). The admin API verifies every
signed request against this origin, and treasury proofs (EIP-4361) name it, so always call the
service at exactly this URL.

Default size: 2 vCPU, 4 GB memory, 20 GB disk, the `tdx.medium` that Phala Pay's own deploy uses.

## Before you deploy

1. **The admin key.** Only the admin creates merchant accounts, and every admin call is signed. On
   your own machine (Python 3.12 or later):

   ```sh
   pip install phala-pay
   topup-sdk keygen --keyid admin/v1 --seed-out ~/phala-pay/admin.seed
   ```

   It prints `{"keyid": "admin/v1", "public_key": "…"}`. The `public_key` is
   `TOPUP_ADMIN_PUBLIC_KEY`. The seed stays on your machine: keep it offline, and never put it in
   the CVM. The template sets the key id to `admin/v1`.
2. **A backup bucket.** An S3-compatible bucket (Cloudflare R2, AWS S3, and so on), an **empty**
   prefix for this deployment, and a token with read and write access to it only. PostgreSQL does
   not start until it can list that prefix, so the CVM stays unhealthy until the bucket settings
   are right.
3. **RPC providers (optional).** The defaults are the keyless public endpoints Phala's staging
   uses. They are rate-limited; for anything beyond a trial, use two paid providers per chain from
   different companies.

## Form fields

All of them go into Phala Cloud's encrypted environment.

| Variable | Required | Default | What it is |
| --- | --- | --- | --- |
| `TOPUP_ADMIN_PUBLIC_KEY` | yes | | The admin key's `public_key` from `topup-sdk keygen`. |
| `AWS_ENDPOINT` | yes | | The store's endpoint, for example `https://<account>.r2.cloudflarestorage.com` or `https://s3.us-east-1.amazonaws.com`. |
| `AWS_ACCESS_KEY_ID` | yes | | Access key for the backup prefix. |
| `AWS_SECRET_ACCESS_KEY` | yes | | Its secret. |
| `AWS_REGION` | yes | `auto` | `auto` for R2; the bucket's region for AWS S3 and other stores. Requests use path-style addressing. |
| `WALG_S3_PREFIX` | yes | | `s3://BUCKET/PATH`, empty and used by no other deployment. |
| `TOPUP_RPC_PROVIDER_A_URL` | yes | `https://sepolia.gateway.tenderly.co` | Sepolia provider A. It makes every log request, so it must serve `eth_getLogs` over 2,000 blocks and without a contract address. |
| `TOPUP_RPC_PROVIDER_B_URL` | yes | `https://ethereum-sepolia-rpc.publicnode.com` | Sepolia provider B (receipts, heads, calls), from a different company. |
| `TOPUP_RPC_BASE_SEPOLIA_A_URL` | yes | `https://base-sepolia.gateway.tenderly.co` | Base Sepolia provider A, with the same log requirements. |
| `TOPUP_RPC_BASE_SEPOLIA_B_URL` | yes | `https://base-sepolia-rpc.publicnode.com` | Base Sepolia provider B. |
| `TOPUP_RPC_<ID>_KEY` | no | empty | For a provider that puts an API key in its URL: write `{key}` in the URL where the key goes (`https://eth-sepolia.g.alchemy.com/v2/{key}`) and the key here. One per URL above: `TOPUP_RPC_PROVIDER_A_KEY`, `TOPUP_RPC_PROVIDER_B_KEY`, `TOPUP_RPC_BASE_SEPOLIA_A_KEY`, `TOPUP_RPC_BASE_SEPOLIA_B_KEY`. Leave it empty for a keyless URL; `topup` refuses a URL and key that disagree. |
| `SENTRY_DSN` | no | empty | Sentry project DSN for errors, alerts, and Crons monitors. Empty turns reporting off. |

Everything else is fixed in the compose: the key id `admin/v1`, the public origin, the service
mode, path-style S3 requests, the webhook proxy, and the Sentry environment `testnet`.

**Choose the `dstack-0.5.9` OS image** (non-dev). The service speaks the dstack 0.5 guest API
and is built and tested only on `dstack-0.5.9`; it has not been tested on dstack 0.6. The deploy
form preselects the newest non-dev image the chosen node offers, which is `dstack-0.5.9` today
but becomes a 0.6 image once the node offers one, so check the field. With the CLI, pass
`--image dstack-0.5.9`: without it, `phala deploy` picks a dev image unless you add
`--no-dev-os`.

The OS image also fixes the instance's keys: the backup key, the database passwords, and every
account's webhook keys are derived by the image's guest agent, and dstack 0.6 derives different
ones for the same app. Moving an existing instance to another major OS version therefore loses
its backups (they no longer decrypt) and changes the webhook keys merchants pinned.

Phala Pay's own deploy also turns off public logs and public system info. If your deploy form
offers those options, turn them off too. With public logs off, container logs are hidden from you
as well: `phala logs` and the dashboard refuse them.

## What the attestation covers

**The template's settings are not covered by the attestation.** They arrive as Phala Cloud's
encrypted environment, which keeps them secret from the host but outside the compose hash. The
attestation proves this compose file, its pinned images, and the names of the allowed environment
variables. It does not prove which values they hold: the admin public key, the RPC endpoints, and
the backup location. Whoever controls the Phala Cloud workspace can change those values with an env
update, without changing the compose hash. For example, they could swap in their own admin key and
create accounts, or point the service at an RPC endpoint that reports false deposits.

Phala Pay's own GitHub Actions deploy is different: it renders every public setting into the
attested compose and keeps only secrets (object-store and RPC API keys, the Sentry DSN) in the
encrypted environment, so merchants can verify the settings too. It also serves a custom domain
with TLS terminated inside the CVM by dstack-ingress, with certificate evidence. This template
relies on the Phala Cloud gateway's TLS for the app domain instead.

That is fine for trying Phala Pay on testnets. For a production instance whose merchants verify the
service, deploy as the
[self-hosting guide](https://github.com/Phala-Network/phala-pay/blob/main/docs/self-hosting.md)
describes.

## After deploy

`ORIGIN` below is `https://<app-id>.<gateway-domain>`, the value of `https://${DSTACK_APP_DOMAIN}`.
If the dashboard shows the endpoint as `https://<app-id>-80.<gateway-domain>`, drop the `-80`:
signed admin requests to any other host are refused with `401`.

### 1. Health check

```sh
curl -fsS -o /dev/null -w '%{http_code}\n' "$ORIGIN/healthz"    # 200
curl -fsS "$ORIGIN/openapi.json" | jq -r .info.version
```

The first start takes a minute or two: `keys` derives the credentials, PostgreSQL lists the empty
backup prefix and initialises, `migrate` runs, and `topup` checks the factory on both chains.
Backups have started once a WAL segment is listed (with the bucket settings of
[Form fields](#form-fields) in your shell; a new database also takes its first base backup, under
`basebackups_005/`, within a minute):

```sh
aws s3 ls "${WALG_S3_PREFIX%/}/wal_005/" --endpoint-url "$AWS_ENDPOINT" | tail -1
```

### 2. Verify the attestation

With the [Phala CLI](https://github.com/Phala-Network/phala-cloud/tree/main/cli) and your CVM id:

```sh
npx --yes phala cvms attestation "$CVM_ID" --json > attestation.json
# The attested app-compose must hold exactly this template's compose file.
jq -j '.compose_file | fromjson | .docker_compose_file' attestation.json | diff - docker-compose.yml
jq -j '.compose_file' attestation.json | sha256sum    # the compose hash
```

Then check the quote with the official dstack verifier, either on the
[Phala Trust Center](https://trust.phala.com) page of the app or locally with Phala Pay's
[`deploy/dstack-verifier.sh`](https://github.com/Phala-Network/phala-pay/blob/main/deploy/dstack-verifier.sh)
(it runs the pinned `dstacktee/dstack-verifier` image). The verifier checks the TDX quote and TCB,
replays the event log, and reports the app id and compose hash, which must match the values above.

Merchants run the same check on the nonce-bound attestation the service returns to each account,
before they pin their webhook keys (step 4). From a checkout of Phala Pay, with a secret key of the
account ([step 3](#3-onboard-the-first-account)):

```sh
NONCE=$(openssl rand -hex 32)
curl -fsS -H "Authorization: Bearer $SECRET_KEY" "$ORIGIN/v1/attestation?nonce=$NONCE" > public-attestation.json
jq '{quote: null, attestation: .tdx_quote}' public-attestation.json |
  deploy/dstack-verifier.sh > public-verification.json
jq '.details | {tcb_status, app_id: .app_info.app_id, compose_hash: .app_info.compose_hash}' public-verification.json
```

`topup_sdk.verify_attestation_binding` in the Python SDK then checks that the report data binds the
nonce, the account, the mode, and the listed webhook keys
([integration guide §5.3](https://github.com/Phala-Network/phala-pay/blob/main/docs/integration.md#53-pin-your-accounts-webhook-keys)).

### 3. Onboard the first account

Accounts are created only by the admin; there is no signup. With `phala-pay` installed and the seed
from [Before you deploy](#before-you-deploy):

```python
import json

import httpx
from topup_sdk import RequestSigner

ORIGIN = "https://<app-id>.<gateway-domain>"
signer = RequestSigner.from_seed_file("admin/v1", "admin.seed")
body = json.dumps({
    "name": "Acme",
    "contact": {"name": "Jane Doe", "email": "security@acme.example"},
    "due_diligence": {"reference": "KYB-001", "reviewed_at": "2026-09-29", "reviewed_by": "ops"},
    "charges_enabled": False,
    "reason": "first test account",
}).encode()
headers = signer.sign("POST", f"{ORIGIN}/v1/admin/accounts", body)
response = httpx.post(f"{ORIGIN}/v1/admin/accounts", content=body,
                      headers={**headers, "content-type": "application/json"})
response.raise_for_status()
account = response.json()
print(account["id"])  # acct_…; account["api_keys"] holds the first secret test key, shown only here
```

`charges_enabled: false` keeps the account in test mode, which is all this template's routes serve.
Hand the secret key (`ppay_sk_test_…`) to the merchant through an encrypted channel and delete the
response. The merchant rolls it at once. The other admin calls (daily report, pauses, metrics,
recovery keys) are in Phala Pay's
[operator onboarding](https://github.com/Phala-Network/phala-pay/blob/main/deploy/README.md#operator-onboarding)
and [runbooks](https://github.com/Phala-Network/phala-pay/blob/main/deploy/runbooks/README.md).

### 4. A first test deposit

The merchant does the rest with its own keys against `ORIGIN`, as
[pay.phala.com](https://pay.phala.com/)'s demo does against Phala's staging instance. In the
Python SDK (`pip install 'phala-pay[eoa]'`), every call below is on

```python
from phala_pay import PhalaPay

pay = PhalaPay(ORIGIN, SECRET_KEY, forwarder=(
    "0x45466D37587E6E46DC35eB96b74ba3D3b1E5b747",  # factory
    "0x49F2F1F1a25269Ea0C6FF2AB1C7B09dCBE9c5bA9",  # implementation
))
```

1. Roll the first key with `pay.api_keys.roll(key_id, expires_in=3600)` (a key that rolls itself
   keeps working for at least an hour), revoke the old one with the new key, and create a
   restricted key (`ppay_rk_test_…`) for servers with `pay.api_keys.create(permissions=[…])`.
2. Fetch `GET /v1/attestation?nonce=…`, verify it (step 2), and pin the account's webhook keys.
3. Prove a test treasury per chain with a signed EIP-4361 challenge:
   `pay.treasuries.set_eoa(chain_id=11155111, address=…, private_key=…)`, or a Safe signing it
   as a Safe message.
4. Register a webhook endpoint (`POST /v1/webhook_endpoints`) with a public HTTPS URL.
5. Create a quote (`pay.quotes.create(…, chain_id=11155111, asset="pha")`) and pay it: test PHA
   has a public `mint`, test USDC comes from Circle's faucet. The verified `deposit.credited`
   webhook arrives about 30 seconds after payment on Sepolia and about 5 minutes after on Base
   Sepolia.

Phala Pay's reference product runs steps 3 to 5 end to end from your machine: set `service_url` to
`ORIGIN` and follow
[Running the scenarios against a deployed service](https://github.com/Phala-Network/phala-pay/blob/main/deploy/sandbox/README.md#running-the-scenarios-against-a-deployed-service).
The [integration guide](https://github.com/Phala-Network/phala-pay/blob/main/docs/integration.md)
is the merchant's full reference, and the SDKs are
[`phala-pay`](https://pypi.org/project/phala-pay/) (Python) and
[`@phala/pay`](https://www.npmjs.com/package/@phala/pay) (JavaScript).

## Backups and restore

PostgreSQL archives WAL every minute and `backup` takes a daily base backup, both encrypted with a
key derived in the CVM from the app id. The same app derives the same key, so a replacement
instance of the same app restores without any secret. A new app can never read the old app's
backups, which is why every deployment of this template needs a new, empty `WALG_S3_PREFIX`: a
prefix that already holds a backup is restored from, and a new app cannot decrypt it.

Restores, drills, and the reconciliation that follows a restore are in Phala Pay's
[RESTORE.md](https://github.com/Phala-Network/phala-pay/blob/main/deploy/RESTORE.md). This template
omits the restore-check variant. Don't delete the app while its backups matter.

## Going to mainnet

Mainnet is not part of this template. A live route is a route file: add it as another inline config
and pass it to `topup` with `--route`, as the routes here are, with its chain's two
`TOPUP_RPC_<ID>_URL` providers in `x-rpc-providers`. Bump the `phala-pay.template-revision` label
too, so that Compose recreates the services. Then enable the account with `charges_enabled: true`.
Before you take real payments, read
[Routes and contracts](https://github.com/Phala-Network/phala-pay/blob/main/docs/self-hosting.md#3-routes-and-contracts)
and [Going live](https://github.com/Phala-Network/phala-pay/blob/main/docs/self-hosting.md#9-going-live).
They cover the factory's deployment and security review on the chain, and the limits. Read
[What the attestation covers](#what-the-attestation-covers) as well: a production instance belongs
on Phala Pay's own deploy path.

## Upgrades

Take the digests from a newer successful
[Release images](https://github.com/Phala-Network/phala-pay/actions/workflows/release-images.yml)
run on `main` (its `images.json` artifact), compare its `deploy/docker-compose.yml` and route files
with this template's, and update the compose. Every upgrade changes the compose hash, so tell your
merchants the new one. A schema is never rolled back.

## Local validation

```sh
TOPUP_ADMIN_PUBLIC_KEY=11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo= \
AWS_ENDPOINT=https://account.r2.cloudflarestorage.com AWS_ACCESS_KEY_ID=key AWS_SECRET_ACCESS_KEY=secret \
WALG_S3_PREFIX=s3://bucket/phala-pay DSTACK_APP_DOMAIN=app.gateway.example \
docker compose -f templates/prebuilt/phala-pay/docker-compose.yml config
```

The stack itself needs the dstack socket and KMS. Phala Pay's
[`deploy/local/`](https://github.com/Phala-Network/phala-pay/tree/main/deploy/local) overlay runs
the same services locally against the dstack simulator and a Garage S3 store.

## Upstream sources

- Repository: [Phala-Network/phala-pay](https://github.com/Phala-Network/phala-pay) (Apache-2.0)
- Compose: [`deploy/docker-compose.yml`](https://github.com/Phala-Network/phala-pay/blob/51f07b3c2cf060ccba152dd9d8ab975f2f843d3c/deploy/docker-compose.yml)
- Deployment reference: [`deploy/README.md`](https://github.com/Phala-Network/phala-pay/blob/main/deploy/README.md)
- Self-hosting guide: [`docs/self-hosting.md`](https://github.com/Phala-Network/phala-pay/blob/main/docs/self-hosting.md)
- API reference: [phala-network.github.io/phala-pay](https://phala-network.github.io/phala-pay/)
- Template icon: Phala Pay's own mark, the lime dot on a dark rounded tile,
  [`deploy/product/web/brand/mark-light.svg`](https://github.com/Phala-Network/phala-pay/blob/main/deploy/product/web/brand/mark-light.svg)
