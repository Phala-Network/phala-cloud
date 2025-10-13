# E2E Full Lifecycle Test - Progress Tracker

## Status: 🟡 In Development

**Last Updated**: 2025-10-10

## Implementation Progress

### Completed ✅
- [x] Phase 1: Test fixtures created (Dockerfile, docker-compose.yml, Node.js app)
- [x] Phase 2: Helper utilities implemented (logger, network-utils, cvm-lifecycle)
- [x] Phase 3: Main test suite implemented (full-lifecycle.test.ts)
- [x] Phase 4: Progress tracker created (this file)
- [ ] Phase 5: Documentation complete (README.md)
- [ ] Phase 6: UX observations document created
- [ ] Phase 7: First successful test run

## Test Phases Implementation

| Phase | Name | Status | Notes |
|-------|------|--------|-------|
| 1 | Setup & Authentication | ✅ Implemented | Verifies API key and user info |
| 2 | Pre-deployment Checks | ✅ Implemented | Lists nodes and verifies dstack API |
| 3 | Deploy New CVM | ✅ Implemented | Builds Docker image and deploys via CLI |
| 4 | Verify Initial Deployment | ✅ Implemented | Checks status, resources, and HTTP endpoints |
| 5 | Update CVM Code | ✅ Implemented | Updates to v2.0.0 and verifies |
| 6 | Resize CVM | ✅ Implemented | Tests resource resizing |
| 7 | Power Management | ✅ Implemented | Tests stop/start/restart |
| 8 | Final Verification | ✅ Implemented | Gets attestation and final checks |
| 9 | Cleanup | ✅ Implemented | Deletes CVM and verifies cleanup |

## Test Results History

| Date | Status | Duration | Phases Passed | Notes |
|------|--------|----------|---------------|-------|
| 2025-10-10 | 🟡 Not Run | - | 0/9 | Initial implementation |
| - | - | - | - | Awaiting first test run |

## Known Issues

### Blockers 🔴
- None currently identified

### Non-Blockers 🟡
- Need to verify `phala` CLI is available in PATH
- Need to configure API key in environment
- Docker must be installed and running

## UX Observations During Development

### Authentication (Phase 1)
- ✅ Good: `phala status` command provides clear user info
- 💡 Suggestion: Could add user level/tier information

### Deployment (Phase 3)
- 💡 Observation: `phala deploy` command could benefit from progress indicator
- 💡 Suggestion: Add `--wait` flag to wait for deployment completion

### Resource Management (Phase 6)
- ❓ Question: Is there a limit to how much we can resize?
- 💡 Suggestion: Provide resource limits in resize help text

### Power Management (Phase 7)
- ✅ Good: Stop/start/restart commands are intuitive
- 💡 Suggestion: Add `--force` flag for forced shutdown

### General CLI UX
- 💡 Suggestion: Add `--verbose` flag for detailed output
- 💡 Suggestion: Consistent JSON output across all commands with `--json` flag

## Next Steps

### Immediate (This Week)
- [ ] Complete README.md documentation
- [ ] Create UX_OBSERVATIONS.md document
- [ ] Update package.json with test scripts
- [ ] Run first complete test with real API key
- [ ] Document any issues encountered

### Short Term (Next Sprint)
- [ ] Add test for checking exposed ports
- [ ] Add test for log verification
- [ ] Add test for network configuration
- [ ] Optimize test timeouts based on actual performance

### Long Term (Future)
- [ ] Add parallel test execution where possible
- [ ] Add test for custom KMS scenarios
- [ ] Add test for multi-service deployments
- [ ] Create visual test report generator

## Test Execution Guide

### Prerequisites
```bash
export PHALA_CLOUD_API_KEY="your-api-key-here"
docker ps  # Verify Docker is running
which phala  # Verify CLI is installed
```

### Run Tests
```bash
cd cli
bun run test:e2e-full
```

### Expected Duration
- **Full test suite**: ~45-60 minutes
- **Individual phases**: 3-10 minutes each

## Metrics to Track

- [ ] Test execution time per phase
- [ ] API response times
- [ ] CVM deployment time
- [ ] CVM update time
- [ ] Network endpoint availability time
- [ ] Resource resize time
- [ ] Power operation (stop/start) time

## Notes

- Test creates temporary Docker images tagged as `phala-e2e-test:v1.0.0` and `phala-e2e-test:v2.0.0`
- All test logs are saved to `cli/test/e2e-full/logs/` directory
- Test artifacts (JSON outputs) are saved for audit trail
- Test cleans up created CVMs automatically (if test completes)
- If test fails mid-way, manual cleanup may be required

## Contributing

When updating this test:

1. Run the full test suite
2. Update this PROGRESS.md with results
3. Document any UX issues in UX_OBSERVATIONS.md
4. Update test metrics in the table above
5. Note any breaking changes or new requirements
