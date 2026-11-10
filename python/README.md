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

The SDK sets `User-Agent` to `phala-cloud-sdk-python/<version> python/<x.y.z> httpx/<ver>`. A `User-Agent` in `headers` replaces that default.

A non-empty client option takes precedence over its corresponding environment variable. After resolving both credentials, the SDK uses the API key if both are set. This includes an API key from `PHALA_CLOUD_API_KEY` when `bearer_token` is set explicitly. Cookie auth suppresses both generated authentication headers; it does not remove headers supplied by the caller. The SDK removes surrounding whitespace from the workspace value.

When you supply `http_client`, its base URL and timeout control requests; configure them on that client. Watch streams use their own read timeout, as described below. The SDK does not close the supplied client.

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

## How do I commit a prepared CVM update?

Pass the CVM ID and the one-time token to `commit_cvm_update`. `compose_hash` and `transaction_hash` are optional. If you omit the compose hash, the server reads it from the token. If you omit the transaction hash, the server checks whether the compose hash is already allowed on-chain. The server still validates the token and the update.

## How do I change a CVM's app compose settings?

Send `compose` to `patch_cvm` as a JSON Merge Patch: a set field sets the value, a field set to `None` removes the key, and a field you leave out is unchanged. `requirements` merges per key and cannot change `gpu_policy`. `init_scripts` replaces the CVM's platform init scripts with the given slugs (`docker_cleanup`, `env_merge`); `get_cvm_init_scripts` shows which ones the CVM runs and which it can select. Turning on `docker_cleanup` or `requirements.ephemeral_data_disk` erases data on every boot, so it also needs `confirm_data_wipe=True`.

```python
client.patch_cvm({
    "id": "my-cvm",
    "compose": {"secure_time": True, "swap_size": None, "requirements": {"health_check": True}},
})
```

## How do I gate a CVM with a launch token?

On create, send `launch_token` (at least 32 bytes) or `generate_launch_token=True`; the commit response carries a newly issued token once. To rotate, call `set_app_launch_token` (omit `launch_token` to have Phala Cloud generate one), then set each CVM's `compose.requirements.launch_token_hash` to the returned hash before it restarts. `clear_app_launch_token` removes the token after every CVM has dropped the hash. `get_cvm_user_config` returns the token to members who can read the CVM. Phala Cloud and the node operator can read the token, so it protects only against parties who know the public compose.

## How do I compute a compose hash locally?

`get_compose_hash(compose, os_image_version="0.6.0")` hashes the compose the way Phala Cloud does for that OS image: below 0.6.0 `manifest_version` is 2 and `init_script` is a single string, from 0.6.0 they are `"3"` and a list. Without `os_image_version` both fields are hashed as given.

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
- `patch_cvm` validates `gpus` as `{"gpus": [{"slot": ..., "product_id": ...}], "attach_mode": ...}`, the shape the API accepts. Other shapes now fail validation instead of being sent and ignored. `patch_cvm` also accepts `instance_type`, and `prepare_only=True` sends `X-Prepare-Only: true`; the 465 result then includes `commit_token`, `commit_url`, `api_commit_url` and `onchain_status`.
- `update_cvm_visibility` now calls `PATCH /cvms/{id}` instead of the deprecated `PATCH /cvms/{id}/visibility`. It returns `message`, `correlation_id` and `status` instead of the CVM record; call `get_cvm_info` if you need the record.
- `update_cvm_resources` no longer sends `allow_restart`, which the API ignores. The field is deprecated.
- `get_compose_hash` now drops null `storage_discard`, `event_log_version`, `snapshotter` and `verity_volumes` and always emits `tproxy_enabled` (defaulting to `gateway_enabled`), as the API does. A compose without `tproxy_enabled` hashes differently than before.

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
