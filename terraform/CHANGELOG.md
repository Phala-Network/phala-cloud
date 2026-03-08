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
