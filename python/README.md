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
- `PHALA_OIDC_TOKEN`
- `PHALA_CLOUD_WORKSPACE`
- `PHALA_CLOUD_API_PREFIX` (e.g. `https://cloud-api.phala.com/api/v1`)

### Client options

- `api_key`
- `bearer_token`
- `workspace`
- `base_url`
- `version` (`2025-10-28` / `2026-01-21` / `2026-05-22`)
- `timeout`
- `headers`
- `use_cookie_auth`

A non-empty client option takes precedence over its corresponding environment variable. After resolving both credentials, the SDK uses the API key if both are set. This includes an API key from `PHALA_CLOUD_API_KEY` when `bearer_token` is set explicitly. Cookie auth suppresses both generated authentication headers; it does not remove headers supplied by the caller. The SDK removes surrounding whitespace from the workspace value.

When cookie auth is off, the SDK raises `RequestError` if the combined SDK and HTTPX headers contain both `X-API-Key` and `Authorization`. When an SDK API key or bearer token is selected, it also rejects HTTPX `auth` and credentials embedded in a request URL. Remove the conflicting credentials from the supplied client or request. When you supply `http_client`, its base URL and timeout control requests; configure them on that client. Watch streams use their own read timeout, as described below. The SDK does not close the supplied client.

## Does the SDK follow redirects?

No. Redirects can send your API key to another server, so the SDK stops at the first response. This applies to API calls and SSE streams. Set `base_url` to the final API URL instead of relying on a redirect.

Direct calls raise `ApiError` for 3xx responses. `request_full` returns the original status, headers, and body with `ok=False`, so you can inspect the response without following it. The SDK also rejects cross-origin absolute request URLs with `RequestError` before sending a request.

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

## How do I commit a prepared CVM update?

Pass the CVM ID and the one-time token to `commit_cvm_update`. `compose_hash` and `transaction_hash` are optional. If you omit the compose hash, the server reads it from the token. If you omit the transaction hash, the server checks whether the compose hash is already allowed on-chain. The server still validates the token and the update.

## How does watching a CVM retry?

`watch_cvm_state` reconnects after a server timeout event, an incomplete stream, or a transient network failure. Set `max_retries` to limit reconnects; the default is unlimited. Set `retry_delay` in seconds (default 5). The aliases `maxRetries` and `retryDelay` also work. The stream read timeout is the requested `timeout` plus `interval` plus 5 seconds.

Only a complete event finishes the watch. The server may send an error event and then continue streaming. If retries are exhausted, the SDK raises `RequestError` with the last available server and network error details. HTTP errors use the same SDK exception types as other requests and are not retried. In async code, cancelling the task closes the stream and propagates cancellation. Previous versions raised `TimeoutError` on retry exhaustion; catch `RequestError` instead.

## Are blockchain actions supported?

The Python SDK no longer exposes `add_compose_hash`, `deploy_app_auth`, or their safe wrappers. These wrappers did not implement the blockchain operations. Use the JavaScript SDK for these operations instead.

## How do I encrypt environment variables?

Pass the output of `parse_env_vars` or `dstack_sdk.EnvVar` objects to `encrypt_env_vars(envs, public_key_hex)`. It returns the encrypted string synchronously. In async code, use `await async_encrypt_env_vars(envs, public_key_hex)` instead.

This changes the previous `encrypt_env_vars` behavior: code that awaited it must switch to `async_encrypt_env_vars`.

## How do I upgrade to these SDK changes?

- Replace `await encrypt_env_vars(...)` with `await async_encrypt_env_vars(...)`. The `encrypt_env_vars` function now returns a string synchronously.
- Use the JavaScript SDK for `add_compose_hash` and `deploy_app_auth`. Their Python wrappers have been removed.
- Catch `RequestError` instead of `TimeoutError` when watch retries are exhausted. Watch HTTP errors now use SDK exceptions instead of `httpx.HTTPStatusError`.
- Do not rely on a raw state event followed by a closed stream as a successful watch result. Only a complete event finishes the watch. Timeouts, incomplete streams, and transient network failures use the reconnect budget.
- Use request URLs on the HTTPX client's origin. The SDK rejects cross-origin URLs before sending.
- Remove conflicting authentication before upgrading. With cookie auth off, the SDK rejects combined API-key and `Authorization` headers. When an SDK API key or bearer token is selected, it also rejects HTTPX client or request `auth`, and credentials in the request or base URL. Cookie mode preserves caller-supplied authentication.

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
