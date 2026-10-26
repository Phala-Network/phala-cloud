# SDK read retries

Go, JavaScript/TypeScript, and Python's sync and async clients automatically
retry buffered GET and HEAD requests with the following default policy.

## Default behavior

The SDKs retry HTTP 409, 429, and 503 responses up to 30 times after the initial
request. A 409 with a nonempty string `error_code` is permanent. Other HTTP
statuses, transport failures, and response-decoding errors return without a read
retry.

`Retry-After` seconds or HTTP dates take precedence over default backoff, even
when the wait exceeds the HTTP timeout. Without a server delay, waits double
from one second to a twenty-second cap. Header parsing and timer limits follow
each client's libraries and runtime; malformed, zero, or expired values may
behave differently.

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

Go bounds the full HTTP exchange. JavaScript's per-attempt timeout covers
receiving the response; use an operation signal to also bound body processing
and retries. Python uses HTTPX's per-phase timeouts, limited by the remaining
operation budget. An async Python deadline also interrupts an active request.
Sync Python checks cancellation between exchanges; active sockets use HTTPX
timeouts.

Mutation-specific retries, JavaScript's explicit ofetch customizations and
advanced `.raw` interface, and stream reconnection retain their existing policies.
