from __future__ import annotations

import json

import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, PhalaCloud

_REPLICA_RESPONSE = {
    "id": "cvm_ykL5lbAn",
    "name": "cvm-1",
    "status": "starting",
    "app_id": "app-1",
}


def _capturing_transport(captured: list[dict]) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/cvms/cvm-123/replicas"
        captured.append(json.loads(request.content))
        return httpx.Response(200, json=_REPLICA_RESPONSE)

    return httpx.MockTransport(handler)


def test_replicate_cvm_forwards_os_image_sync() -> None:
    captured: list[dict] = []
    transport = _capturing_transport(captured)
    with httpx.Client(transport=transport, base_url="https://cloud-api.phala.com/api/v1") as raw:
        client = PhalaCloud(http_client=raw)
        client.replicate_cvm({"cvm_id": "cvm-123", "node_id": 42, "os_image": "dstack-0.5.4"})

    assert captured == [{"node_id": 42, "os_image": "dstack-0.5.4"}]


@pytest.mark.asyncio
async def test_replicate_cvm_forwards_os_image_async() -> None:
    captured: list[dict] = []
    transport = _capturing_transport(captured)
    async with httpx.AsyncClient(
        transport=transport, base_url="https://cloud-api.phala.com/api/v1"
    ) as raw:
        client = AsyncPhalaCloud(http_client=raw)
        await client.replicate_cvm({"cvm_id": "cvm-123", "os_image": "dstack-0.5.4"})

    assert captured == [{"node_id": None, "os_image": "dstack-0.5.4"}]


def test_replicate_cvm_rejects_empty_os_image() -> None:
    from pydantic import ValidationError

    from phala_cloud.full_client import ReplicateCvmRequest

    with pytest.raises(ValidationError):
        ReplicateCvmRequest.model_validate({"cvm_id": "cvm-123", "os_image": ""})
