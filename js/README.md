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

## License

Apache-2.0
