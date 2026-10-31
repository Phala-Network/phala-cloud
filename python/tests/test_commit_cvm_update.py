import json

import httpx
import pytest

import phala_cloud


@pytest.mark.parametrize("async_client", [False, True])
@pytest.mark.asyncio
async def test_commit_update_wire_contract(async_client: bool) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/cvms/cvm_123/commit-update"
        assert json.loads(request.content) == {
            "token": "one-time",
            "compose_hash": "0xabc",
            "transaction_hash": "0xdef",
        }
        return httpx.Response(202, json={"correlation_id": "task-1", "status": "in_progress"})

    payload = {
        "cvm_id": "cvm_123",
        "token": "one-time",
        "compose_hash": "0xabc",
        "transaction_hash": "0xdef",
    }
    transport = httpx.MockTransport(handler)
    if async_client:
        async with httpx.AsyncClient(transport=transport, base_url="https://example.com") as raw:
            client = phala_cloud.AsyncPhalaCloud(http_client=raw)
            result = await phala_cloud.commit_cvm_update(client, payload)
            safe = await phala_cloud.safe_commit_cvm_update(client, payload)
    else:
        with httpx.Client(transport=transport, base_url="https://example.com") as raw:
            client_sync = phala_cloud.PhalaCloud(http_client=raw)
            result = phala_cloud.commit_cvm_update(client_sync, payload)
            safe = phala_cloud.safe_commit_cvm_update(client_sync, payload)
    assert result.correlation_id == "task-1"
    assert result.status == "in_progress"
    assert safe.unwrap().correlation_id == "task-1"
