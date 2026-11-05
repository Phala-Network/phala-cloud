# Phala Cloud JavaScript SDK

TypeScript SDK for Phala Cloud API.

## Installation

```bash
# Using npm
npm install @phala/cloud

# Using yarn
yarn add @phala/cloud

# Using pnpm
pnpm add @phala/cloud

# Using bun
bun add @phala/cloud
```

## Usage

### Basic Usage

```typescript
import { createClient } from '@phala/cloud';

// Create client with API key
const client = createClient({
  apiKey: 'your-api-key',
  // Optional: override base URL
  // baseURL: 'https://custom-api.example.com'
});

// Make API requests
const result = await client.get('/kms');
console.log(result);

// Using safe methods that return a SafeResult
const safeResult = await client.safeGet('/kms');
if (safeResult.success) {
  console.log('Success:', safeResult.data);
} else {
  console.error('Error:', safeResult.error);
}
```

### Environment Variables

You can configure the client using environment variables:

- `PHALA_CLOUD_API_KEY`: API key for authentication
- `PHALA_CLOUD_API_PREFIX`: Base URL prefix for the API

```typescript
// Using environment variables (set PHALA_CLOUD_API_KEY)
const client = createClient();
```

### Debug Logging

The SDK includes built-in debug logging that can display cURL-like request and response information. To enable it, set the `DEBUG` environment variable to `phala::api-client`:

```bash
# Enable debug logging
DEBUG=phala::api-client node your-script.js

# Or with bun
DEBUG=phala::api-client bun run your-script.ts
```

This will print detailed information about each API call in a format similar to cURL:

```
=== REQUEST ===
> curl -X GET "https://cloud-api.phala.network/api/v1/kms"
    -H "X-API-Key: your-api-key"
    -H "X-Phala-Version: 2025-05-31"
    -H "Content-Type: application/json"

=== RESPONSE [GET /kms] (123ms) ===
< HTTP/1.1 200 OK
< content-type: application/json
< x-response-time: 123

{
  "data": [
    {
      "id": "example-id",
      "name": "Example Key"
    }
  ]
}
```

## Does the SDK follow redirects?

No. Redirects can send your API key to another server, so the SDK stops at the first response. This applies to API calls and SSE streams. Set `baseURL` to the final API URL instead of relying on a redirect.

Direct calls throw `PhalaCloudError` for 3xx responses. `requestFull` returns the original status, headers, and body with `ok: false`, so you can inspect the response without following it. Browsers hide manual redirect responses; in that case, `requestFull` also throws.

The SDK enforces `redirect: "manual"` at the fetch boundary, even if configuration, request options, or hooks ask to follow redirects. `client.raw.native` uses the same policy. If you supply your own transport through `client.raw.create`, it must not follow redirects internally.

## Available Methods

### Direct Methods (throw on error)

- `client.get<T>(request, options?): Promise<T>`
- `client.post<T>(request, body?, options?): Promise<T>`
- `client.put<T>(request, body?, options?): Promise<T>`
- `client.patch<T>(request, body?, options?): Promise<T>`
- `client.delete<T>(request, options?): Promise<T>`

### Safe Methods (return SafeResult)

- `client.safeGet<T>(request, options?): Promise<SafeResult<T>>`
- `client.safePost<T>(request, body?, options?): Promise<SafeResult<T>>`
- `client.safePut<T>(request, body?, options?): Promise<SafeResult<T>>`
- `client.safePatch<T>(request, body?, options?): Promise<SafeResult<T>>`
- `client.safeDelete<T>(request, options?): Promise<SafeResult<T>>`

## How do I upgrade to these SDK changes?

- `watchCvmState` with `maxRetries: N` now makes up to N+1 attempts, and `MaxRetriesExceededError.attempts` is N+1.
- The `extend()` factory now receives a `Client<ApiVersion>`. Its result type is derived from the client without `withVersion` and `extend`, which are re-typed on the result. Extension methods on a client returned by `withVersion` return `unknown`; narrow the result before using it.
- `patchCvm` now takes `gpus` in the backend shape, `{ gpus: [{ slot, product_id? }], attach_mode? }`, instead of `{ count, product_name }`. The old shape was never accepted by the API. `patchCvm` also accepts `instance_type`.
- `updateCvmVisibility` now calls `PATCH /cvms/{id}` instead of the deprecated `PATCH /cvms/{id}/visibility`. It returns `{ message, correlation_id, status }` instead of the CVM record; read the CVM with `getCvmInfo` if you need it. HTTP 465 is still thrown for contract-owned KMS until the compose hash is registered on-chain.
- `updateCvmResources` no longer sends `allow_restart`, which the API ignores. The field is deprecated.
- `LooseAppCompose.docker_compose_file` is optional, because a `bash`-runner compose has none. Check for `undefined` before using it.
- `getComposeHash` and `preprocessAppCompose` now drop null `storage_discard`, `event_log_version`, `snapshotter` and `verity_volumes`, and emit `tproxy_enabled` when it is absent (falling back to `gateway_enabled`, then `true`), as the backend does. Pass the OS image version as the second argument when you hash a compose you built yourself: it sets `manifest_version` and the `init_script` wire format for that OS.
- New: `patchCvm` takes `compose` (a JSON Merge Patch of the app compose; `null` removes a key), `init_scripts` and `confirm_data_wipe`. `provisionCvm` takes `compose_file_raw`, `init_scripts`, `launch_token`, `generate_launch_token` and `annotations`. New actions: `getCvmAnnotations`, `updateCvmAnnotations`, `getCvmInitScripts`, `setAppLaunchToken`, `clearAppLaunchToken`.

## License

Apache-2.0
