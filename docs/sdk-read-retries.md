# SDK read retry contract

Go, JavaScript/TypeScript, and Python's synchronous and asynchronous clients use
the same default policy for buffered API reads. The shared cases in
[`go/testdata/read-retry.json`](../go/testdata/read-retry.json) are exercised by
all four clients in CI. Keeping the fixture inside the Go module also makes its
tests work from a downloaded module archive.

Retry execution uses `cenkalti/backoff/v5` in Go, `p-retry` in JavaScript, and
Tenacity's `Retrying` and `AsyncRetrying` in Python. The SDK adapters classify
responses, select server-directed waits, and connect cancellation and deadlines
to those libraries. JavaScript uses `retry` for exponential delays and `delay`
with `long-timeout` for cancellable waits above the native timer limit; its
CommonJS build bundles ESM dependencies to retain Node 18 compatibility.

## Default behavior

GET and HEAD requests retry HTTP 409, 429, and 503 responses, with at most 30
retries after the initial request. A 409 with a nonempty string `error_code` is
permanent. Other HTTP statuses, transport failures, and response-decoding errors
do not enter the automatic read retry loop.

A positive `Retry-After` delay takes precedence, even when it exceeds the HTTP
timeout or the backoff cap. Decimal seconds and the three HTTP-date formats are
accepted. Missing, invalid, zero, or expired values use exponential backoff:
one, two, four, eight, sixteen, then twenty seconds for every remaining retry.
Oversized numeric delays are saturated without wrapping into an immediate retry.

No wait follows the final failed attempt. Zero retries disables the loop;
negative or fractional retry counts are rejected. Cancellation is checked before
each attempt and during backoff. The final HTTP error retains its original status
and details. JavaScript `requestFull` and Python `request_full` instead return
the final HTTP response, preserving their existing non-throwing status behavior.

## Configuration and cancellation

| Client | Retry budget | Operation deadline or cancellation |
|---|---|---|
| Go | `WithMaxRetries(n)` | The method's `context.Context` |
| JavaScript/TypeScript | Client or request `retry: n`; `false` also disables retries | Client or request `signal`; for example, `AbortSignal.timeout(600_000)` |
| Python sync | Client or request `max_retries=n` | Client or request `operation_timeout` in seconds; request `cancel_event=threading.Event()` |
| Python async | Client or request `max_retries=n` | Client or request `operation_timeout` in seconds; task cancellation or request `cancel_event=asyncio.Event()` |

The HTTP timeout applies to each exchange separately from retry waits. Supply
an operation deadline when the whole retry sequence needs a time budget. Each
Python request gets the smaller of the remaining operation budget and its HTTPX
timeout settings. Derived Python clients retain both retry options.

Transport timing follows each language's HTTP client. Go uses `net/http`'s total
request timeout; JavaScript composes a fresh request abort timer with the operation
signal. Python uses HTTPX's connect, pool, write, and read-inactivity timeouts.
Its async client also uses `asyncio.wait_for` for an operation deadline. In the
sync client, a cancellation event interrupts backoff and is checked before and
after each exchange; an in-flight socket operation returns according to HTTPX's
timeouts. It is not forcibly interrupted by the event. These transport timing
differences are outside the shared retry-state guarantee.

Existing mutation-specific retry policies, JavaScript's explicit ofetch retry
customizations and advanced `.raw` interface, and stream reconnection policies
retain their own contracts. This change establishes read retry parity; it does
not establish equivalence of every SDK feature or mutation protocol.

## Verification

The shared cases check request counts and send times, long quota waits,
HTTP-date forms, malformed headers, capped backoff, permanent conflicts,
disabled/exhausted budgets, deadlines, cancellation, and implicit mutation replay.
Native tests also check cancellation, request timeouts, full-response methods,
and transport errors through each client's own interface.

```sh
cd go && go test -race ./...
cd ../js && bun run test
cd ../python && uv run pytest -q -m 'not e2e'
```

These are implementation conformance tests. The service-mesh repository's
[`protocol/deployment` model](https://github.com/Dstack-TEE/service-mesh/tree/formal-verify-signaling-protocol/protocol/deployment)
separately checks retry limits, server wait times, cancellation, termination, and
conditional recovery in explicit finite scenarios. Its controls reproduce a
deployment read failing without retries and a quota wait incorrectly limited by
the shorter HTTP timeout. Success requires sufficient retry/time budgets and
server quota becoming available. Neither the model nor these tests guarantees
completion under permanent throttling or proves whole-deployment progress.
