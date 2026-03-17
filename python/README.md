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
- `version` (`2025-10-28` / `2026-01-21`)
- `timeout`
- `headers`
- `use_cookie_auth`

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

E2E only needs two variables:

- `PHALA_CLOUD_E2E_BASE_URL`
- `PHALA_CLOUD_E2E_API_KEY`

It covers sync + async, direct + safe styles, and full interface paths.

### Run

```bash
cd python
PHALA_CLOUD_E2E_BASE_URL="https://<your-test-api>/api/v1" \
PHALA_CLOUD_E2E_API_KEY="<api-key>" \
make e2e
```

Or put them in `python/.env.test`:

```dotenv
PHALA_CLOUD_E2E_BASE_URL=https://<your-test-api>/api/v1
PHALA_CLOUD_E2E_API_KEY=<api-key>
```

Then simply:

```bash
cd python
make e2e
```

## License

Apache-2.0
