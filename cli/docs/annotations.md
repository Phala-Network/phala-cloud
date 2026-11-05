# phala annotations

Show or set the annotations of a CVM: key/value metadata that the node's dstack VMM stores for host-side tools, such as a QEMU wrapper that reads memory tiers or vCPU pinning.

Annotations are not passed to the guest, not measured, and not part of the compose hash, so attestation does not cover them. Do not rely on them for security. Phala Cloud keeps no copy: a replica starts without annotations. The feature needs the `cvm_annotations` feature flag and dstack VMM 0.6.1 or newer on the node.

## Usage

    phala annotations [cvm-id] [KEY=VALUE ...] [options]

## Arguments

| Name | Required | Description |
|------|----------|-------------|
| `cvm-id` | No | CVM identifier (UUID, app_id, instance_id, or name). Uses the CVM in `phala.toml` if omitted. An argument containing `=` is a pair, not a CVM id. |
| `KEY=VALUE` | No | Annotation to set. The value is everything after the first `=`. |

Without pairs or flags, the command shows the current annotations. With pairs, it reads the current annotations, sets the given keys, and writes the full set back.

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--unset <key>` | | Remove a key (repeatable) |
| `--clear` | false | Remove every annotation; cannot be combined with pairs or `--unset` |
| `--replace` | false | Make the given pairs the whole set instead of merging them |
| `--json` | false | JSON output |

The change applies at once, without a restart. Host tools that read annotations only when QEMU launches see the new values after the CVM restarts (`phala cvms restart`).

## Examples

Show annotations:

    $ phala annotations app_123

Set annotations on the CVM in `phala.toml`:

    $ phala annotations memory_tier=fast pin_numa=0

Remove a key:

    $ phala annotations app_123 --unset memory_tier

Replace the whole set:

    $ phala annotations app_123 memory_tier=fast --replace

Remove every annotation:

    $ phala annotations app_123 --clear
