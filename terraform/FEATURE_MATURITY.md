# Terraform Provider Feature Maturity

Last updated: 2026-03-08

## Maturity Levels

- `alpha`: implemented, but behavior/shape may still change.
- `beta`: stable behavior for normal use, with known feature gaps.
- `ga`: production-ready with compatibility and upgrade guarantees.

## Resource/Data Source Status

| Component | Level | Status | Notes |
| --- | --- | --- | --- |
| `phala_app` | beta | create/read/update/delete + replica scaling | Recommended primary abstraction: shared app-compose + env with N CVM replicas under one app_id. |
| `phala_cvm` | beta | create/read/update/delete | Core lifecycle works. Known gaps: VPC-equivalent networking, movable volumes/snapshots, full on-chain KMS create flow. |
| `phala_cvm_power` | beta | running/stopped state management | Separate action-style power control works; delete is state-only by design. |
| `phala_ssh_key` | beta | create/read/delete | DO-style key lifecycle. |
| `phala_account` | beta | read | Returns user/workspace linkage + credits. |
| `phala_workspace` | beta | read | Returns active workspace metadata. |
| `phala_sizes` | beta | read | Catalog data source. |
| `phala_regions` | beta | read | Catalog data source (apps filter options + teepod availability fallback). |
| `phala_images` | beta | read | Catalog data source. |

## Terraform UX Parity (DigitalOcean-like)

| Capability | Current |
| --- | --- |
| App-first resource + replica scaling | yes (`phala_app.replicas`) |
| Declarative compute resource (`phala_cvm`) | yes |
| Separate power resource (`phala_cvm_power`) | yes |
| Per-deploy SSH key injection | yes |
| OS image selection + update | yes (`image`, in-place via `/os-image`) |
| Encrypted env workflow | yes (auto via `env`, manual via `encrypted_env` + `env_keys`) |
| Workspace/account introspection | yes |
| Custom domain management | not yet (planned via compose definition support) |
| VPC/network primitives | not applicable (Phala serverless-style network model) |
| Portable detachable volume/snapshot primitives | not yet |

## Criteria to Reach `ga`

- Workspace isolation e2e tests in CI (cross-workspace negative checks).
- Stable docs for upgrade semantics across minor versions.
- Explicit import guidance and lifecycle caveats for all resources.
- Release automation with reproducible artifacts and checksums.
- Two consecutive provider releases with no breaking schema/state regressions.
