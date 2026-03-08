# App Quickstart

This is the default user example for the Phala Terraform provider.

It deploys one `phala_app` with:

- `size = "tdx.medium"`
- `region = "US-WEST-1"`
- `disk_size = 40` GB
- `image = "dstack-dev-0.5.7-9b6a5239"`

These values were validated against real Phala Cloud on 2026-03-08.

## Prerequisites

- Terraform installed
- A Phala Cloud API key exported as `PHALA_CLOUD_API_KEY`

```bash
export PHALA_CLOUD_API_KEY="phak_xxx"
terraform init
terraform apply -auto-approve
terraform output
terraform destroy -auto-approve
```

If you need a different image, use `data.phala_images` and copy the exact image `slug`.
