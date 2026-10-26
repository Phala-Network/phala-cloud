# SDK read retries

Go, JavaScript/TypeScript, and Python's sync and async clients automatically
retry buffered GET and HEAD requests with the following default policy.

## Default behavior

The SDKs retry HTTP 409, 429, and 503 responses up to 30 times after the initial
request. A 409 with a nonempty string `error_code` is permanent. Other HTTP
statuses, transport failures, and response-decoding errors return without a read
retry.

A positive `Retry-After` delay takes precedence, even when it exceeds the HTTP
timeout or the backoff cap. Integer seconds and the three HTTP-date formats are
accepted. Missing, invalid, zero, or expired values use exponential backoff:
one, two, four, eight, sixteen, then twenty seconds for every remaining retry.

Zero retries disables automatic retries; negative or fractional counts are
rejected. After exhaustion, the final HTTP error retains its status and details.
JavaScript `requestFull` and Python `request_full` return the final HTTP response.

## Configuration and cancellation

| Client | Retry budget | Operation deadline or cancellation |
|---|---|---|
| Go | `WithMaxRetries(n)` | The method's `context.Context` |
| JavaScript/TypeScript | Client or request `retry: n`; `false` also disables retries | Client or request `signal`; for example, `AbortSignal.timeout(600_000)` |
| Python sync | Client or request `max_retries=n` | Client or request `operation_timeout` in seconds; request `cancel_event=threading.Event()` |
| Python async | Client or request `max_retries=n` | Client or request `operation_timeout` in seconds; task cancellation or request `cancel_event=asyncio.Event()` |

The HTTP timeout applies to each exchange separately from retry waits. Set an
operation deadline to bound the whole sequence. Cancellation interrupts backoff
and prevents another request.

Go and JavaScript use a total timeout per HTTP exchange. Python uses HTTPX's
connect, pool, write, and read-inactivity timeouts, limited by the remaining
operation budget. An async Python deadline also interrupts an active request.
Sync Python checks cancellation between exchanges; an active socket operation
returns according to its HTTPX timeouts.

Mutation-specific retries, JavaScript's explicit ofetch customizations and
advanced `.raw` interface, and stream reconnection retain their existing policies.
