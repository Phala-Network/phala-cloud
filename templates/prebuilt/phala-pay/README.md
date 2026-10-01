# Phala Pay

[Phala Pay](https://github.com/Phala-Network/phala-pay) is open-source, non-custodial crypto
payments software with a Stripe-shaped API: quotes, deposit addresses that can only pay the
merchant's own treasury, refunds, and webhooks signed with keys that merchants pin from the CVM's
attestation. The service holds no funds and sends no transactions.

This template is a **testnet quick start**: one Phala Pay instance in a Phala Cloud CVM, serving the
same four test routes as Phala's staging instance, at the app's Phala Cloud domain. It is Phala Pay
release `v0.3.4`'s own template compose. For a production instance whose merchants verify the
service, follow Phala Pay's
[self-hosting guide](https://github.com/Phala-Network/phala-pay/blob/v0.3.4/docs/self-hosting.md)
instead (see [What the attestation covers](#what-the-attestation-covers)).

[![Deploy on Phala Cloud](https://cloud.phala.com/deploy-button.svg)](https://cloud.phala.com/templates/phala-pay)

## What it deploys

This template's `docker-compose.yml` is, byte for byte, the `phala-cloud-template.yml` asset of
Phala Pay [release `v0.3.4`](https://github.com/Phala-Network/phala-pay/releases/tag/v0.3.4). The
release renders it from its deploy kit with `deploy/render.sh --template`, the same renderer and
policy that Phala Pay's own deployments use, with the release's images pinned by digest. Verify
the release with Phala Pay's `deploy/verify-release.sh` (its commit in `main`'s history, the
checksums, and every asset's and image's build provenance for that commit), then compare:

```sh
gh api -H 'Accept: application/vnd.github.raw' \
  'repos/Phala-Network/phala-pay/contents/deploy/verify-release.sh?ref=v0.3.4' >verify-release.sh
bash verify-release.sh v0.3.4 release
cmp release/phala-cloud-template.yml templates/prebuilt/phala-pay/docker-compose.yml
mkdir kit && tar -xzf release/phala-pay-deploy-v0.3.4.tar.gz -C kit --strip-components=1
npm ci --prefix kit/deploy/tools --ignore-scripts    # the kit's locked Phala Cloud CLI, kit/deploy/phala
```

`v0.3.4` is commit `9e6672d7407f440ffe80ecec043b49b2559f44e9`. Its `phala-cloud-template.yml` has
SHA-256 `7f6d1962a8bbed6d0e433a16900799d998f6370f74bf950c1809739baf74189d`, and it pins:

- `ghcr.io/phala-network/phala-pay@sha256:959eda79707c8067c4778790cfd11a26a510cd7e3371e49f8f71b9f521333967`
- `ghcr.io/phala-network/postgres-walg@sha256:5a133b91839aa8007f551a7b08a3f877abef192d9b43a0775ec3f923ec3e0809`

| Service | Image | What it does |
| --- | --- | --- |
| `keys` | `phala-pay` | Derives the database passwords and the backup encryption key from the app's KMS keys into tmpfs volumes. With `topup`, the only container with the dstack socket. |
| `postgres` | `postgres-walg` | PostgreSQL 18 with WAL-G. Archives WAL every minute to your bucket. |
| `migrate` | `phala-pay` | One-shot schema migration. |
| `topup` | `phala-pay` | The API and the chain scanners, on port 80 behind the Phala Cloud gateway. |
| `smokescreen` | `phala-pay` | Stripe's smokescreen: every webhook delivery leaves through it, and it refuses any address that is not publicly routable (private ranges, loopback, cloud metadata). |
| `heartbeat` | `phala-pay` | Liveness heartbeat, one commit a minute. |
| `backup` | `postgres-walg` | An encrypted WAL-G base backup every day at 03:00 UTC, keeping seven. |

`phala-pay` is bit-for-bit reproducible from the tag; the release's `images.json` lists every
digest. Each service mounts only the credentials it needs: `topup` and `heartbeat` see only the
application login, never the database owner's password or the backup key, and no environment
variable carries a database password. `topup` is the only published port.

**Configuration.** The compose inlines one `topup.yaml`, Phala Pay's
[`deploy/environments/phala-cloud-template/topup/topup.yaml`](https://github.com/Phala-Network/phala-pay/blob/v0.3.4/deploy/environments/phala-cloud-template/topup/topup.yaml):
the four test routes (`livemode: false`) and the keyless RPC providers of Phala's staging instance,
the Sentry environment `testnet`, and the admin key id `admin/v1`.

| Route | Chain | Token |
| --- | --- | --- |
| `phala-cloud-sepolia-pha-usd` | Sepolia (11155111), credited at 2 confirmations | test PHA `0x8F40e7E99678F44c88158f049E62817580ab113B` (`mint` is public) |
| `phala-cloud-sepolia-usdc-usd` | Sepolia | Circle test USDC `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` ([faucet](https://faucet.circle.com)) |
| `phala-cloud-base-sepolia-pha-usd` | Base Sepolia (84532), credited at the `safe` head | test PHA `0x1a6F260377e42ead1418C7C1afDFD5DE371A9284` (`mint` is public) |
| `phala-cloud-base-sepolia-usdc-usd` | Base Sepolia | Circle test USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` ([faucet](https://faucet.circle.com)) |

Every route uses the permissionless forwarder factory `0x45466D37587E6E46DC35eB96b74ba3D3b1E5b747`
(implementation `0x49F2F1F1a25269Ea0C6FF2AB1C7B09dCBE9c5bA9`), deployed at the same address on
every chain. `topup` refuses to start unless each RPC provider shows exactly that code there. The
providers are public and rate-limited, which is fine for a trial.

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
   pip install 'phala-pay>=0.3'
   topup-sdk keygen --keyid admin/v1 --seed-out ~/phala-pay/admin.seed
   ```

   It prints `{"keyid": "admin/v1", "public_key": "…"}`. The `public_key` is
   `TOPUP_ADMIN_PUBLIC_KEY`. The seed stays on your machine: keep it offline, and never put it in
   the CVM. The template's key id is `admin/v1`. Use the SDK 0.3 or later: this release lists
   webhook keys as `whpk_…`, which 0.2's `verify_attestation_binding` refuses (`attestation fields
   are not hexadecimal`).
2. **A backup bucket.** An S3-compatible bucket (Cloudflare R2, AWS S3, and so on), an **empty**
   prefix for this deployment, and a token with read and write access to it only. A new instance's
   PostgreSQL does not start until it can list that prefix, and on every start it refuses to run
   without both credentials, so the CVM stays unhealthy until the bucket settings are right.

## Form fields

All of them go into Phala Cloud's encrypted environment.

| Variable | Required | Default | What it is |
| --- | --- | --- | --- |
| `TOPUP_ADMIN_PUBLIC_KEY` | yes | | The admin key's `public_key` from `topup-sdk keygen`. `topup` refuses to start unless it is a valid key. |
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
Phala Pay as its [self-hosting guide](https://github.com/Phala-Network/phala-pay/blob/v0.3.4/docs/self-hosting.md)
describes.

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

**From the command line**, instead of the console form, Phala Pay's one-command deploy provisions
the same quick start in your own workspace:

```sh
curl -fsSL https://pay.phala.com/deploy.sh | bash
```

It verifies the latest release (its build provenance with the GitHub CLI 2.101 or later, logged
in; otherwise only `SHA256SUMS`, and it says so), asks for the instance name and the form fields
above (or generates the admin keypair, writing the seed only to the file you name), and deploys
this compose, the release's, with the kit's locked CLI, `dstack-0.5.9` non-dev, and public logs
and system info off. Leave the custom domain empty for this template's quick start. It prints the
CVM id, the URL, and the acceptance steps below, even when a step after the provision fails. It
records the CVM id in `./NAME.cvm-id`, so a second run in the same directory creates no other CVM,
and it refuses a name your workspace already has. Use release `v0.3.3` or later: `v0.3.2`'s
script waits for an instance id that Phala Cloud never reports and fails after 15 minutes with a
healthy CVM. It needs Docker, Node.js 22, `jq`, your
Phala Cloud login or `PHALA_CLOUD_API_KEY`, and uv or pipx to generate a key. Its requirements,
`--non-interactive` mode, and the high-assurance path that verifies the script before running it
are in the self-hosting guide's
[One-command deploy](https://github.com/Phala-Network/phala-pay/blob/v0.3.4/docs/self-hosting.md#one-command-deploy).

To deploy by hand with the kit's CLI ([What it deploys](#what-it-deploys)), put the variables in
an env file and run:

```sh
kit/deploy/phala deploy -n phala-pay -c docker-compose.yml -e phala-pay.env -t tdx.medium \
  --disk-size 20G --image dstack-0.5.9 --no-dev-os --no-public-logs --no-public-sysinfo
```

The CLI allows exactly the variables in the env file (the app-compose's `allowed_envs`). Leave
out `SENTRY_DSN` if you don't use Sentry: the kit's attestation check accepts any subset of the
compose's seven variables and refuses any other name.

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
[self-hosting guide](https://github.com/Phala-Network/phala-pay/blob/v0.3.4/docs/self-hosting.md)
describes: every setting, including these, is then in the attested compose.

## After deploy

`ORIGIN` below is `https://<app-id>.<gateway-domain>`, with `<app-id>.<gateway-domain>` the value of `DSTACK_APP_DOMAIN`.
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

With the kit's Phala CLI (above) and your CVM id:

```sh
kit/deploy/phala cvms attestation "$CVM_ID" --json > attestation.json
# The attested app-compose must hold exactly this template's compose file.
jq -j '.compose_file | fromjson | .docker_compose_file' attestation.json | diff - docker-compose.yml
jq -j '.compose_file' attestation.json | sha256sum    # the compose hash
```

Then check the quote with the official dstack verifier, either on the
[Phala Trust Center](https://trust.phala.com) page of the app or locally with the release's deploy
kit, which runs the pinned `dstacktee/dstack-verifier` image and applies the template policy and
the reviewed pre-launch script. With `APP_ID` the app id:

```sh
kit/deploy/phala cvms get "$CVM_ID" --json > cvm.json
curl -fsS "https://${APP_ID#0x}-8090.$(jq -er '.gateway.base_domain' cvm.json)/prpc/Info" > info.json
kit/deploy/verify-attestation.sh attestation.json info.json "$APP_ID" docker-compose.yml template
```

It checks the TDX quote and TCB, replays the event log, and requires the app id, the compose hash
of exactly this compose, the allowed environment names, and the template policy. The guest
agent's info on port 8090 is public only with public TCB info, the CLI's default; without it, use
the Trust Center.

Merchants run the same check on the nonce-bound attestation the service returns to each account,
before they pin their webhook keys (step 4). With the kit, from its directory, and a secret key of the
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
([integration guide §5.3](https://github.com/Phala-Network/phala-pay/blob/v0.3.4/docs/integration.md#53-pin-your-accounts-webhook-keys)).

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
[operator onboarding](https://github.com/Phala-Network/phala-pay/blob/v0.3.4/deploy/README.md#operator-onboarding)
and [runbooks](https://github.com/Phala-Network/phala-pay/blob/v0.3.4/deploy/runbooks/README.md).

### 4. A first test deposit

The merchant does the rest with its own keys against `ORIGIN`, as
[pay.phala.com](https://pay.phala.com/)'s demo does against Phala's staging instance. In the
Python SDK (`pip install 'phala-pay[eoa]>=0.3'`), every call below is on

```python
from phala_pay import PhalaPay

pay = PhalaPay(ORIGIN, SECRET_KEY, forwarder=(
    "0x45466D37587E6E46DC35eB96b74ba3D3b1E5b747",  # factory
    "0x49F2F1F1a25269Ea0C6FF2AB1C7B09dCBE9c5bA9",  # implementation
))
```

1. Roll the first key with `pay.api_keys.roll(key_id, expires_in=3600)` (a key that rolls itself
   keeps working for at least an hour), revoke the old one with the new key, and create a
   restricted key (`ppay_rk_test_…`) for servers with `pay.api_keys.create(permissions=[…])`,
   for example `["quotes.write", "deposits.read"]`. A `PhalaPay` client on a key without
   `account.read` needs `account="acct_…"`: otherwise `quotes.create` fails with
   `403 permission_denied` when the SDK looks the account up to check the quote's address.
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
[Running the scenarios against a deployed service](https://github.com/Phala-Network/phala-pay/blob/v0.3.4/deploy/sandbox/README.md#running-the-scenarios-against-a-deployed-service).
The [integration guide](https://github.com/Phala-Network/phala-pay/blob/v0.3.4/docs/integration.md)
is the merchant's full reference, and the SDKs are
[`phala-pay`](https://pypi.org/project/phala-pay/) (Python) and
[`@phala/pay`](https://www.npmjs.com/package/@phala/pay) (JavaScript).

## Backups and restore

PostgreSQL archives WAL every minute and `backup` takes a daily base backup, both encrypted with a
key derived in the CVM from the app id. The same app derives the same key, so a replacement
instance of the same app restores without any secret. A new app can never read the old app's
backups, which is why every deployment of this template needs a new, empty `WALG_S3_PREFIX`: a
prefix that already holds a backup is restored from, and a new app cannot decrypt it.

A template instance has **no restore-check path**: Phala Pay's
[RESTORE.md](https://github.com/Phala-Network/phala-pay/blob/v0.3.4/deploy/RESTORE.md) verifies a
restore read-only before it serves, and its guarantees rest on an attested backup prefix, origin,
and admin key, which the template takes from its form. Another instance of the same app, with the
same form values, restores the newest backup when it first starts, without that verification.
Don't delete the app while its backups matter.

## Going to mainnet

Mainnet is not part of this template. A live route, or any change to the routes and providers,
changes the attested configuration, and a production instance needs every setting attested:
deploy a Phala Pay release from your own environment repository, as the
[self-hosting guide](https://github.com/Phala-Network/phala-pay/blob/v0.3.4/docs/self-hosting.md)
describes. Before you take real payments, read its
[Routes and contracts](https://github.com/Phala-Network/phala-pay/blob/v0.3.4/docs/self-hosting.md#3-routes-and-contracts)
and [Going live](https://github.com/Phala-Network/phala-pay/blob/v0.3.4/docs/self-hosting.md#9-going-live).

## Upgrades

Each Phala Pay release publishes its `phala-cloud-template.yml`. To upgrade, replace this compose
with a newer release's, verified as in [What it deploys](#what-it-deploys), read the release notes,
and update the CVM with it. Every upgrade changes the compose hash, so tell your merchants the new
one. A schema is never rolled back.

## Local validation

Check the inlined configuration with the pinned image; it leaves the origin and the admin key to
`topup run`'s environment:

```sh
docker compose -f templates/prebuilt/phala-pay/docker-compose.yml config --no-interpolate --format json > template.json
jq -j '.configs | to_entries[] | select(.key | startswith("topup_")) | .value.content' template.json |
  docker run --rm -i "$(jq -r '.services.topup.image' template.json)" topup config check /dev/stdin
```

The stack itself needs the dstack socket and KMS. Phala Pay's
[`deploy/local/`](https://github.com/Phala-Network/phala-pay/tree/v0.3.4/deploy/local) overlay runs
the same services locally against the dstack simulator and a Garage S3 store.

## Upstream sources

- Repository: [Phala-Network/phala-pay](https://github.com/Phala-Network/phala-pay) (Apache-2.0)
- Release: [`v0.3.4`](https://github.com/Phala-Network/phala-pay/releases/tag/v0.3.4), asset `phala-cloud-template.yml`
- Template environment: [`deploy/environments/phala-cloud-template/`](https://github.com/Phala-Network/phala-pay/tree/v0.3.4/deploy/environments/phala-cloud-template/topup), rendered with `deploy/render.sh --template`
- Deployment reference: [`deploy/README.md`](https://github.com/Phala-Network/phala-pay/blob/v0.3.4/deploy/README.md#the-phala-cloud-template-variant)
- Self-hosting guide: [`docs/self-hosting.md`](https://github.com/Phala-Network/phala-pay/blob/v0.3.4/docs/self-hosting.md)
- API reference: [phala-network.github.io/phala-pay](https://phala-network.github.io/phala-pay/)
- Template icon: Phala Pay's own mark, the lime dot on a dark rounded tile,
  [`deploy/product/web/brand/mark-light.svg`](https://github.com/Phala-Network/phala-pay/blob/v0.3.4/deploy/product/web/brand/mark-light.svg)
