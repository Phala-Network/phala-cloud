from __future__ import annotations

import json

import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, PhalaCloud

_RESPONSE = {"message": "queued", "correlation_id": "corr-1", "status": "in_progress"}


def _handler(seen: list[tuple[str, str, dict]]) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.method, request.url.path, json.loads(request.content)))
        return httpx.Response(200, json=_RESPONSE)

    return httpx.MockTransport(handler)


def test_update_cvm_resources_uses_the_unified_patch_endpoint_sync() -> None:
    seen: list[tuple[str, str, dict]] = []
    with httpx.Client(
        transport=_handler(seen), base_url="https://cloud-api.phala.com/api/v1"
    ) as raw:
        client = PhalaCloud(http_client=raw)
        result = client.update_cvm_resources({"cvm_id": "cvm-123", "vcpu": 4})

    assert seen[0][0] == "PATCH"
    assert seen[0][1] == "/api/v1/cvms/cvm-123"
    assert seen[0][2] == {"vcpu": 4}
    assert result.correlation_id == "corr-1"


@pytest.mark.asyncio
async def test_update_cvm_resources_uses_the_unified_patch_endpoint_async() -> None:
    seen: list[tuple[str, str, dict]] = []
    async with httpx.AsyncClient(
        transport=_handler(seen), base_url="https://cloud-api.phala.com/api/v1"
    ) as raw:
        client = AsyncPhalaCloud(http_client=raw)
        result = await client.update_cvm_resources({"cvm_id": "cvm-123", "vcpu": 4})

    assert seen[0][0] == "PATCH"
    assert seen[0][1] == "/api/v1/cvms/cvm-123"
    assert seen[0][2] == {"vcpu": 4}
    # The async client used to swallow the body and return None, so callers had
    # no correlation ID to follow the resize with.
    assert result.correlation_id == "corr-1"
