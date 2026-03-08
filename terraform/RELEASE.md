# Terraform Provider Release Guide

This guide defines how to cut and validate releases for `terraform-provider-phala`.

## Versioning

- Use semantic versioning (`MAJOR.MINOR.PATCH`).
- While `< 1.0.0`, assume `MINOR` may include breaking changes.
- Use prerelease tags for test channels (for example `0.3.0-beta.1`).

## Release Gates

Before cutting a release:

1. `make ci` passes.
2. Smoke test passes in a real workspace:
   - `make smoke-plan ...`
   - `make smoke-apply ...`
   - `make smoke-destroy ...`
3. Feature maturity updates are reflected in:
   - `FEATURE_MATURITY.md`
   - `README.md`
4. `CHANGELOG.md` has release notes for the target version.

## Build Release Artifacts Locally

```bash
cd terraform
make package-release VERSION=0.2.0
```

Outputs:

- `dist/0.2.0/terraform-provider-phala_0.2.0_<os>_<arch>.zip`
- `dist/0.2.0/terraform-provider-phala_0.2.0_SHA256SUMS`

## GitHub Release Workflow

Use workflow: `Terraform Provider Release`

Inputs:

- `version`: `0.2.0` (no `v` prefix)
- `prerelease`: `true|false`

The workflow:

1. Runs tests.
2. Builds cross-platform release artifacts.
3. Creates tag `terraform-provider-phala/v<version>`.
4. Publishes a GitHub release with zipped binaries + checksums.

## Post-release Validation

1. Download one release asset and verify checksum.
2. Verify local install with Terraform dev override.
3. Run a no-op `terraform plan` against an existing stack.
4. Run one update path (`size`, `docker_compose`, or power state) and confirm state convergence.
