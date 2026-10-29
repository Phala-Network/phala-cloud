# Phala Pay

[Phala Pay](https://github.com/Phala-Network/phala-pay) is open-source, non-custodial crypto
payments software with a Stripe-shaped API: one fixed deposit address per customer on each
configured chain, price-locking quotes on that address, refunds, and webhooks signed with keys
that merchants pin from the CVM's attestation. Addresses can only pay the merchant's own
treasury. The service holds no funds and sends no transactions.

This template is a **testnet quick start**: one Phala Pay instance in a Phala Cloud CVM, serving the
same four test routes as Phala's staging instance, at the app's Phala Cloud domain. It is Phala Pay
release `v0.13.1`'s own template compose. For a production instance whose merchants verify the
service, follow Phala Pay's
[self-hosting guide](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/docs/self-hosting.md)
instead (see [What the attestation covers](#what-the-attestation-covers)).

[![Deploy on Phala Cloud](https://cloud.phala.com/deploy-button.svg)](https://cloud.phala.com/templates/phala-pay)

## What it deploys

This template's `docker-compose.yml` is, byte for byte, the `phala-cloud-template.yml` asset of
Phala Pay [release `v0.13.1`](https://github.com/Phala-Network/phala-pay/releases/tag/v0.13.1). The
release renders it from its deploy kit with `deploy/render.sh --template`, the same renderer and
policy that Phala Pay's own deployments use, with the release's images pinned by digest. Verify
the release with Phala Pay's `deploy/verify-release.sh` (its commit in `main`'s history, the
checksums, every asset's and image's build provenance for that commit, and each image's
signed SPDX SBOM), then compare:

The verifier needs GitHub CLI 2.101 or later, logged in, `jq`, and GNU `timeout` (on macOS,
install coreutils for `gtimeout`).

```sh
# Fetch the verifier and its helpers at the release's immutable commit.
for script in verify-release.sh deadline.sh github-read.sh; do
  gh api -H 'Accept: application/vnd.github.raw' \
    "repos/Phala-Network/phala-pay/contents/deploy/$script?ref=332380e065251903a54a25ea2ab49c8049a38ca4" >"$script"
done
bash verify-release.sh v0.13.1 release
cmp release/phala-cloud-template.yml templates/prebuilt/phala-pay/docker-compose.yml
mkdir kit && tar -xzf release/phala-pay-deploy-v0.13.1.tar.gz -C kit --strip-components=1
npm ci --prefix kit/deploy/tools --ignore-scripts    # the kit's locked phala@1.1.22, kit/deploy/phala
```

`v0.13.1` is commit `332380e065251903a54a25ea2ab49c8049a38ca4`. Its `phala-cloud-template.yml` has
SHA-256 `97aba34abbdf4c027e6cadce73e472290eaa8e13261bdb9e418e8713462d9985`, and it pins:

- `ghcr.io/phala-network/phala-pay@sha256:5151d9a98069688b265334ac181a7aacb2ae761c58e005e01644e8621399ba41`
- `ghcr.io/phala-network/postgres-walg@sha256:ef0513eef0b01745be7cbf8e136e6eeac205ccd00d29fd456378493c1388afc3`

| Service | Image | What it does |
| --- | --- | --- |
| `keys` | `phala-pay` | Derives the database passwords and the backup encryption key from the app's KMS keys into tmpfs volumes. With `topup`, the only container with the dstack socket. |
| `postgres` | `postgres-walg` | PostgreSQL 18 with WAL-G. Uses `archive_timeout=30` to switch WAL segments containing new data for archiving to your bucket. |
| `migrate` | `phala-pay` | One-shot schema migration. |
| `topup` | `phala-pay` | The API and the chain scanners, on port 80 behind the Phala Cloud gateway. |
| `smokescreen` | `phala-pay` | Stripe's smokescreen: every webhook delivery leaves through it, and it refuses any address that is not publicly routable (private ranges, loopback, cloud metadata). |
| `heartbeat` | `phala-pay` | Liveness heartbeat using `topup heartbeat --interval-s 15`, committing every 15 seconds. |
| `capacity` | `postgres-walg` | Samples disk space and the WAL archive backlog every 30 seconds for capacity monitoring. |
| `backup` | `postgres-walg` | An encrypted WAL-G base backup every day at 8 PM PDT / 7 PM PST (03:00 UTC), keeping seven. |

`phala-pay` is bit-for-bit reproducible from the tag; the release's `images.json` lists every
digest. Each service mounts only the credentials it needs: `topup` and `heartbeat` see only the
application login, never the database owner's password or the backup key, and no environment
variable carries a database password. `topup` is the only published port.

**Configuration.** The compose inlines one `topup.yaml`, Phala Pay's
[`deploy/environments/phala-cloud-template/topup/topup.yaml`](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/deploy/environments/phala-cloud-template/topup/topup.yaml):
the four test routes (`livemode: false`) and the independent read/verify RPC endpoints of Phala's
staging instance, the Sentry environment `testnet`, and the admin key id `admin/v1`.

| Route | Chain | Token |
| --- | --- | --- |
| `phala-cloud-sepolia-pha-usd` | Sepolia (11155111), credited at 2 confirmations | test PHA `0x8F40e7E99678F44c88158f049E62817580ab113B` (`mint` is public) |
| `phala-cloud-sepolia-usdc-usd` | Sepolia | Circle test USDC `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` ([faucet](https://faucet.circle.com)) |
| `phala-cloud-sepolia-usdt-usd` | Sepolia | Aave test USDT `0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0` (faucet `0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D`) |
| `phala-cloud-base-sepolia-usdc-usd` | Base Sepolia | Circle test USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` ([faucet](https://faucet.circle.com)) |

All Sepolia routes default to 2 confirmations; Base Sepolia USDC defaults to 3. Accounts can
require more confirmations. Aave's faucet exposes `mint(token, to, amount)`; Tether publishes no
testnet USDT. Base Sepolia accepts only USDC; PHA and USDT remain available on Sepolia.

**Fixed addresses and quotes.** A quote uses the customer's fixed address on its chain, issuing
the customer's deposit-address network if needed. One price window exists per customer and
route (chain and asset). Creating a new quote replaces the previous window; `replaced_by` names
the new quote. Send exactly the quoted token amount after `window_start` and by `expires_at`
for the locked price, subject to the configured tolerance. The first eligible transfer to finish
confirmation consumes the quote. Other amounts, earlier or late payments, and subsequent
transfers use the market rate within the deposit limits. Only a deposit that consumes the quote
carries its `quote` and metadata. USDC, USDT and PHA support this quote flow on their configured
routes. The standalone deposit-address flow accepts transfers within those limits without
requesting a price lock.

Every route uses the permissionless forwarder factory `0x45466D37587E6E46DC35eB96b74ba3D3b1E5b747`
(implementation `0x49F2F1F1a25269Ea0C6FF2AB1C7B09dCBE9c5bA9`), deployed at the same address on
every chain. `topup` refuses to start unless each RPC provider shows exactly that code there. The
read and verify endpoints must both agree on the deployed code.

**RPC keys.** Each payment and price chain has one Ankr read endpoint and one independent Infura
verify endpoint, with no in-process failover. Both require API keys, sealed as
`TOPUP_RPC_ANKR_KEY` and `TOPUP_RPC_INFURA_KEY`. Enable access to Sepolia, Base Sepolia, Ethereum
and Base in those provider accounts; Ethereum and Base are used for prices, not mainnet payments.
Missing keys block preflight. See Phala Pay's
[RPC operations](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/deploy/RPC.md).

**Pilot limits.** The service permanently caps issued addresses at 1,000 per chain, including
historical addresses. Quotes reuse address capacity once the customer's network is issued.
Fresh quote price snapshots are capped at 60 per price chain per day, and transaction-hash hint
tasks at 80 per environment per day; both daily limits reset at midnight UTC (5 PM PDT / 4 PM PST).
The attested configuration
sets `max_attached_pending_refunds: 2`, plus at most one new refund attachment per rolling 24
hours. Coordinate with the operator before paying a refund: attachment can be refused after the
payout, and an unseen attached transaction stays pending with its reservation instead of timing
out. Do not pay a replacement refund while that reservation remains.

**Public origin.** `https://<DSTACK_APP_DOMAIN>`, the app's Phala Cloud domain
(`<app-id>.<gateway-domain>`, which the gateway serves from port 80), exported by Phala Cloud's
pre-launch script. `topup run --public-origin-host-env DSTACK_APP_DOMAIN` reads it at startup and
refuses anything but a lowercase DNS name. The admin API verifies every signed request against this origin, and treasury
proofs (EIP-4361) name it, so always call the service at exactly this URL.

Default size: 2 vCPU, 4 GB memory, 20 GB disk, the `tdx.medium` that Phala Pay's own deploy uses.

## Before you deploy

1. **The admin key.** Only the admin creates merchant accounts, and every admin call is signed. On
   your own machine (Python 3.12 or later):

   ```sh
   pip install 'phala-pay==0.13.1'
   topup-sdk keygen --keyid admin/v1 --seed-out ~/phala-pay/admin.seed
   ```

   It prints `{"keyid": "admin/v1", "public_key": "…"}`. The `public_key` is
   `TOPUP_ADMIN_PUBLIC_KEY`. The seed stays on your machine: keep it offline, and never put it in
   the CVM. The template's key id is `admin/v1`. Keep the SDK pinned to the service version.
2. **A backup bucket.** An S3-compatible bucket (Cloudflare R2, AWS S3, and so on), an **empty**
   prefix for this deployment, and a token with read and write access to it only. A new instance's
   PostgreSQL does not start until it can list that prefix, and on every start it refuses to run
   without both credentials, so the CVM stays unhealthy until the bucket settings are right.
3. **RPC provider accounts.** Obtain Ankr and Infura keys with access to all four chains listed
   in [RPC keys](#what-it-deploys). Both keys are required by the deploy form and preflight.

**Network requirements.** Allow outbound HTTPS to the RPC providers, price sources, backup
store and, if configured, Sentry. Sanctions screening also requires
`sanctionslistservice.ofac.treas.gov` and
`wc2h-sls-prod-public-published.s3.us-gov-west-1.amazonaws.com` for verified OFAC SDN snapshots.
Stale or unverifiable snapshots hold negative screening decisions; affected payments remain
under compliance review.

## Form fields

All of them go into Phala Cloud's encrypted environment.

| Variable | Required | Default | What it is |
| --- | --- | --- | --- |
| `TOPUP_ADMIN_PUBLIC_KEY` | yes | | The admin key's `public_key` from `topup-sdk keygen`. `topup` refuses to start unless it is a valid key. |
| `TOPUP_RPC_ANKR_KEY` | yes | | Ankr API key for the read endpoints on Sepolia, Base Sepolia, Ethereum and Base (prices). |
| `TOPUP_RPC_INFURA_KEY` | yes | | Infura API key for the independent verify endpoints on the same chains. |
| `AWS_ENDPOINT` | yes | | The store's endpoint, for example `https://<account>.r2.cloudflarestorage.com` or `https://s3.us-east-1.amazonaws.com`. |
| `AWS_ACCESS_KEY_ID` | yes | | Access key for the backup prefix. |
| `AWS_SECRET_ACCESS_KEY` | yes | | Its secret. |
| `AWS_REGION` | yes | `auto` | `auto` for R2; the bucket's region for AWS S3 and other stores. Requests use path-style addressing. |
| `WALG_S3_PREFIX` | yes | | `s3://BUCKET/PATH`, empty and used by no other deployment. |
| `SENTRY_DSN` | no | empty | Sentry project DSN for errors, alerts, and Crons monitors. Empty turns reporting off. |

On every start, PostgreSQL and the backup job refuse a malformed `WALG_S3_PREFIX`, `AWS_ENDPOINT`,
or `AWS_REGION`, and an empty or missing `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`: a restarted
CVM whose storage credentials were removed stops serving rather than run without archiving.
Everything else is fixed in the attested compose: the routes, the RPC providers, the key id, the
webhook proxy, and the Sentry environment `testnet`. To use other RPC providers or routes, deploy
Phala Pay as its [self-hosting guide](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/docs/self-hosting.md)
describes.

**Choose the approved `dstack-0.6.1` OS image** (non-dev), with image hash
`ec43cb8c5e04b6bb6c53b33b16076a01d83d01f7f4b703f2f78a0d947d6247e6`.
Check the deploy form's image field; with the CLI pass `--image dstack-0.6.1 --no-dev-os`.
The service keeps the dstack v0 guest API. An in-place OS upgrade that retains the same
CVM/app/KMS identity preserves the backup encryption key, database passwords, webhook keys and
encrypted data disk; merchants do not need to re-pin keys. Take and verify a fresh backup before
an OS upgrade and follow the release's
[OS image procedure](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/deploy/README.md#os-image).

Phala Pay's own deploy also turns off public logs and public system info. If your deploy form
offers those options, turn them off too. With public logs off, container logs are hidden from you
as well: `phala logs` and the dashboard refuse them.

**From the command line**, instead of the console form, Phala Pay's one-command deploy provisions
the same quick start in your own workspace:

```sh
curl -fsSL https://pay.phala.com/deploy/v0.13.1.sh | bash
```

It verifies v0.13.1 (its build provenance with the GitHub CLI 2.101 or later, logged
in; otherwise only `SHA256SUMS`, and it says so), asks for the instance name and the form fields
above (or generates the admin keypair, writing the seed only to the file you name), and deploys
this compose, the release's, with the kit's locked CLI, `dstack-0.6.1` non-dev, public TCB info and
secure time enabled, and public logs and system info off. Leave the custom domain empty for this
template's quick start. It prints the CVM id, the URL, and the acceptance steps below, even when a
step after the provision fails. It
records the CVM id in `./NAME.cvm-id`, so a second run in the same directory creates no other CVM,
and it refuses a name your workspace already has. It needs Docker, Node.js 22, `jq`, your
Phala Cloud login or `PHALA_CLOUD_API_KEY`, and uv or pipx to generate a key. Its requirements,
`--non-interactive` mode, and the high-assurance path that verifies the script before running it
are in the self-hosting guide's
[One-command deploy](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/docs/self-hosting.md#one-command-deploy).

To deploy by hand with the kit's CLI ([What it deploys](#what-it-deploys)), put the variables in
an env file and run:

```sh
kit/deploy/phala deploy -n phala-pay -c docker-compose.yml -e phala-pay.env -t tdx.medium \
  --pre-launch-script kit/deploy/phala-cloud-pre-launch.sh --fs ext4 --kms phala \
  --disk-size 20G --image dstack-0.6.1 --no-dev-os --no-public-logs --no-public-sysinfo \
  --public-tcbinfo --secure-time
```

The CLI allows exactly the variables in the env file (the app-compose's `allowed_envs`). Leave
out `SENTRY_DSN` if you don't use Sentry: the kit's attestation check accepts any subset of the
compose's nine sealed variables and refuses any other name. Both RPC keys must be present for
preflight and startup.

## What the attestation covers

The attestation proves this compose file, its pinned images, the routes and RPC providers,
topup's exact command, the names of the allowed environment variables (only the compose's own),
and (checked by Phala Pay's `verify-attestation.sh`) the reviewed Phala Cloud pre-launch script. The inlined
`topup.yaml` holds no runtime value. Phala Pay's template policy (`compose-policy.jq`, variant
`template`) allows exactly these five environment values, each as the whole value of its own key,
which the attestation therefore does **not** prove:

| Value | Source | Why it is not attested |
| --- | --- | --- |
| The admin public key | `TOPUP_ADMIN_PUBLIC_KEY`, form | A one-click template cannot write your key into the compose. |
| The public origin | `DSTACK_APP_DOMAIN`, from Phala Cloud's pre-launch script (the app id and the gateway domain) | The app id exists only once the app is created. |
| The backup location | `WALG_S3_PREFIX`, `AWS_ENDPOINT`, `AWS_REGION`, form | Every deployment has its own bucket. |

Whoever controls the Phala Cloud workspace can change these values with an env update, without
changing the compose hash: for example, swap in their own admin key and create accounts. `topup`
and PostgreSQL only check that each is well formed (the key a base64 ed25519 key, the origin a DNS
name, the prefix `s3://BUCKET[/PATH]`, the endpoint an `https://` origin). This template also relies on the Phala Cloud
gateway's TLS for the app domain, where Phala Pay's own deploy serves a custom domain with TLS
terminated in the CVM by dstack-ingress, with certificate evidence.

That is fine for trying Phala Pay on testnets. For an instance whose merchants verify the service,
deploy a release as the
[self-hosting guide](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/docs/self-hosting.md)
describes: every setting, including these, is then in the attested compose.

## After deploy

`ORIGIN` below is `https://<app-id>.<gateway-domain>`, with `<app-id>.<gateway-domain>` the value of `DSTACK_APP_DOMAIN`.
If the dashboard shows the endpoint as `https://<app-id>-80.<gateway-domain>`, drop the `-80`:
signed admin requests to any other host are refused with `401`.

### 1. Health check

```sh
curl -fsS -o /dev/null -w '%{http_code}\n' "$ORIGIN/healthz"    # 200
curl -fsS "$ORIGIN/openapi.json" | jq -r .info.version    # 0.13.1
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

With the kit's Phala CLI (above) and your CVM id:

```sh
kit/deploy/phala cvms attestation "$CVM_ID" --json > attestation.json
# The attested app-compose must hold exactly this template's compose file.
jq -j '.compose_file | fromjson | .docker_compose_file' attestation.json | diff - docker-compose.yml
COMPOSE_HASH=$(jq -j '.compose_file' attestation.json | sha256sum | cut -d ' ' -f 1)
```

Then check the quote with the official dstack verifier, either on the
[Phala Trust Center](https://trust.phala.com) page of the app or locally with the release's deploy
kit, which runs the pinned `ghcr.io/dstack-tee/dstack-verifier:0.6.1` image and applies the template policy and
the reviewed pre-launch script. With `APP_ID` the app id:

```sh
kit/deploy/phala cvms get "$CVM_ID" --json > cvm.json
curl -fsS "https://${APP_ID#0x}-8090.$(jq -er '.gateway.base_domain' cvm.json)/prpc/Info" > info.json
kit/deploy/verify-attestation.sh attestation.json info.json "$APP_ID" docker-compose.yml template \
  "$(cat kit/deploy/environments/phala-cloud-template/topup/os-image-hash)"
```

It checks the TDX quote and TCB, replays the event log, and requires the approved OS image hash,
the app id, the compose hash of exactly this compose, the allowed environment names, and the
template policy. The guest agent's info on port 8090 is public only with public TCB info, the
CLI's default; without it, use the Trust Center.

Merchants run the same check on the nonce-bound attestation the service returns to each account,
before they pin their webhook keys (step 4). With the kit, from its directory, and a secret key of the
account ([step 3](#3-onboard-the-first-account)). `COMPOSE_HASH` is the verified hash above,
without `0x`, given to the merchant by the operator:

```sh
NONCE=$(openssl rand -hex 32)
curl -fsS -H "Authorization: Bearer $SECRET_KEY" "$ORIGIN/v1/attestation?nonce=$NONCE" > public-attestation.json
jq '{quote: null, attestation: .tdx_quote}' public-attestation.json |
  deploy/dstack-verifier.sh > public-verification.json
jq -e --arg app "${APP_ID#0x}" --arg compose "$COMPOSE_HASH" \
  --arg report_data "$(jq -r '.report_data' public-attestation.json)" \
  --arg os "$(cat deploy/environments/phala-cloud-template/topup/os-image-hash)" '
  .details.tcb_status == "UpToDate" and .details.app_info.app_id == $app
  and .details.app_info.compose_hash == $compose and .details.app_info.os_image_hash == $os
  and .details.report_data == $report_data + ("0" * 64)' public-verification.json
```

`topup_sdk.verify_attestation_binding` in the Python SDK then checks that the report data binds the
nonce, the account, the mode, and the listed webhook keys
([integration guide §5.3](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/docs/integration.md#53-pin-your-accounts-webhook-keys)).

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
[operator onboarding](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/deploy/README.md#operator-onboarding)
and [runbooks](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/deploy/runbooks/README.md).

### 4. A first test deposit

The merchant does the rest with its own keys against `ORIGIN`, as
[pay.phala.com](https://pay.phala.com/)'s demo does against Phala's staging instance. In the
Python SDK (`pip install 'phala-pay[eoa]==0.13.1'`), first verify the account's attestation (step 2).
Build `PHALA_PAY_PINS` with `phala_pay.Pins` and `encode_pins`: `api_base` is `ORIGIN`, `account`
is the new account id, `livemode` is `False`, `factory` and `implementation` are the verified
forwarder addresses above, `treasuries` maps each chain id to your own chosen treasury, and
`webhook_keys` contains `(version, public_key)` pairs from the verified attestation. The encoding
starts with `ppay_pins_v1.`; protect it from modification in your deployment configuration.
Set `PHALA_PAY_API_KEY` to the account's secret test key, then create the client used below:

```python
from phala_pay import PhalaPay

pay = PhalaPay.from_env()  # PHALA_PAY_API_KEY and PHALA_PAY_PINS
```

1. Roll the first key with `pay.api_keys.roll(key_id, expires_in=3600)` (a key that rolls itself
   keeps working for at least an hour), revoke the old one with the new key, and create a
   restricted key (`ppay_rk_test_…`) for servers with `pay.api_keys.create(permissions=[…])`,
   for example `["account.read", "quotes.write", "deposits.read"]`. Restricted-key clients use
   the same verified pins; the SDK checks account, mode and payment addresses against them on
   every response.
2. Prove the treasury you pinned for each test chain with a signed EIP-4361 challenge:
   `pay.treasuries.set_eoa(chain_id=11155111, address=…, private_key=…)`, or a Safe signing it
   as a Safe message.
3. Enable the chains and lowercase assets you accept with `pay.payment_settings.update`, for
   example `chains=[{"chain_id": 11155111, "assets": [{"asset": "usdc"}]}]`. A new account accepts
   nothing; quote creation fails with `asset_not_accepted` until these settings are in place.
4. Register a webhook endpoint (`POST /v1/webhook_endpoints`) with a public HTTPS URL.
5. Create a quote (`pay.quotes.create(…, chain_id=11155111, asset="usdc")`) and pay its fixed
   customer address before the price window ends: test PHA has a public `mint`, test USDC comes
   from Circle's faucet, and test USDT from Aave's faucet.
   Verify the `deposit.credited` webhook with `pay.webhooks.construct_event(payload, headers)`
   before crediting once per deposit. Browser status alone is not proof of credit. On the frontend,
   `<PaymentElement createQuote={…}>` selects a token and network, requests a quote from your
   backend and renders `<Checkout>`; standalone `<DepositAddress>` handles transfers without a
   quote. Persist the checkout's `client_secret` and sent `txHash` for that customer, resume with
   `<Checkout txHash={…}>`, and block another payment while the sent transfer is unresolved.

**Credit timing.** Wallet payments through `@phala/pay`'s `payWithWallet` or `<Checkout>` submit a
transaction-hash hint automatically. Unhinted QR/manual transfers rely on discovery every
5 minutes, so they can take about 5 minutes longer than the chain's confirmation
estimate. Hints can also fall back to discovery when capped or unavailable. Typical credit times
describe healthy hinted payments and are not guarantees; provider lag or compliance review can
delay credit further.

Phala Pay's reference product runs treasury proof and checkout end to end from your machine:
set `service_url` to `ORIGIN` and follow
[Running the scenarios against a deployed service](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/deploy/sandbox/README.md#running-the-scenarios-against-a-deployed-service).
The [integration guide](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/docs/integration.md)
is the merchant's full reference, and the SDKs are
[`phala-pay`](https://pypi.org/project/phala-pay/) (Python) and
[`@phala/pay-server`](https://www.npmjs.com/package/@phala/pay-server) (JavaScript backend),
[`@phala/pay`](https://www.npmjs.com/package/@phala/pay) (browser), and
[`@phala/pay-react`](https://www.npmjs.com/package/@phala/pay-react) (React). Pin each package you
use to `0.13.1`, matching the service.

## Backups and restore

PostgreSQL archives written WAL with `archive_timeout=30`, and `backup` takes a daily base backup,
both encrypted with a key derived in the CVM from the app id. The same app derives the same key, so a replacement
instance of the same app restores without any secret. A new app can never read the old app's
backups, which is why every deployment of this template needs a new, empty `WALG_S3_PREFIX`: a
prefix that already holds a backup is restored from, and a new app cannot decrypt it.

A template instance has **no restore-check path**: Phala Pay's
[RESTORE.md](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/deploy/RESTORE.md) verifies a
restore read-only before it serves, and its guarantees rest on an attested backup prefix, origin,
and admin key, which the template takes from its form. Another instance of the same app, with the
same form values, restores the newest backup when it first starts, without that verification.
Don't delete the app while its backups matter.

## Going to mainnet

Mainnet is not part of this template. A live route, or any change to the routes and providers,
changes the attested configuration, and a production instance needs every setting attested:
deploy a Phala Pay release from your own environment repository, as the
[self-hosting guide](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/docs/self-hosting.md)
describes. Before you take real payments, read its
[Routes and contracts](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/docs/self-hosting.md#3-routes-and-contracts)
and [Going live](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/docs/self-hosting.md#9-going-live).

## Upgrades

Verify the release's `phala-cloud-template.yml` as in [What it deploys](#what-it-deploys), then
review every intervening release's
[changelog](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/CHANGELOG.md) and supported
upgrade path. Retain the previous verified kit, images and configuration, take and verify a
pre-upgrade backup, and tell merchants the new compose hash. Never run down migrations.

**v0.13.0 changes the quote schema: no rollback to v0.12.x is supported.** v0.13.1 can roll back
to v0.13.0 with the upgraded schema, but crossing the v0.13.0 boundary requires stopping writes
and restoring a verified pre-upgrade backup with reconciliation. Lost quotes are not reissued:
restore clamps their open price windows to the restore point; reissue customer addresses and
import delivered outcomes as the
[restore procedure](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/deploy/RESTORE.md)
requires. This template has no restore-check path; production recovery uses the fully attested
self-hosting deployment.

**Before removing Base Sepolia PHA/USDT from an existing v0.10.x template**, pause quotes on both
retiring routes, sweep credited deposits and require zero open exposure and zero detected,
confirmed, credited and credited-undelivered deposits. Follow the
[v0.11.0 retirement procedure](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/deploy/phala.md#retiring-base-sepolia-pha-and-usdt).
After removal, PHA/USDT sent to those old Base Sepolia addresses are unsupported; later sweeps
and reversals are no longer recorded. Use only USDC on Base Sepolia, including at existing
addresses. Sepolia retains PHA, USDC and USDT.

For disposable testnet instances, deploy afresh with a new, empty backup prefix and onboard
test accounts again. Existing v0.3.x instances require a fresh deploy; a direct pre-0.9 upgrade
is unsupported. Keep the old app while its backups matter: a new app cannot decrypt them.

Before resuming screening-dependent processing after any recovery, verify a fresh OFAC SDN
snapshot, manual supplements and re-screening. See the
[sanctions runbook](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/deploy/runbooks/sanctions-list.md#n-1-rollback)
and
[rollback policy](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/deploy/README.md#rollback-compatibility).

## Local validation

Check the inlined configuration and both RPC key mappings with the pinned image, without network
access. The dummy values below are only for offline validation; they cannot authenticate to a
provider. The origin and admin key remain in `topup run`'s environment:

```sh
docker compose -f templates/prebuilt/phala-pay/docker-compose.yml config --no-interpolate --format json > template.json
cat > rpc-check.env <<'EOF'
TOPUP_RPC_ANKR_KEY=offline-check-ankr
TOPUP_RPC_INFURA_KEY=offline-check-infura
EOF
jq -j '.configs | to_entries[] | select(.key | startswith("topup_")) | .value.content' template.json |
  docker run --rm --network none --env-file rpc-check.env -i \
    "$(jq -r '.services.topup.image' template.json)" topup config check --secrets /dev/stdin
rm template.json rpc-check.env
```

The stack itself needs the dstack socket and KMS. Phala Pay's
[`deploy/local/`](https://github.com/Phala-Network/phala-pay/tree/v0.13.1/deploy/local) overlay runs
the same services locally against the dstack simulator and a Garage S3 store.

## Upstream sources

- Repository: [Phala-Network/phala-pay](https://github.com/Phala-Network/phala-pay) (Apache-2.0)
- Release: [`v0.13.1`](https://github.com/Phala-Network/phala-pay/releases/tag/v0.13.1), asset `phala-cloud-template.yml`
- Template environment: [`deploy/environments/phala-cloud-template/`](https://github.com/Phala-Network/phala-pay/tree/v0.13.1/deploy/environments/phala-cloud-template/topup), rendered with `deploy/render.sh --template`
- Deployment reference: [`deploy/README.md`](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/deploy/README.md#the-phala-cloud-template-variant)
- Self-hosting guide: [`docs/self-hosting.md`](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/docs/self-hosting.md)
- API reference: [phala-network.github.io/phala-pay](https://phala-network.github.io/phala-pay/)
- Template icon: Phala Pay's own mark, the lime dot on a dark rounded tile,
  [`deploy/product/web/brand/mark-light.svg`](https://github.com/Phala-Network/phala-pay/blob/v0.13.1/deploy/product/web/brand/mark-light.svg)
