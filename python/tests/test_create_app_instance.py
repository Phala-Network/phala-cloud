import json

import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, PhalaCloud
from phala_cloud.models.cvms import ReplicaVM

_REPLICA = {
    "id": "cvm-456",
    "name": "instance-1",
    "status": "starting",
    "teepod_id": 11,
    "app_id": "app-123",
    "vcpu": 2,
    "memory": 4096,
    "disk_size": 40,
    "created_at": "2026-01-01T00:00:00Z",
    "finality_wait": {
        "operation": "create",
        "correlation_id": "corr-1",
        "phase": "awaiting_finality",
        "stage": "submitted",
        "transaction": None,
        "finality": {
            "block_tag": "safe",
            "policy_block_number": 1,
            "blocks_remaining": 2,
            "eta_seconds": 30,
        },
    },
}


def test_create_app_instance_sync() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/apps/app-123/instances"
        body = json.loads(request.read())
        assert body["name"] == "redis-0"
        assert body["node"] == "usw5"
        assert body["docker_compose_file"] == "services:\n  app:\n    image: nginx"
        return httpx.Response(200, json=_REPLICA)

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport, base_url="https://cloud-api.phala.com/api/v1") as raw:
        client = PhalaCloud(http_client=raw)
        result = client.create_app_instance(
            {
                "appId": "app-123",
                "name": "redis-0",
                "node": "usw5",
                "docker_compose_file": "services:\n  app:\n    image: nginx",
            }
        )
        assert isinstance(result, ReplicaVM)
        assert result.id == "cvm-456"
        assert result.status == "starting"
        assert result.teepod_id == 11
        assert result.vcpu == 2
        assert result.finality_wait is not None
        assert result.finality_wait.correlation_id == "corr-1"


@pytest.mark.anyio
async def test_create_app_instance_async() -> None:
    payload = {**_REPLICA, "id": "cvm-789", "name": "instance-2", "status": "starting"}

    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/apps/app-123/instances"
        body = json.loads(request.read())
        assert body["name"] == "worker-0"
        assert body["node"] == "usw5"
        return httpx.Response(200, json=payload)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(
        transport=transport, base_url="https://cloud-api.phala.com/api/v1"
    ) as raw:
        client = AsyncPhalaCloud(http_client=raw)
        result = await client.create_app_instance(
            {
                "app_id": "app-123",
                "name": "worker-0",
                "node": "usw5",
                "pre_launch_script": "#!/bin/sh\necho hello",
            }
        )
        assert isinstance(result, ReplicaVM)
        assert result.id == "cvm-789"
        assert result.disk_size == 40


def test_safe_create_app_instance_sync() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={**_REPLICA, "id": "cvm-000", "name": "safe-instance"})

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport, base_url="https://cloud-api.phala.com/api/v1") as raw:
        client = PhalaCloud(http_client=raw)
        result = client.safe_create_app_instance({"appId": "app-123"})
        assert result.ok
        assert result.data.id == "cvm-000"
