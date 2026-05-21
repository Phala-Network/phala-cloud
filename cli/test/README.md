# Phala TEE Cloud CLI Tests

This directory contains tests for the Phala TEE Cloud CLI.

## Test Structure

- `e2e/`: End-to-end tests for the CLI commands
  - `cli.test.ts`: General CLI tests
  - `config.test.ts`: Tests for the config commands
  - `simulator.test.ts`: Tests for the simulator commands
  - `cvms.test.ts`: Tests for the CVM commands
- `utils/`: Utility functions for testing
  - `mock.ts`: Utilities for creating mock files and directories
  - `test-helper.ts`: Helper functions for setting up test environments

## Running Tests

To run the tests, use the following command:

```bash
npm run test
```

## Writing Tests

When writing tests, use the test helper to set up the test environment:

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createTestEnvironment } from '../utils/test-helper';

describe('My Test Suite', () => {
  const { runCommand, setup, teardown } = createTestEnvironment('my-test');

  beforeAll(() => {
    setup();
  });

  afterAll(() => {
    teardown();
  });

  test('My test', async () => {
    const { stdout, exitCode } = await runCommand(['command', 'subcommand', '--option']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Expected output');
  });
});
```

## Test Environment

The test environment is set up to use a temporary directory for configuration files. This ensures that tests don't interfere with each other or with the user's actual configuration.

Each test suite gets its own temporary directory, which is cleaned up after the tests are done.

## Mocking

The `mock.ts` utility provides functions for creating mock files and directories. Use these to set up the test environment with the necessary files.

```typescript
import { createMockFile } from '../utils/mock';

// Create a mock file
createMockFile('/path/to/file.json', JSON.stringify({ key: 'value' }));
```
