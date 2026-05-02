# Issue #243: Per-instance stateful replica primitives

## Summary

This repository contains the public CLI, SDK, and docs for Phala Cloud, but not the cloud backend service that would implement new app lifecycle semantics. The first useful public slice should therefore expose the per-instance shape that already exists in the API responses, while deferring new control-plane behavior that requires backend and likely scheduler/reconciler work.

## What is already exposed today

- `GET /apps/{appId}` already returns `cvms[]` and `cvm_count` in the SDK schemas used by this repo.
- `GET /apps/{appId}/cvms` already returns per-CVM rows.
- CVM payloads in the SDK schemas already include `instance_id`, `vm_uuid`, `app_id`, resource info, and status.
- Existing per-CVM lifecycle operations already exist for a resolved CVM identity:
  - restart
  - stop
  - start
  - delete

That means the API already has enough read surface for operators to discover stable replica identity, and enough write surface for a first round of manual per-instance operations once a replica is addressed by UUID / instance ID instead of only by app-level views.

## Proposed phased implementation

### Phase 1: expose per-instance identity in public tools

Scope for this repo:

- fix CLI replica visibility so `phala cvms list` shows every replica rather than only `current_cvm`
- surface `instance_id` and `vm_uuid` in `phala cvms get`
- document the current per-replica operational path:
  - discover replicas from `apps/{appId}/cvms`
  - target one replica via UUID / instance ID
  - use existing restart / stop / delete operations on that specific CVM

This is a safe first PR because it is grounded in response fields already present in this repo's SDK schemas and does not invent new public API contracts.

### Phase 2: new app-level stateful rollout primitives

Likely requires backend work outside this repository:

- `update_policy` persisted on app spec
- ordered rollout enforcement with at least `max_unavailable = 0`
- workload lifecycle hook plumbing
- health-check-driven auto-heal / reconcile
- explicit preserved-state metadata on instance responses if not already sourced from backend models

These are not just CLI/SDK additions. They imply control-plane behavior, state transitions, rollout orchestration, and probably DB/API changes in the internal cloud service.

## Open API questions to settle before provider work

1. Is the persisted dstack instance identity considered stable and supported as a first-class public field for operators?
2. Should per-instance operations be modeled as:
   - app-scoped resources (`/apps/{appId}/instances/...`), or
   - CVM-scoped operations over existing instance rows?
3. Where should preserved-state metadata live in the public response shape:
   - on each instance row directly, or
   - on a future app-instance resource?
4. Should rollout semantics live only on the app spec, or also expose an explicit rollout/revision resource?

## Why stop Phase 1 here

Without backend code in this repo, adding SDK/CLI methods for hypothetical endpoints would be guesswork. The public contract needs maintainer confirmation before shipping anything beyond the already-exposed per-instance read/write surface.
