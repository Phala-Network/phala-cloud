# UX Observations - Phala Cloud CLI E2E Testing

**Purpose**: Track user experience issues, inconsistencies, and improvement opportunities discovered during E2E test development and execution.

**Last Updated**: 2025-10-10

---

## 🟢 Positive Observations

### Authentication & Status
- ✅ `phala status` command provides clear user information
- ✅ API key authentication is straightforward
- ✅ Error messages for missing authentication are clear

### Command Structure
- ✅ Command hierarchy (`phala cvms <action>`) is intuitive
- ✅ Help text is available with `--help` flag
- ✅ Alias commands (e.g., `pha` for `phala`) work well

### Power Management
- ✅ Stop/start/restart commands are simple and consistent
- ✅ Command naming matches common expectations

---

## 🟡 Areas for Improvement

### Command Consistency

#### Issue: Inconsistent Parameter Naming
**Commands Affected**: `phala deploy`, `phala cvms create`

**Observation**:
- `phala deploy` uses `--name` for CVM name
- `phala cvms create` also uses `--name`
- But some commands use `[app-id]` as positional argument

**Impact**: Medium
**Suggestion**:
- Standardize on either positional or flag-based arguments
- Document the convention clearly

#### Issue: `--json` Flag Behavior
**Commands Affected**: Multiple

**Observation**:
- Some commands output JSON by default
- Others require `--json` flag
- Not all commands support `--json`

**Impact**: Medium
**Suggestion**:
- All commands should support `--json` for programmatic use
- Default to human-readable, explicit flag for JSON
- Document which format is default for each command

### Deployment & Updates

#### Issue: No Progress Indicator During Deployment
**Commands Affected**: `phala deploy`

**Observation**:
- Deployment can take 5-10 minutes
- No progress updates during this time
- Users may think the CLI is frozen

**Impact**: High
**Suggestion**:
- Add spinner or progress bar
- Show intermediate steps: "Building...", "Provisioning...", "Starting..."
- Provide estimated time remaining

#### Issue: Update vs. Deploy Confusion
**Commands Affected**: `phala deploy --uuid`

**Observation**:
- Using `deploy` command with `--uuid` flag performs an update
- Not immediately obvious from command name
- Could have separate `phala cvms update` command

**Impact**: Low
**Suggestion**:
- Consider `phala cvms update` as alias to `phala deploy --uuid`
- Or rename to `phala deploy-or-update` with auto-detection
- Update docs to clarify update workflow

### Resource Management

#### Issue: Resource Limits Not Clear
**Commands Affected**: `phala cvms resize`

**Observation**:
- No indication of resource limits before resizing
- Unknown what maximum vCPU/memory/disk is allowed
- Errors only appear after attempting resize

**Impact**: Medium
**Suggestion**:
- Show current plan limits in help text
- Validate against limits before API call
- Suggest upgrade if limits exceeded

#### Issue: Resize Requires Restart Not Always Clear
**Commands Affected**: `phala cvms resize`

**Observation**:
- Some resizes require restart
- `--allow-restart` flag exists but default behavior unclear
- No warning about potential downtime

**Impact**: Medium
**Suggestion**:
- Clearly indicate which resizes require restart
- Prompt user for confirmation if restart needed
- Show estimated downtime

### Logs & Monitoring

#### Issue: No Direct Log Access in CLI
**Commands Affected**: N/A (feature request)

**Observation**:
- Must access dashboard to view logs
- CLI could provide `phala cvms logs <app-id>` command
- Similar to `docker logs` experience

**Impact**: High
**Suggestion**:
- Add `phala cvms logs <app-id>` command
- Support `--follow` flag for live logs
- Support `--tail N` to show last N lines

### Network & Endpoints

#### Issue: Exposed Ports Not Shown in CLI
**Commands Affected**: `phala cvms get`

**Observation**:
- CVM details don't show exposed ports
- Must check dashboard or guess from docker-compose
- Public URLs not displayed

**Impact**: Medium
**Suggestion**:
- Add `phala cvms network <app-id>` command
- Show exposed ports and public URLs
- Include in `phala cvms get` output

### Error Messages

#### Issue: Generic Error Messages
**Commands Affected**: Various

**Observation**:
- Some errors are generic: "Failed to deploy CVM"
- Stack traces shown in production
- Not always actionable

**Impact**: Medium
**Suggestion**:
- More specific error messages
- Suggest solutions when possible
- Hide stack traces unless `--debug` flag is used

---

## 🔍 Under Investigation

### Investigation #1: CVM Update Container Restart Behavior
**Commands Affected**: `phala deploy --uuid` (update operation)
**Date Started**: 2025-10-10
**Test Phase**: Phase 5 - Update CVM Code
**Status**: 🔍 Investigating - NOT confirmed as bug

**Initial Observation**:
E2E test showed that after updating docker-compose.yml with new image version:
- Update operation completed successfully
- CVM status returned to "running" immediately
- Version check showed OLD version (1.0.0) instead of expected new version (2.0.0)
- Later in Phase 7, after stop/start cycle, version showed 2.0.0

**E2E Test Timeline**:
```
19:20:16 - Update completed, CVM status: running
19:20:36 - Version check: 1.0.0 (expected 2.0.0) ❌
19:25:38 - Phase 7 stop/start executed
19:26:04 - Version check would show 2.0.0 at this point
```

**Web Console Observation**:
User reported seeing CVM as "updated and deleted" in web console, suggesting the update DID work correctly from backend perspective.

**Hypotheses**:
1. **Timing Issue**: Container restart happens asynchronously after update completes, test checked too early
2. **Event-Based Restart**: Update triggers background restart that isn't reflected in immediate status
3. **Test Design Issue**: Version check needs longer wait time or retry logic
4. **Actual Bug**: Update doesn't trigger restart at all (LEAST LIKELY given web console observation)

**Investigation Tools Created**:
- `investigate-update.ts` - Script to analyze CVM events API and check:
  - Compose update events and their timestamps
  - Power events (restart/stop/start) correlation
  - Event sequence after compose_update
  - Current app version from endpoint

**Next Steps**:
1. Run investigation script on a fresh CVM update to capture event timeline
2. Analyze events API to see if `instance.compose_update` triggers `instance.power_on` or restart events
3. Determine actual backend behavior before deciding if this is a bug or test issue
4. If bug: file backend issue
5. If timing: adjust test wait logic and add retry with exponential backoff

**DO NOT assume this is a bug** - need evidence from events API first.

---

## 🔴 Confirmed Bugs

### Bug #1: Schema Validation Mismatch (FIXED)
**Commands Affected**: `phala cvms stop`, `start`, `restart`, `create`
**Date Fixed**: 2025-10-10

**Description**:
API returns `version: null` but CLI schema expected non-null string, causing validation errors.

**Fix Applied**:
Changed `postCvmResponseSchema` line 109:
```typescript
version: z.string().nullable()
```

**Status**: ✅ Fixed in PR

**Note**: Additional nullable field mismatches exist (user_id, base_image, manifest_version, runner, docker_compose_file) - tracked separately for comprehensive fix.

---

## 🔴 Potential Bugs

### Bug #2: Delete Confirmation
**Commands Affected**: `phala cvms delete`

**Observation**: During development, noticed that...
- ❓ Waiting for actual test run to verify behavior
- ❓ Need to confirm if `-y` flag works as expected

**Impact**: TBD
**Status**: 🔍 Needs Investigation

---

## 💡 Feature Requests

### 1. Deployment Templates
**Priority**: Medium

**Description**:
Provide built-in templates for common deployments:
```bash
phala deploy --template node-express
phala deploy --template nextjs
phala deploy --template python-fastapi
```

**Benefits**:
- Faster onboarding
- Best practices baked in
- Less configuration needed

### 2. CVM Health Check Command
**Priority**: High

**Description**:
```bash
phala cvms health <app-id>
# Output:
# Status: Running
# Uptime: 2h 34m
# HTTP Endpoints: ✅ 3/3 responding
# Resources: ✅ CPU 45%, Memory 60%
# Last Error: None
```

**Benefits**:
- Quick status check
- Troubleshooting aid
- Alternative to dashboard

### 3. Dry Run Mode
**Priority**: Low

**Description**:
```bash
phala deploy --dry-run
# Shows what would be deployed without actually deploying
```

**Benefits**:
- Validation before deployment
- Cost estimation
- Configuration verification

### 4. Watch Mode for Status
**Priority**: Medium

**Description**:
```bash
phala cvms get <app-id> --watch
# Continuously updates CVM status every 5 seconds
```

**Benefits**:
- Monitor deployments
- Track updates
- Real-time feedback

---

## 📊 Consistency Checklist

Use this checklist when adding new commands:

- [ ] Command follows `phala <noun> <verb>` pattern
- [ ] Supports `--help` flag with clear description
- [ ] Supports `--json` flag for programmatic use
- [ ] Error messages are actionable
- [ ] Has examples in help text
- [ ] Documented in main CLI docs
- [ ] Has test coverage
- [ ] Follows established parameter naming conventions
- [ ] Handles common errors gracefully
- [ ] Provides progress feedback for long operations

---

## 🎯 Testing-Specific Observations

### Test Execution
- ⏱️ Full E2E test takes ~45-60 minutes
- 🐳 Docker image builds add ~2 minutes per version
- 🌐 Network endpoint availability varies (1-3 minutes)
- 🔄 Status polling every 5 seconds is reasonable

### Test Reliability
- ❓ Network flakiness may cause test failures
- ❓ Resource availability varies by time of day
- ❓ Backend API response times vary

### Test Improvements Needed
- [ ] Add retry logic for flaky network operations
- [ ] Make timeouts configurable
- [ ] Add test skip conditions (e.g., weekend runs)
- [ ] Parallel phase execution where possible

---

## 📝 Notes for Future Development

### When Adding New Features
1. Ensure `--json` output is available
2. Add comprehensive help text
3. Handle errors gracefully
4. Provide progress feedback
5. Update E2E tests

### When Fixing Bugs
1. Add test case to prevent regression
2. Update UX observations if behavior changes
3. Document any breaking changes

---

## 🔗 Related Resources

- [Phala Cloud Documentation](https://docs.phala.network)
- [CLI Reference](https://docs.phala.network/phala-cloud/references/phala-cloud-cli)
- [GitHub Issues](https://github.com/Phala-Network/phala-cloud/issues)

---

**How to Contribute to This Document**:

When you encounter a UX issue during testing:

1. Note the command and context
2. Describe the issue clearly
3. Rate the impact (High/Medium/Low)
4. Suggest a solution if possible
5. Add to appropriate section above
6. Date your entry

**Example Entry**:
```markdown
#### Issue: Command Does X When It Should Do Y
**Commands Affected**: `phala cvms example`
**Date Observed**: 2025-10-10

**Observation**:
- Describe what happened
- What you expected instead

**Impact**: Medium
**Suggestion**:
- Specific improvement recommendation
```
