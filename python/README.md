# Phala Cloud Python SDK

Python SDK for Phala Cloud API, aligned with `@phala/cloud` action surface.

## Goals

- Pythonic API (`snake_case`, sync-first REPL experience)
- Sync + Async parity
- Pydantic request/response validation
- Safe calls (`safe_*`) without exceptions

## Requirements

- Python >= 3.10
- [uv](https://docs.astral.sh/uv/) (for development)

## Installation

```bash
pip install phala-cloud
```

## Quickstart

### Sync

```python
from phala_cloud import create_client

client = create_client(api_key="<api-key>")
me = client.get_current_user()
print(me.model_dump())
```

### Async

```python
import asyncio
from phala_cloud import create_async_client


async def main() -> None:
    client = create_async_client(api_key="<api-key>")
    me = await client.get_current_user()
    print(me.model_dump())
    await client.aclose()


asyncio.run(main())
```

## Configuration

### Environment variables

- `PHALA_CLOUD_API_KEY`
- `PHALA_CLOUD_API_PREFIX` (e.g. `https://cloud-api.phala.com/api/v1`)

### Client options

- `api_key`
- `base_url`
- `version` (`2025-10-28` / `2026-01-21` / `2026-05-22`)
- `timeout`
- `max_retries` (30 by default; zero disables automatic read retries)
- `operation_timeout` (optional total retry budget in seconds)
- `headers`
- `use_cookie_auth`

## Read retries

GET and HEAD retry transient HTTP 409, 429, and 503 responses. A structured
409 business error is permanent. Positive `Retry-After` seconds or HTTP dates
take precedence over the default one-second exponential backoff, capped at
twenty seconds. Retries stop on exhaustion, cancellation, or an operation deadline.
`request_full` uses the same policy and returns the final HTTP response.

```python
with create_client(timeout=30, operation_timeout=600, max_retries=30) as client:
    info = client.get_cvm_info({"id": cvm_id})
```

`operation_timeout` and `max_retries` may also be passed to `request` or
`request_full`. A synchronous request accepts `cancel_event=threading.Event()`;
an asynchronous request accepts `cancel_event=asyncio.Event()` and supports native
task cancellation. Cancellation interrupts retry waiting. An in-flight sync
request uses HTTPX's socket timeouts and checks cancellation when it returns.
`timeout` retains HTTPX's per-phase semantics; it is separate from retry waiting.

The [shared SDK retry contract](../docs/sdk-read-retries.md) records the common
cases, configuration mapping, and transport timing limits.

## Does the SDK follow redirects?

No. Redirects can send your API key to another server, so the SDK stops at the first response. This applies to API calls and SSE streams. Set `base_url` to the final API URL instead of relying on a redirect.

Direct calls raise `ApiError` for 3xx responses. `request_full` returns the original status, headers, and body with `ok=False`, so you can inspect the response without following it.

The SDK ignores `follow_redirects=True` on SDK requests, including requests made with a supplied `http_client`. It does not change that client's settings or close the supplied client. Custom transports must not follow redirects internally.

## API Style

- Direct methods: raise on HTTP/validation errors
- Safe methods (`safe_*`): return `SafeResult`
- Function-style wrappers available in `phala_cloud.actions`

Example:

```python
result = client.safe_get_kms_list()
if result.ok:
    print(result.data.items)
else:
    print(result.error)
```

## Development

```bash
cd python

# Install dependencies
uv sync

# Run tests
make test

# Lint & format
make check
```

## E2E Test

E2E tests cover sync + async, direct + safe styles, and full interface paths.

Required:

- `PHALA_CLOUD_E2E_API_KEY` — your Phala Cloud API key

Optional:

- `PHALA_CLOUD_E2E_BASE_URL` — defaults to `https://cloud-api.phala.com/api/v1`

### Run

```bash
cd python
PHALA_CLOUD_E2E_API_KEY="<api-key>" make e2e
```

Or put them in `python/.env.test`:

```dotenv
PHALA_CLOUD_E2E_API_KEY=<api-key>
# PHALA_CLOUD_E2E_BASE_URL=https://cloud-api.phala.com/api/v1
```

Then simply:

```bash
cd python
make e2e
```

## License

Apache-2.0
