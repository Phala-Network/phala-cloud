# Changelog

All notable changes to `terraform-provider-phala` are documented in this file.

## [Unreleased]

### Removed

- **`phala_cvm` resource removed.** Use `phala_app` with `replicas = 1` instead. `phala_app` is now the sole lifecycle resource for managing CVMs on Phala Cloud.

## [0.2.0-beta.1] - 2026-03-08

### Added

- New `phala_app` resource (app-first model):
  - shared compose/env at app scope
  - replica count management via `replicas`
  - app-level outputs: `app_id`, `cvm_ids`, `endpoint`
- New `phala_nodes` data source for node placement discovery (`node_id`) with optional filters.
- New `phala_attestation` data source (read-only attestation fetch by `cvm_id`).
- Release packaging script for cross-platform provider artifacts.
- CI workflow for provider tests/build checks.
- Manual GitHub release workflow for versioned artifacts.
- Feature maturity and release process documentation.

### Changed

- `image` is now updatable in-place via `PATCH /cvms/{id}/os-image`.
- Added create-time identity/placement inputs for `phala_app`:
  - `kms` (currently `phala` only; `ethereum`/`base` planned)
  - `custom_app_id` + `nonce` (PHALA deterministic identity flow)
  - `node_id` (maps to provision `teepod_id`)
- Added compose-file runtime settings to `phala_app`:
  - `public_logs`, `public_sysinfo`, `public_tcbinfo`, `gateway_enabled`, `secure_time`
  - updates use compose provision/apply flow and trigger restart/redeploy
- `storage_fs` (`zfs`/`ext4`) is now explicit and immutable (replacement required on change).
- `disk_size` updates are constrained to grow-only (shrink rejected by provider validation).

## [0.1.0] - 2026-03-07

### Added

- Initial provider MVP:
  - `phala_app`
  - `phala_cvm_power`
  - `phala_ssh_key`
  - `phala_account`
  - `phala_workspace`
  - `phala_sizes`
  - `phala_regions`
  - `phala_images`
- Workspace/account data sources and smoke-test example.
- Env auto-encryption flow (`env` -> `encrypted_env` + `env_keys`).
