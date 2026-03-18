# Phala Cloud Go SDK

Go client for the [Phala Cloud](https://cloud.phala.network) API.

## Installation

```bash
go get github.com/Phala-Network/phala-cloud-sdk-go
```

Requires Go 1.25+.

## Quick Start

```go
package main

import (
	"context"
	"fmt"
	"log"

	phala "github.com/Phala-Network/phala-cloud-sdk-go"
)

func main() {
	client, err := phala.NewClient(
		phala.WithAPIKey("your-api-key"),
	)
	if err != nil {
		log.Fatal(err)
	}

	ctx := context.Background()

	user, err := client.GetCurrentUser(ctx)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Hello, %s!\n", user.User.Username)
}
```

## Environment Variables

- `PHALA_CLOUD_API_KEY` — API key for authentication
- `PHALA_CLOUD_API_PREFIX` — Override base URL (default: `https://cloud-api.phala.com/api/v1`)

```go
// Reads PHALA_CLOUD_API_KEY from environment automatically
client, err := phala.NewClient()
```

## Client Options

```go
client, err := phala.NewClient(
	phala.WithAPIKey("your-api-key"),
	phala.WithBaseURL("https://custom-api.example.com/api/v1"),
	phala.WithTimeout(60 * time.Second),
	phala.WithMaxRetries(5),
	phala.WithUserAgent("my-app/1.0"),
	phala.WithHeader("X-Custom", "value"),
	phala.WithHTTPClient(customHTTPClient),
	phala.WithAPIVersion("2026-01-21"),
)
```

## Usage Examples

### Deploy a CVM

```go
ctx := context.Background()

// Step 1: Provision
provision, err := client.ProvisionCVM(ctx, &phala.ProvisionCVMRequest{
	Name:         "my-app",
	InstanceType: "tdx.small",
	ComposeFile: &phala.ComposeFile{
		DockerComposeFile: `services:
  app:
    image: nginx:latest
    ports:
      - "80:80"
`,
		GatewayEnabled: phala.Bool(true),
	},
})
if err != nil {
	log.Fatal(err)
}

// Step 2: Commit
cvm, err := client.CommitCVMProvision(ctx, &phala.CommitCVMProvisionRequest{
	AppID:       provision.AppID,
	ComposeHash: provision.ComposeHash,
})
if err != nil {
	log.Fatal(err)
}
fmt.Printf("CVM deployed: %s\n", cvm.CvmID())
```

### List and Manage CVMs

```go
// List CVMs with pagination
list, err := client.GetCVMList(ctx, &phala.PaginationOptions{Page: 1, PageSize: 10})

// Get CVM details
info, err := client.GetCVMInfo(ctx, "cvm-id")

// Lifecycle operations
_, err = client.StartCVM(ctx, "cvm-id")
_, err = client.StopCVM(ctx, "cvm-id")
_, err = client.RestartCVM(ctx, "cvm-id", &phala.RestartCVMOptions{Force: true})
_, err = client.ShutdownCVM(ctx, "cvm-id")
err = client.DeleteCVM(ctx, "cvm-id")
```

### Update CVM Configuration

```go
// Update docker compose
_, err := client.UpdateDockerCompose(ctx, "cvm-id", composeYAML, nil)

// Update pre-launch script
_, err = client.UpdatePreLaunchScript(ctx, "cvm-id", "#!/bin/sh\necho hello", nil)

// Update resources
err = client.UpdateCVMResources(ctx, "cvm-id", &phala.UpdateResourcesRequest{
	VCPU:         phala.Int(4),
	Memory:       phala.Int(8192),
	DiskSize:     phala.Int(50),
	AllowRestart: phala.Bool(true),
})

// Update visibility
_, err = client.UpdateCVMVisibility(ctx, "cvm-id", &phala.UpdateVisibilityRequest{
	PublicSysinfo: phala.Bool(true),
	PublicLogs:    phala.Bool(true),
})

// Update environment variables
_, err = client.UpdateCVMEnvs(ctx, "cvm-id", &phala.UpdateEnvsRequest{
	EncryptedEnv: encryptedHex,
})
```

### Patch CVM (Multi-field Update)

```go
compose := "services:\n  app:\n    image: nginx:latest\n"
resp, err := client.PatchCVM(ctx, "cvm-id", &phala.PatchCVMRequest{
	DockerComposeFile: &compose,
	PublicSysinfo:     phala.Bool(true),
})
if err != nil {
	log.Fatal(err)
}
if resp.RequiresOnChainHash {
	// Handle on-chain confirmation flow
	_, err = client.ConfirmCVMPatch(ctx, "cvm-id", &phala.ConfirmCVMPatchRequest{
		ComposeHash:     resp.ComposeHash,
		TransactionHash: txHash,
	})
}
```

### Watch CVM State (SSE)

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
defer cancel()

ch, err := client.WatchCVMState(ctx, "cvm-id", &phala.WatchCVMStateOptions{
	Target:     "running",
	Interval:   5,
	Timeout:    300,
	MaxRetries: 3,
})
if err != nil {
	log.Fatal(err)
}

for event := range ch {
	if event.Error != nil {
		log.Printf("error: %v", event.Error)
		continue
	}
	fmt.Printf("state: %s\n", event.Event)
}
```

### Applications

```go
apps, err := client.GetAppList(ctx)
appInfo, err := client.GetAppInfo(ctx, "app-id")
cvms, err := client.GetAppCVMs(ctx, "app-id")
revisions, err := client.GetAppRevisions(ctx, "app-id", nil)
attestation, err := client.GetAppAttestation(ctx, "app-id")
allowlist, err := client.GetAppDeviceAllowlist(ctx, "app-id")
filters, err := client.GetAppFilterOptions(ctx)
```

### SSH Keys

```go
keys, err := client.ListSSHKeys(ctx)

created, err := client.CreateSSHKey(ctx, &phala.CreateSSHKeyRequest{
	Name:      "my-key",
	PublicKey: "ssh-ed25519 AAAA...",
})

err = client.DeleteSSHKey(ctx, "key-id")

imported, err := client.ImportGithubProfileSSHKeys(ctx, "github-username")
synced, err := client.SyncGithubSSHKeys(ctx)
```

### Infrastructure & KMS

```go
// Available nodes
nodes, err := client.GetAvailableNodes(ctx)

// Instance types
families, err := client.ListAllInstanceTypeFamilies(ctx)
types, err := client.ListFamilyInstanceTypes(ctx, "tdx")

// OS images
images, err := client.GetOSImages(ctx)

// KMS
kmsList, err := client.GetKMSList(ctx)
kmsInfo, err := client.GetKMSInfo(ctx, "kms-id")
pubkey, err := client.GetAppEnvEncryptPubKey(ctx, "phala", "app-id")
onchain, err := client.GetKMSOnChainDetail(ctx, "base")
nextIDs, err := client.NextAppIDs(ctx)

// Workspaces
workspaces, err := client.ListWorkspaces(ctx)
workspace, err := client.GetWorkspace(ctx, "team-slug")
wsNodes, err := client.GetWorkspaceNodes(ctx, "team-slug", nil)
quotas, err := client.GetWorkspaceQuotas(ctx, "team-slug")
```

## Error Handling

All API errors are returned as `*phala.APIError`:

```go
info, err := client.GetCVMInfo(ctx, "nonexistent")
if err != nil {
	var apiErr *phala.APIError
	if errors.As(err, &apiErr) {
		fmt.Printf("status: %d\n", apiErr.StatusCode)
		fmt.Printf("message: %s\n", apiErr.Message)

		if apiErr.IsAuth() {
			// 401 or 403
		}
		if apiErr.IsValidation() {
			// 422
		}
		if apiErr.IsBusiness() {
			// 4xx business logic error
		}
		if apiErr.IsServer() {
			// 5xx
		}
		if apiErr.IsComposePrecondition() {
			// 465 — requires on-chain hash confirmation
		}
	}
}
```

## Automatic Retries

The client automatically retries on `409`, `429`, and `503` responses with exponential backoff (1s base, 20s max). Configure with `WithMaxRetries`:

```go
client, _ := phala.NewClient(
	phala.WithMaxRetries(10), // default: 30
)
```

## Pointer Helpers

Use `phala.String()`, `phala.Int()`, `phala.Bool()`, etc. for optional pointer fields:

```go
&phala.PatchCVMRequest{
	PublicSysinfo: phala.Bool(true),
	VCPU:          phala.Int(4),
}
```

## Project Structure

```
go/
├── client.go            # Client initialization
├── client_options.go    # WithXxx option functions
├── request.go           # HTTP request handling
├── retry.go             # Retry with exponential backoff
├── errors.go            # APIError type and classification
├── helpers.go           # CVM ID resolution, pointer helpers
├── version.go           # SDK version and defaults
├── doc.go               # Package documentation
├── auth.go              # GET /auth/me
├── apps.go              # App management
├── cvms.go              # CVM provisioning and lifecycle
├── cvms_config.go       # CVM configuration updates
├── cvms_compose.go      # Compose file operations
├── cvms_watch.go        # SSE state watching
├── ssh_keys.go          # SSH key management
├── workspaces.go        # Workspace operations
├── nodes.go             # Available nodes
├── os_images.go         # OS image listing
├── instance_types.go    # Instance type families
├── kms.go               # KMS operations
├── status.go            # Batch status queries
├── types_*.go           # Type definitions
└── e2e/                 # E2E integration tests
    └── e2e_test.go
```

## Running E2E Tests

```bash
PHALA_CLOUD_E2E_API_KEY=your-key go test -tags e2e -v -timeout 30m ./e2e/
```

## License

Apache-2.0
