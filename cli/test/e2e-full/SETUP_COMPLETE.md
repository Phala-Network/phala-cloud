# E2E Full Lifecycle Test - Setup Complete ✅

**Date**: 2025-10-10
**Status**: Ready for Testing

## What Was Built

A comprehensive end-to-end test suite for the Phala Cloud CLI that validates the complete CVM lifecycle.

## Directory Structure

```
test/e2e-full/
├── fixtures/
│   └── test-app/              # Test Node.js application
│       ├── Dockerfile
│       ├── docker-compose.yml
│       ├── package.json
│       ├── index.js
│       └── .env.example
├── helpers/
│   ├── logger.ts              # Test logging utilities
│   ├── network-utils.ts       # HTTP endpoint testing
│   └── cvm-lifecycle.ts       # CVM lifecycle management
├── logs/                      # Test logs (created at runtime)
├── full-lifecycle.test.ts     # Main test suite (9 phases)
├── PROGRESS.md                # Long-term progress tracker
├── README.md                  # Complete documentation
├── UX_OBSERVATIONS.md         # UX issues tracker
└── SETUP_COMPLETE.md          # This file
```

## Test Phases

1. ✅ **Setup & Authentication** - Verify API key and user info
2. ✅ **Pre-deployment Checks** - List nodes and verify dstack API
3. ✅ **Deploy New CVM** - Build Docker image and deploy
4. ✅ **Verify Initial Deployment** - Check status and endpoints
5. ✅ **Update CVM Code** - Deploy new version (v2.0.0)
6. ✅ **Resize CVM** - Test resource modification
7. ✅ **Power Management** - Test stop/start/restart
8. ✅ **Final Verification** - Attestation and final checks
9. ✅ **Cleanup** - Delete CVM and verify removal

## Running the Tests

### Prerequisites
```bash
# 1. Set API key
export PHALA_CLOUD_API_KEY="your-api-key"

# 2. Ensure Docker is running
docker ps

# 3. Ensure phala CLI is available
which phala
```

### Execute Tests
```bash
cd cli
bun run test:e2e-full
```

### Watch Mode
```bash
bun run test:e2e-full:watch
```

## Expected Behavior

- **Duration**: 45-60 minutes for full suite
- **Artifacts**: Logs and JSON outputs saved to `logs/` directory
- **Cleanup**: Automatic CVM deletion on completion
- **Skip**: Tests skip if no API key provided

## Next Steps

1. **Run First Test**
   ```bash
   export PHALA_CLOUD_API_KEY="your-key"
   cd cli
   bun run test:e2e-full
   ```

2. **Review Results**
   - Check logs in `test/e2e-full/logs/`
   - Update `PROGRESS.md` with results
   - Document UX issues in `UX_OBSERVATIONS.md`

3. **Iterate**
   - Fix any failing tests
   - Add new test scenarios
   - Improve helper utilities
   - Track progress in `PROGRESS.md`

## Files Created

- **Test Fixtures**: 5 files (Dockerfile, compose, Node.js app)
- **Helper Utilities**: 3 TypeScript files (logger, network, lifecycle)
- **Main Test Suite**: 1 comprehensive test file with 9 phases
- **Documentation**: 3 markdown files (README, PROGRESS, UX_OBSERVATIONS)
- **Configuration**: Updated package.json and .gitignore

## Key Features

✅ Comprehensive logging (console + file)
✅ JSON artifact saving for audit trail
✅ Retry logic for network operations
✅ Long-term progress tracking
✅ UX observation documentation
✅ Easy to extend and maintain
✅ Standalone execution (separate from regular tests)

## Success Criteria

- [ ] First test run completes without errors
- [ ] All 9 phases pass successfully
- [ ] Test completes in under 60 minutes
- [ ] Logs captured and saved correctly
- [ ] CVM cleanup successful
- [ ] At least 3 UX improvements identified

## Support

- **README**: `test/e2e-full/README.md` - Complete usage guide
- **PROGRESS**: `test/e2e-full/PROGRESS.md` - Track test runs
- **UX**: `test/e2e-full/UX_OBSERVATIONS.md` - Document issues

---

**Ready to test!** 🚀

Run `bun run test:e2e-full` to start your first comprehensive E2E test.
