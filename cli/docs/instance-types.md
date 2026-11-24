# phala instance-types

List available instance types for CVM deployment.

## Usage

```bash
phala instance-types [family] [options]
```

## Arguments

| Name     | Required | Description                                  |
| -------- | -------- | -------------------------------------------- |
| `family` | No       | Instance type family to filter by (cpu, gpu) |

## Options

| Flag     | Short | Default | Description           |
| -------- | ----- | ------- | --------------------- |
| `--json` | `-j`  | false   | Output in JSON format |

## Examples

### List all instance types

```bash
$ phala instance-types
Instance Types:

CPU Instances:
  tdx.small    2 vCPU   4GB RAM    $0.10/hour
  tdx.medium   4 vCPU   8GB RAM    $0.20/hour
  tdx.large    8 vCPU   16GB RAM   $0.40/hour
  tdx.xlarge   16 vCPU  32GB RAM   $0.80/hour

GPU Instances:
  tdx.gpu.small   4 vCPU   8GB RAM   NVIDIA T4      $0.50/hour
  tdx.gpu.medium  8 vCPU   16GB RAM  NVIDIA A10     $1.00/hour
```

### List only CPU instance types

```bash
$ phala instance-types cpu
CPU Instances:
  tdx.small    2 vCPU   4GB RAM    $0.10/hour
  tdx.medium   4 vCPU   8GB RAM    $0.20/hour
  tdx.large    8 vCPU   16GB RAM   $0.40/hour
  tdx.xlarge   16 vCPU  32GB RAM   $0.80/hour
```

### List only GPU instance types

```bash
$ phala instance-types gpu
GPU Instances:
  tdx.gpu.small   4 vCPU   8GB RAM   NVIDIA T4      $0.50/hour
  tdx.gpu.medium  8 vCPU   16GB RAM  NVIDIA A10     $1.00/hour
  tdx.gpu.large   16 vCPU  32GB RAM  NVIDIA A100    $2.00/hour
```

### JSON output

```bash
$ phala instance-types --json
[
  {
    "name": "tdx.small",
    "vcpu": 2,
    "memory_gb": 4,
    "family": "cpu",
    "price_per_hour": 0.10,
    "regions": ["us-west", "us-east", "eu-central"]
  },
  {
    "name": "tdx.medium",
    "vcpu": 4,
    "memory_gb": 8,
    "family": "cpu",
    "price_per_hour": 0.20,
    "regions": ["us-west", "us-east", "eu-central"]
  }
]
```

### Use in scripts to find cheapest instance

```bash
$ phala instance-types --json | jq 'min_by(.price_per_hour) | .name'
"tdx.small"
```

### Check if specific type is available

```bash
$ phala instance-types --json | jq -e '.[] | select(.name == "tdx.medium")' > /dev/null
$ if [ $? -eq 0 ]; then
    echo "tdx.medium is available"
  fi
```

## Instance Type Naming Convention

Instance types follow the pattern: `tdx.<family>.<size>`

- `tdx` - TEE technology (Intel TDX)
- `family` - Instance family (cpu, gpu)
- `size` - Size tier (small, medium, large, xlarge, etc.)
