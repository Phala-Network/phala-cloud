# Changelog

All notable changes to `terraform-provider-phala` are documented in this file.

## [Unreleased]

### Added

- New `phala_app` resource (app-first model):
  - shared compose/env at app scope
  - replica count management via `replicas`
  - app-level outputs: `app_id`, `cvm_ids`, `endpoint`
- Release packaging script for cross-platform provider artifacts.
- CI workflow for provider tests/build checks.
- Manual GitHub release workflow for versioned artifacts.
- Feature maturity and release process documentation.

### Changed

- `image` is now updatable in-place for:
  - `phala_cvm` via `PATCH /cvms/{id}/os-image`
  - `phala_app` by updating OS image across app replicas
- Added compose-file runtime settings to `phala_cvm` and `phala_app`:
  - `public_logs`, `public_sysinfo`, `public_tcbinfo`, `gateway_enabled`, `secure_time`
  - updates use compose provision/apply flow and trigger restart/redeploy
- `storage_fs` (`zfs`/`ext4`) is now explicit and immutable (replacement required on change).
- `disk_size` updates are constrained to grow-only (shrink rejected by provider validation).

## [0.1.0] - 2026-03-07

### Added

- Initial provider MVP:
  - `phala_cvm`
  - `phala_cvm_power`
  - `phala_ssh_key`
  - `phala_account`
  - `phala_workspace`
  - `phala_sizes`
  - `phala_regions`
  - `phala_images`
- Workspace/account data sources and smoke-test example.
- Env auto-encryption flow (`env` -> `encrypted_env` + `env_keys`).
