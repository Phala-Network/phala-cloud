# HTTP Client

A function to create an HTTP Client for API interactions

An HTTP Client provides a clean interface to make HTTP requests with built-in error handling, type safety, and ofetch compatibility. It supports both traditional error throwing and safe result patterns.

## Import

```typescript
import { createClient } from '@phala/cloud-sdk'
```

## Usage

Initialize a Client with your API key and desired configuration:

```typescript
import { createClient } from '@phala/cloud-sdk'

const client = createClient({
  apiKey: 'your-api-key',
  baseURL: 'https://cloud-api.phala.network/v1' // optional
})
```

Then you can consume HTTP actions:

```typescript
// Simple GET request
const user = await client.get<User>('/users/1')

// POST with body
const newUser = await client.post<User>('/users', {
  name: 'Alice',
  email: 'alice@example.com'
})
```

## Error Handling Patterns

The HTTP Client supports **two error handling patterns** to accommodate different development preferences:

### Traditional Pattern (Throws Errors)

Use the standard HTTP methods when you prefer traditional try/catch error handling:

```typescript
try {
  const user = await client.get<User>('/users/1')
  console.log(`User: ${user.name}`)
} catch (error) {
  if (error instanceof RequestError) {
    console.error(`API Error: ${error.message}`)
    console.error(`Status: ${error.status}`)
    console.error(`Detail: ${error.detail}`)
  }
}
```

### Safe Pattern (Returns Results)

Inspired by [Zod's `safeParse` pattern](https://zod.dev/basics#handling-errors), use the safe methods to avoid try/catch blocks:

```typescript
const result = await client.safeGet<User>('/users/1')

if (!result.success) {
  // Handle error case
  console.error(`API Error: ${result.error.message}`)
  console.error(`Status: ${result.error.status}`)
} else {
  // Handle success case
  console.log(`User: ${result.data.name}`)
}
```

The result type is a discriminated union, so TypeScript will automatically narrow the types in each branch.

## API Reference

### HTTP Methods

#### Traditional Methods (Throw on Error)

```typescript
// GET request
await client.get<T>(request, options?)

// POST request  
await client.post<T>(request, body?, options?)

// PUT request
await client.put<T>(request, body?, options?)

// PATCH request
await client.patch<T>(request, body?, options?)

// DELETE request
await client.delete<T>(request, options?)
```

#### Safe Methods (Return Results)

```typescript
// Safe GET request
await client.safeGet<T>(request, options?)

// Safe POST request
await client.safePost<T>(request, body?, options?)

// Safe PUT request
await client.safePut<T>(request, body?, options?)

// Safe PATCH request
await client.safePatch<T>(request, body?, options?)

// Safe DELETE request
await client.safeDelete<T>(request, options?)
```

## Configuration

### Read retries

Buffered GET and HEAD requests allow up to 30 retries by default. Set `retry: 0`
or `retry: false` to disable them. `timeout` bounds each HTTP exchange; use a
signal to bound the whole operation, including retry waits:

```typescript
const client = createClient({ apiKey, timeout: 30_000 });
const info = await client.get('/cvms/example', {
  signal: AbortSignal.timeout(600_000),
});
```

See the [retry policy](../../docs/sdk-read-retries.md) for retryable responses,
`Retry-After` handling, and cancellation behavior.

### Basic Configuration

```typescript
const client = createClient({
  apiKey: 'your-api-key',           // Required: Your API key
  baseURL: 'https://api.custom.com', // Optional: Custom base URL
  timeout: 10000,                   // Optional: Request timeout in ms
})
```

### Advanced Configuration

The client extends [ofetch](https://github.com/unjs/ofetch) configuration, so you can use any ofetch options:

```typescript
const client = createClient({
  apiKey: 'your-api-key',
  baseURL: 'https://api.custom.com',
  timeout: 10000,
  
  // Custom headers
  headers: {
    'User-Agent': 'MyApp/1.0',
    'Accept-Language': 'en-US'
  },
  
  // Retry configuration  
  retry: 3,
  retryDelay: 1000,
  
  // Response interceptors
  onResponse({ response }) {
    console.log('Response received:', response.status)
  },
  
  onResponseError({ response, error }) {
    console.error('Request failed:', response.status)
  }
})
```

## TypeScript Support

### Type Inference

The client provides full TypeScript support with automatic type inference:

```typescript
interface User {
  id: string
  name: string
  email: string
}

// TypeScript automatically infers the return type as User
const user = await client.get<User>('/users/1')

// Safe methods return SafeResult<User, RequestError>
const result = await client.safeGet<User>('/users/1')
```

### Error Types

```typescript
import { RequestError, type SafeResult } from '@phala/cloud-sdk'

// RequestError provides detailed error information
interface RequestError {
  name: 'RequestError'
  message: string
  status?: number
  statusText?: string
  data?: unknown
  detail: string | object | Array<{msg: string}>
  code?: string
  type?: string
}

// SafeResult is a discriminated union
type SafeResult<T, E = RequestError> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: E }
```

## Advanced Usage

### Raw ofetch Access

For advanced use cases, you can access the underlying ofetch instance:

```typescript
const client = createClient({ apiKey: 'your-key' })

// Access raw ofetch instance
const response = await client.raw('/custom-endpoint', {
  method: 'PATCH',
  body: customData
})
```

### Request/Response Interception

Leverage ofetch's powerful interceptor system:

```typescript
const client = createClient({
  apiKey: 'your-key',
  
  // Log all requests
  onRequest({ request, options }) {
    console.log('[Request]', request, options)
  },
  
  // Transform responses
  onResponse({ response }) {
    console.log('[Response]', response.status)
  },
  
  // Handle errors globally
  onResponseError({ request, response, error }) {
    console.error('[Error]', response.status, request)
  }
})
```

## Error Handling Best Practices

### For Libraries and Utilities

Use safe methods when building reusable libraries:

```typescript
async function fetchUserProfile(userId: string) {
  const result = await client.safeGet<User>(`/users/${userId}`)
  
  if (!result.success) {
    // Log error and return fallback
    console.warn('Failed to fetch user:', result.error.message)
    return null
  }
  
  return result.data
}
```

### For Application Code

Use traditional methods with proper error boundaries:

```typescript
async function updateUserProfile(userId: string, updates: Partial<User>) {
  try {
    const user = await client.put<User>(`/users/${userId}`, updates)
    showSuccessMessage('Profile updated!')
    return user
  } catch (error) {
    if (error instanceof RequestError) {
      showErrorMessage(`Update failed: ${error.message}`)
    }
    throw error
  }
}
```


This design philosophy, inspired by [viem's client patterns](https://viem.sh/docs/clients/public) and [Zod's safe parsing approach](https://zod.dev/basics), provides both simplicity for basic use cases and power for complex error handling scenarios.
