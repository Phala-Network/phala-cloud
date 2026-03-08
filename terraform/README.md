# Terraform Provider: Phala Cloud

Deploy confidential apps and CVMs on Phala Cloud with Terraform.

Start with `phala_app`. It deploys one app definition with shared Docker Compose, shared environment, and one or more CVM replicas behind a single app identity. That is the default Phala Cloud workflow this provider is built around.

This provider is intentionally close to the Terraform ergonomics people expect from providers like DigitalOcean: catalog data sources, declarative compute resources, explicit power control, SSH key resources, and straightforward outputs such as `app_id`, `cvm_ids`, and `endpoint`.

## Before You Start

You need:

- Terraform installed.
- A Phala Cloud account.
- A Phala Cloud API key.
- An SSH public key only if you want SSH access inside a deployment.

Get an API key from the Phala Cloud dashboard:

1. Sign in to `https://cloud.phala.com`.
2. Open `Settings` -> `API Keys` or your profile page.
3. Create a key and export it:

```bash
export PHALA_CLOUD_API_KEY="phak_xxx"
```

Provider environment variables:

- `PHALA_CLOUD_API_KEY`
- `PHALA_CLOUD_API_PREFIX`

## Quick Start

This is the default path. It deploys one app with one replica and gives you an `app_id` and public endpoint.

The example below uses concrete defaults:

- `size = "tdx.medium"`
- `region = "US-WEST-1"`
- `disk_size = 40` (GB)
- `image = "dstack-dev-0.5.7-9b6a5239"`

These values were tested against real Phala Cloud on March 8, 2026. If you need different sizes, regions, or images, use the discovery examples in `Common Tasks` after you complete this first deploy.

```hcl
terraform {
  required_providers {
    phala = {
      source  = "phala-network/phala"
      version = "0.2.0-beta.1" # or newer published version
    }
  }
}

provider "phala" {}

resource "phala_app" "hello" {
  name      = "hello-phala"
  size      = "tdx.medium"
  region    = "US-WEST-1"
  image     = "dstack-dev-0.5.7-9b6a5239" # use a full image slug from data.phala_images
  disk_size = 40 # GB
  replicas  = 1

  docker_compose = <<-YAML
    services:
      web:
        image: nginx:stable
        ports:
          - "80:80"
  YAML

  wait_for_ready       = true
  wait_timeout_seconds = 900
}

output "app_id" {
  value = phala_app.hello.app_id
}

output "endpoint" {
  value = phala_app.hello.endpoint
}
```

Run:

```bash
terraform init
terraform apply -auto-approve
terraform output
terraform destroy -auto-approve
```

What success looks like:

- Terraform prints an `app_id`.
- Terraform prints a public `endpoint`.
- The app appears in your Phala Cloud dashboard and reaches running state.

If you want to test unreleased provider code from this repo, skip this path and use `Developer Mode` below.

## Common Tasks

### Discover available sizes, regions, images, nodes, and workspace info

```hcl
data "phala_sizes" "all" {}

data "phala_regions" "all" {}

data "phala_images" "all" {
  # optional region filter
  # region = "us-east"
}

data "phala_nodes" "west" {
  region = "us-west"
}

data "phala_account" "current" {}

data "phala_workspace" "current" {}

data "phala_attestation" "web" {
  cvm_id = "app_abc123"
}
```

For image selection, use the exact `slug` from `data.phala_images`. Do not shorten it to `dstack-dev` or `dstack-dev-0.5.7`.

```hcl
data "phala_images" "west" {
  region = "us-west"
}

output "image_slugs" {
  value = data.phala_images.west.images[*].slug
}
```

### Advanced: deploy a single CVM with SSH access

```hcl
resource "phala_ssh_key" "laptop" {
  name       = "laptop"
  public_key = file("~/.ssh/id_ed25519.pub")
}

locals {
  chosen_size   = data.phala_sizes.all.sizes[0].slug
  chosen_region = data.phala_regions.all.regions[0].slug
}

resource "phala_cvm" "web" {
  name           = "my-phala-web"
  size           = local.chosen_size
  region         = local.chosen_region
  ssh_authorized_keys = [
    file("~/.ssh/id_ed25519.pub"),
  ]
  env = {
    APP_SECRET = "replace-me"
  }
  docker_compose = <<-YAML
    services:
      web:
        image: nginx:stable
        ports:
          - "80:80"
  YAML

  wait_for_ready       = true
  wait_timeout_seconds = 900
}

resource "phala_cvm_power" "web_power" {
  cvm_id = phala_cvm.web.id
  state  = "running" # or "stopped"

  wait_for_state       = true
  wait_timeout_seconds = 900
}
```

### Deploy one app and wire its outputs into another app

```hcl
resource "phala_app" "api" {
  name           = "api-app"
  size           = data.phala_sizes.all.sizes[0].slug
  region         = data.phala_regions.all.regions[0].slug
  replicas       = 2
  docker_compose = <<-YAML
    services:
      api:
        image: nginx:stable
        ports:
          - "80:80"
  YAML
}

resource "phala_app" "consumer" {
  name           = "consumer-app"
  size           = data.phala_sizes.all.sizes[0].slug
  region         = data.phala_regions.all.regions[0].slug
  replicas       = 1
  docker_compose = <<-YAML
    services:
      app:
        image: nginx:stable
        ports:
          - "80:80"
  YAML
  env = {
    UPSTREAM_APP_ID   = phala_app.api.app_id
    UPSTREAM_ENDPOINT = phala_app.api.endpoint
  }
}
```

### Pin placement to a specific node

```hcl
data "phala_nodes" "west" {
  region = "us-west"
}

resource "phala_cvm" "pinned" {
  name    = "pinned-cvm"
  size    = data.phala_sizes.all.sizes[0].slug
  node_id = data.phala_nodes.west.nodes[0].node_id

  docker_compose = <<-YAML
    services:
      web:
        image: nginx:stable
        ports:
          - "80:80"
  YAML
}
```

## Developer Mode (Contributors)

Use this only when developing the provider from source (dev overrides + local binary).

The repo includes a smoke example and `make` targets under [`examples/smoke`](./examples/smoke).

Read-only smoke (catalog data sources only):

```bash
cd terraform
make smoke-plan PHALA_API_KEY="phat_xxx" CREATE_RESOURCES=false
```

Create + destroy smoke:

```bash
cd terraform
make smoke-apply \
  PHALA_API_KEY="phat_xxx" \
  CREATE_RESOURCES=true \
  CREATE_APP_RESOURCES=true \
  APP_NAME="tf-smoke-app" \
  APP_REPLICAS=2 \
  CREATE_CONSUMER_APP=true \
  CONSUMER_APP_NAME="tf-smoke-consumer" \
  CONSUMER_APP_REPLICAS=1 \
  CVM_NAME="tf-smoke-cvm" \
  CREATE_LINKED_CVM=true \
  LINKED_CVM_NAME="tf-smoke-cvm-linked" \
  CVM_SSH_AUTHORIZED_KEYS='["ssh-ed25519 AAAA... your-key"]' \
  CVM_ENV='{"APP_SECRET":"replace-me"}' \
  LINKED_CVM_ENV='{"CONSUMER_MODE":"true"}' \
  CVM_POWER_STATE="stopped" \
  WAIT_FOR_READY=false \
  SSH_PUBLIC_KEY="$(cat ~/.ssh/id_ed25519.pub)"

make smoke-destroy \
  PHALA_API_KEY="phat_xxx" \
  CREATE_RESOURCES=true \
  CREATE_APP_RESOURCES=true \
  APP_NAME="tf-smoke-app" \
  APP_REPLICAS=2 \
  CREATE_CONSUMER_APP=true \
  CONSUMER_APP_NAME="tf-smoke-consumer" \
  CONSUMER_APP_REPLICAS=1 \
  CVM_NAME="tf-smoke-cvm" \
  CREATE_LINKED_CVM=true \
  LINKED_CVM_NAME="tf-smoke-cvm-linked" \
  CVM_SSH_AUTHORIZED_KEYS='["ssh-ed25519 AAAA... your-key"]' \
  CVM_ENV='{"APP_SECRET":"replace-me"}' \
  LINKED_CVM_ENV='{"CONSUMER_MODE":"true"}' \
  CVM_POWER_STATE="stopped" \
  WAIT_FOR_READY=false \
  SSH_PUBLIC_KEY="$(cat ~/.ssh/id_ed25519.pub)"
```

Notes:

- `make` writes a local Terraform CLI config at `/tmp/phala-tf-dev/terraformrc` with `dev_overrides` so your global `~/.terraformrc` is unchanged.
- Smoke variables can be overridden with `SIZE`, `REGION`, and `IMAGE`.
- Set `CVM_POWER_STATE=running|stopped` to exercise `phala_cvm_power` in smoke tests.
- Set `CREATE_APP_RESOURCES=true` to exercise app-first orchestration with shared compose/env and `replicas` scaling.
- Set `CREATE_CONSUMER_APP=true` to exercise cross-app wiring (`UPSTREAM_APP_ID`, `UPSTREAM_ENDPOINT`).
- Set `CREATE_LINKED_CVM=true` to exercise multi-CVM wiring where the linked CVM receives `PRIMARY_APP_ID` and `PRIMARY_ENDPOINT` from the primary CVM.
- `WAIT_FOR_READY=false` can be useful for infrastructure lifecycle tests when runtime boot latency is variable.

## Behavior and Lifecycle Notes

### `phala_cvm`

- Create flow follows Phala's two-step API: `POST /cvms/provision` then `POST /cvms`.
- Create-time identity/placement fields:
  - `kms` (currently `phala` only; `ethereum`/`base` planned)
  - `custom_app_id` + `nonce` (deterministic identity flow for PHALA KMS)
  - `node_id` (maps to provision `teepod_id`; discover via `data.phala_nodes`)
- In-place updates: size, disk, OS image (`PATCH /cvms/{id}/os-image`), docker compose, pre-launch script, encrypted env (`PATCH /cvms/{id}/envs`).
- Compose-file runtime settings are exposed as first-class attributes:
  - `public_logs`
  - `public_sysinfo`
  - `public_tcbinfo`
  - `gateway_enabled`
  - `secure_time`
  - `storage_fs`
- Changing compose-file runtime settings triggers compose provision/apply flow and CVM restart (`/cvms/{id}/compose_file/provision` + `/cvms/{id}/compose_file`).
- Per-deployment SSH keys are supported via `ssh_authorized_keys` (applied at create time using `user_config`; force-new).
- `storage_fs` is immutable after initial deployment (`zfs` or `ext4`); changing it forces replacement.
- `disk_size` can only grow (shrink is rejected).
- CPU/RAM changes are supported through `size` updates.
- Encrypted secret modes:
  - `env` (recommended): provider auto-derives `env_keys` and encrypts values before API calls.
  - `encrypted_env` + `env_keys` (manual): pass-through encrypted payload mode.
- State caveat:
  - `env` is sensitive but still stored in Terraform state; use manual `encrypted_env` mode if plaintext state storage is unacceptable.
- Optional phase-2 fields for on-chain KMS env updates:
  - `env_compose_hash`
  - `env_transaction_hash`
- Mode rule:
  - `env` cannot be combined with `encrypted_env`/`env_keys` in the same resource.
- Manual encrypted fields:
  - `encrypted_env` (sensitive, pass-through hex blob)
  - `env_keys` (allowed env keys)
- Force-new fields: `name`, `region`, `listed`, `ssh_authorized_keys`, `storage_fs`.

### `phala_attestation` (data source)

- Read-only attestation fetch by `cvm_id`.
- Returns:
  - `is_online`, `is_public`, `error`, `compose_file`
  - `tcb_info_json`, `app_certificates_json`
  - `raw_json` (full response)

### `phala_cvm_power`

- Backed by:
  - `POST /cvms/{id}/start`
  - `POST /cvms/{id}/stop`
  - `GET /cvms/{id}` (read/drift detection)
- `state` accepts `running` or `stopped`.
- Delete is no-op (removes Terraform state only; does not change CVM runtime).

### `phala_ssh_key`

- Backed by:
  - `POST /user/ssh-keys`
  - `GET /user/ssh-keys`
  - `DELETE /user/ssh-keys/{id}`
- `name` and `public_key` are immutable (replace on change), similar to DO-style patterns.

## Project Status

- Current maturity: `beta`.
- Detailed matrix: [FEATURE_MATURITY.md](./FEATURE_MATURITY.md)
- Release history: [CHANGELOG.md](./CHANGELOG.md)

## Roadmap

- On-chain KMS create/update flows (BASE/ETHEREUM).
- Add richer filtering for data sources (`images`, `sizes`, `regions`).

## Maintainers

Release process and gates: [RELEASE.md](./RELEASE.md)

### Release Quick Path

```bash
cd terraform
make ci
make package-release VERSION=0.2.0
```

Then run the `Terraform Provider Release` GitHub workflow with:

- `version=0.2.0`
- `prerelease=false` (or `true` for prerelease channels)

## OpenAPI-generated Client

This provider includes an OpenAPI-generated Go client in [`internal/phalaapi`](./internal/phalaapi), sourced from:

- `https://cloud-api.phala.network/openapi.json`

Regenerate it with:

```bash
go generate ./internal/phalaapi
```

Notes:

- The upstream OpenAPI is currently `3.1.0`, and codegen compatibility is improved by a normalization step in [`openapi/normalize-openapi.jq`](./openapi/normalize-openapi.jq).
- Some SDK endpoints used by this provider (`/instance-types`, `/user/ssh-keys`) are not currently present in the public OpenAPI schema; those remain on fallback HTTP path handling for now.
