# Phala Cloud CLI - Full Lifecycle E2E Tests

Comprehensive end-to-end tests that validate the entire CVM lifecycle using the Phala Cloud CLI.

## Overview

This test suite validates the complete developer journey from deployment to cleanup:

1. ✅ **Authentication** - Verify API key and user info
2. ✅ **Pre-deployment** - Check available nodes and dstack API
3. ✅ **Deploy** - Create new CVM with Docker image
4. ✅ **Verify** - Check CVM status, resources, and endpoints
5. ✅ **Update** - Deploy new code version
6. ✅ **Resize** - Modify CVM resources
7. ✅ **Power** - Test stop/start/restart operations
8. ✅ **Verify** - Final checks and attestation
9. ✅ **Cleanup** - Delete CVM and verify removal

## Prerequisites

### Required
- **Bun** (for running tests)
- **Docker** (for building test images)
- **Phala CLI** installed and available in PATH
- **API Key** from Phala Cloud dashboard

### Optional
- **Node.js 18+** (for local testing of fixtures)

## Setup

### 1. Install Phala CLI

```bash
npm install -g phala
# or
bunx phala --version
```

### 2. Get API Key

1. Log in to [Phala Cloud Dashboard](https://cloud.phala.com)
2. Navigate to Settings → API Tokens
3. Create a new token
4. Copy the token

### 3. Set Environment Variables

```bash
export PHALA_CLOUD_API_KEY="your-api-key-here"

# Optional: Skip automatic CVM cleanup after tests
export SKIP_CLEANUP=true

# Optional: Skip specific test phases (comma-separated)
export SKIP_PHASES="5,6,7"
```

### 4. Verify Docker

```bash
docker ps  # Should not error
```

## Running Tests

### Run Full Test Suite

```bash
cd cli
bun run test:e2e-full
```

### Run with Verbose Output

```bash
bun test test/e2e-full/full-lifecycle.test.ts --verbose
```

### Skip Specific Phases

Skip phases 5, 6, and 7 (useful for testing deployment without updates/resizing):

```bash
SKIP_PHASES="5,6,7" bun test test/e2e-full/full-lifecycle.test.ts
```

Skip only the power management phase:

```bash
SKIP_PHASES="7" bun test test/e2e-full/full-lifecycle.test.ts
```

### Keep CVM Alive After Tests

Prevent automatic cleanup (useful for debugging):

```bash
SKIP_CLEANUP=true bun test test/e2e-full/full-lifecycle.test.ts
```

**Important**: Remember to manually delete the CVM when done:
```bash
phala cvms list
phala cvms delete <app-id> -y
```

### Combined Flags

Run only deployment and verification phases, keeping CVM alive:

```bash
SKIP_PHASES="5,6,7,8,9" SKIP_CLEANUP=true bun test test/e2e-full/full-lifecycle.test.ts
```

### Run Specific Phase (Bun test pattern)

```bash
bun test test/e2e-full/full-lifecycle.test.ts --test-name-pattern="Phase 3"
```

## Recent Fixes

### HTTP 409 Race Condition (Fixed 2025-10-14)

**Problem**: Phase 6 (resize) was failing with HTTP 409 "Another operation is already in progress" error immediately after Phase 5 (code update) completed, even though the CVM status showed `in_progress: false`.

**Root Cause**: Backend has internal operation locks that aren't immediately reflected in the CVM status API. The `--wait` flag on deploy/update waits for frontend status but not backend lock release.

**Fix**: Created `waitForOperationsComplete()` helper in `test/e2e-full/helpers/cvm-lifecycle.ts:123-206` that:
1. Polls event logs API for most recent operation status
2. Checks CVM's `in_progress` boolean flag
3. Only proceeds when BOTH conditions are met:
   - Most recent event has `status: "completed"`
   - CVM's `in_progress` flag is `false`
4. Times out after 60 seconds with warning (non-fatal)

**Results**:
- Successfully detects operation completion in ~900ms ✅
- Prevents HTTP 409 race conditions ✅
- Phase 6 now reliably waits for backend to be ready ✅

### Phase 6 Resize Timeout (Fixed 2025-10-13)

**Problem**: Phase 6 was timing out after 5 minutes with the CLI hanging indefinitely.

**Root Cause**: In `src/commands/cvms/resize.ts:154`, `logger.keyValueTable()` was called **before** the `if (!options.yes)` check, causing the CLI to block in non-interactive mode with `--json` flag.

**Fix**:
1. Moved `logger.keyValueTable()` inside `if (!options.yes)` block (only shows in interactive mode)
2. Added TTY detection for better non-interactive handling
3. Made `-y` flag enable partial parameter updates (only specified params are changed)
4. Added clear error messages for non-interactive mode without `-y`

**Results**:
- Before: Command hung for 5+ minutes ❌
- After: Completes in ~2 seconds, full stabilization in ~16 seconds ✅
- Resize successfully changes vCPU from 1 to 2 ✅

### Event Log Collection

Added `getCvmEventLogs()` helper to collect CVM event history before cleanup. Event logs show:
- `instance.power_on` - VM boot events
- `instance.resize` - Resource change events
- `instance.shutdown` - VM stop events
- `instance.compose_update` - Code deployment events

Event logs are saved as artifacts in `test/e2e-full/logs/full-lifecycle-*-event-logs-*.json`.

### Phase 9 Deletion Verification (Fixed 2025-10-14)

**Problem**: Test was checking CVM deletion too quickly with a fixed 10-second delay, reporting "CVM still exists" even though it was actually deleted.

**Root Cause**: CVM deletion is asynchronous and can take 20-30+ seconds to complete.

**Fix**: Replaced fixed delay with polling loop that:
1. Attempts to get CVM details every 2 seconds
2. Considers deletion complete when API returns 404
3. Times out after 60 seconds with warning
4. Logs actual deletion duration

**Results**:
- Accurately detects when CVM is truly deleted ✅
- No more false positives ✅
- Provides timing metrics for deletion operations ✅

## Test Structure

```
test/e2e-full/
├── fixtures/
│   └── test-app/          # Test application for deployment
│       ├── Dockerfile
│       ├── docker-compose.yml
│       ├── package.json
│       └── index.js
├── helpers/
│   ├── logger.ts          # Test logging utilities
│   ├── network-utils.ts   # HTTP endpoint testing
│   └── cvm-lifecycle.ts   # CVM status polling + event logs
├── logs/                  # Test execution logs (gitignored)
├── full-lifecycle.test.ts # Main test suite
├── PROGRESS.md            # Long-term progress tracking
├── UX_OBSERVATIONS.md     # UX issues and suggestions
└── README.md              # This file
```

## Test Fixtures

### Test Application

A lightweight Node.js HTTP server with the following endpoints:

- `GET /` - Welcome message
- `GET /health` - Health check (returns `{"status": "healthy"}`)
- `GET /version` - Version info (returns `{"version": "1.0.0"}`)

The app is containerized and deployed to Phala Cloud during tests.

## Expected Duration

| Phase | Time | Notes |
|-------|------|-------|
| Phase 1: Auth | ~30s | Quick API check |
| Phase 2: Pre-deployment | ~30s | Node listing |
| Phase 3: Deploy | ~8-10min | Docker build + CVM creation |
| Phase 4: Verify | ~3-5min | Status polling + HTTP checks |
| Phase 5: Update | ~8-10min | New image build + update |
| Phase 6: Resize | ~2-3min | Resource modification |
| Phase 7: Power | ~5-8min | Stop/start/restart |
| Phase 8: Final Verify | ~2-3min | Attestation + checks |
| Phase 9: Cleanup | ~1-2min | CVM deletion |
| **Total** | **45-60min** | Full test suite |

## Test Artifacts

All test executions create artifacts in `test/e2e-full/logs/`:

- `full-lifecycle-<timestamp>.log` - Complete test log
- `full-lifecycle-user-info-<timestamp>.json` - User information
- `full-lifecycle-available-nodes-<timestamp>.json` - Node listing
- `full-lifecycle-deploy-result-<timestamp>.json` - Deployment output
- `full-lifecycle-cvm-details-<timestamp>.json` - CVM details
- `full-lifecycle-final-cvm-details-<timestamp>.json` - Final state
- `full-lifecycle-attestation-<timestamp>.json` - Attestation data

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PHALA_CLOUD_API_KEY` | Yes | - | Your Phala Cloud API key |
| `SKIP_CLEANUP` | No | `false` | Set to `"true"` to prevent automatic CVM deletion |
| `SKIP_PHASES` | No | - | Comma-separated phase numbers to skip (e.g., `"5,6,7"`) |

## Troubleshooting

### Test Skipped (No API Key)

```
⚠️  E2E Full Lifecycle tests skipped!
Set PHALA_CLOUD_API_KEY environment variable to run these tests.
```

**Solution**: Export your API key:
```bash
export PHALA_CLOUD_API_KEY="phak_..."
```

### Phala CLI Not Found

```
Error: Command failed: phala deploy ...
```

**Solution**: Install the CLI or add to PATH:
```bash
npm install -g phala
# or ensure it's in your PATH
export PATH="$PATH:/path/to/phala/bin"
```

### Docker Build Fails

```
Error: Docker build failed
```

**Solution**: Ensure Docker is running:
```bash
docker ps
# If not running:
# macOS: Open Docker Desktop
# Linux: sudo systemctl start docker
```

### CVM Deployment Timeout

```
Timeout waiting for CVM to reach status running
```

**Possible causes**:
- Network issues
- Resource unavailability
- Backend issues

**Solution**:
1. Check Phala Cloud status
2. Try with different node: modify test to select specific node
3. Increase timeout in test (edit `timeoutMs` parameters)

### Backend API Timeout (TimeoutError)

```
[TimeoutError]: The operation was aborted due to timeout
```

**Possible causes**:
- Backend API performance issues
- Long-running operations (deploy, update, resize)
- Network connectivity problems

**Current Status**: Observing intermittent TimeoutErrors in Phase 5 (deploy) and Phase 6 (resize) operations. These appear to be transient backend performance issues rather than code bugs.

**Mitigation**: The `waitForOperationsComplete()` helper successfully prevents HTTP 409 race conditions when the backend is responsive. Timeout issues are separate and require backend investigation.

### HTTP Endpoint Not Accessible

```
Timeout waiting for port 3000 to be exposed
```

**Possible causes**:
- CVM networking not ready
- Port not properly exposed in docker-compose.yml
- DNS propagation delay

**Solution**:
1. Wait longer (network setup can take 2-3 minutes)
2. Check CVM logs in dashboard
3. Verify docker-compose.yml port mappings

### Cleanup Fails

If the test fails and doesn't clean up the CVM:

```bash
# List your CVMs
phala cvms list

# Delete manually
phala cvms delete <app-id>
```

## Extending Tests

### Add New Test Phase

```typescript
test(
	"Phase X: Your new test",
	async () => {
		logger.step("Phase X: Description");

		// Your test logic here

		logger.success("Phase X completed");
	},
	{ timeout: 300000 }, // 5 minutes
);
```

### Add New Helper Function

In `helpers/`:

```typescript
export async function yourHelper(
	logger: TestLogger,
	param: string,
): Promise<void> {
	logger.info("Doing something...");
	// Implementation
	logger.success("Done!");
}
```

### Add New Endpoint Test

```typescript
const data = await testJsonEndpoint<YourType>(
	`${publicUrl}/your-endpoint`,
	["expectedField1", "expectedField2"],
);

expect(data.expectedField1).toBe("expectedValue");
```

## Best Practices

1. **Always use logger** - All output should go through the logger for proper logging
2. **Save artifacts** - Use `logger.saveArtifact()` for important data
3. **Handle errors** - Use `logError()` for detailed error context
4. **Set timeouts** - All async operations should have reasonable timeouts
5. **Clean up** - Always clean up resources, even on failure
6. **Update PROGRESS.md** - Document test runs and findings

## CI/CD Integration

To run in CI/CD:

```yaml
# GitHub Actions example
- name: Run E2E Tests
  env:
    PHALA_CLOUD_API_KEY: ${{ secrets.PHALA_API_KEY }}
  run: |
    cd cli
    bun install
    bun run test:e2e-full
  timeout-minutes: 90
```

## Support

- **Documentation**: [docs.phala.network](https://docs.phala.network)
- **Issues**: [github.com/Phala-Network/phala-cloud/issues](https://github.com/Phala-Network/phala-cloud/issues)
- **Discord**: [Phala Network Discord](https://phala.com/discord)

## Contributing

1. Run the full test suite
2. Update `PROGRESS.md` with results
3. Document UX issues in `UX_OBSERVATIONS.md`
4. Submit PR with test logs attached
