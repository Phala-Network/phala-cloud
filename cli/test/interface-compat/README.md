# CLI Interface Compatibility Tests

This test suite validates backward compatibility with phala@1.0.40 CLI interface.

## Purpose

These tests ensure that the CLI interface remains 100% compatible with v1.0.40, preventing breaking changes that would affect existing users, scripts, and automation.

## What These Tests Cover

Unlike E2E tests (which test actual API integration), these tests focus on CLI interface contracts:

1. **Command Existence** - All v1.0.40 commands still exist
2. **Flag Compatibility** - All flags (long and short forms) are preserved
3. **Help Text** - Help documentation is complete and accurate
4. **Error Messages** - Error handling is consistent and user-friendly
5. **JSON Output** - JSON schemas remain stable for automation
6. **Default Values** - Default behaviors haven't changed

## Test Characteristics

- **Speed**: <10 seconds (vs 45-60 minutes for E2E)
- **Dependencies**: None (no API key, network, or Docker required)
- **When to run**: On every commit (CI-friendly)
- **What they catch**: Breaking interface changes

## Running the Tests

```bash
# Run interface compatibility tests only
bun run test:interface

# Run all tests (interface + E2E)
bun run test:all

# Run specific test file
bun test test/interface-compat/flag-compatibility.test.ts
```

## Test Files

| File | Purpose |
|------|---------|
| `command-existence.test.ts` | Verifies all v1.0.40 commands still exist |
| `flag-compatibility.test.ts` | Validates all flags are supported (long & short forms) |
| `help-text.test.ts` | Ensures help text is complete and accurate |
| `error-messages.test.ts` | Validates error handling and exit codes |
| `json-output.test.ts` | Verifies JSON output stability |
| `defaults.test.ts` | Confirms default values haven't changed |

## Helpers

| File | Purpose |
|------|---------|
| `helpers/command-runner.ts` | Utilities for running CLI commands in tests |
| `helpers/v1-0-40-baseline.ts` | v1.0.40 interface specification baseline |

## How It Works

1. **Baseline Specification**: The `v1-0-40-baseline.ts` file documents the complete CLI interface from v1.0.40
2. **Command Execution**: Tests run CLI commands via `--help` and validate outputs
3. **No Mocking**: Tests run actual CLI binary (built from current code)
4. **No API Calls**: Tests only check interface, not functionality

## What's NOT Tested Here

These tests do NOT replace E2E tests. They complement them:

- ❌ Actual API integration (use E2E tests)
- ❌ Real deployments and CVM operations (use E2E tests)
- ❌ Network connectivity (use E2E tests)
- ❌ Docker operations (use E2E tests)
- ✅ Command parsing and interface contracts (use these tests)

## CI Integration

These tests should run in CI on every PR:

```yaml
- name: Run interface compatibility tests
  run: |
    cd cli
    bun install
    bun run build
    bun run test:interface
```

## Maintenance

When adding new commands or flags:

1. Add them to `v1-0-40-baseline.ts` (if backported to v1.0.40)
2. Add test cases for new commands
3. Ensure new flags are additive (don't break existing usage)

When updating to a new major version:

1. Create a new baseline file (e.g., `v1-1-0-baseline.ts`)
2. Update tests to use new baseline
3. Document breaking changes

## Success Criteria

All tests passing = 100% backward compatible with v1.0.40

If tests fail:
- **Command existence failure** → Breaking change (command removed/renamed)
- **Flag compatibility failure** → Breaking change (flag removed/renamed)
- **Help text failure** → Documentation regression
- **Error message failure** → Error handling changed
- **JSON output failure** → Automation may break
- **Defaults failure** → Behavior changed

## Related Documents

- `/cli/test/e2e-full/PROGRESS.md` - E2E test status
- `/cli/E2E_TEST_FIXES.md` - Bugs found during E2E testing
- `/CLAUDE.md` - Repository development guide
