import json

import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, PhalaCloud
from phala_cloud.models.cvms import CvmInfoV20260522


def test_create_app_instance_sync() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/apps/app-123/instances"
        body = json.loads(request.read())
        assert body["name"] == "redis-0"
        assert body["node_id"] == 5
        assert body["docker_compose_file"] == "services:\n  app:\n    image: nginx"
        return httpx.Response(
            200,
            json={
                "id": "cvm-456",
                "name": "instance-1",
                "resource": {"instance_type": "cpu-2"},
                "status": "running",
            },
        )

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport, base_url="https://cloud-api.phala.com/api/v1") as raw:
        client = PhalaCloud(http_client=raw)
        result = client.create_app_instance(
            {
                "appId": "app-123",
                "name": "redis-0",
                "node_id": 5,
                "docker_compose_file": "services:\n  app:\n    image: nginx",
            }
        )
        assert isinstance(result, CvmInfoV20260522)
        assert result.id == "cvm-456"
        assert result.status == "running"


@pytest.mark.anyio
async def test_create_app_instance_async() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/apps/app-123/instances"
        body = json.loads(request.read())
        assert body["name"] == "worker-0"
        return httpx.Response(
            200,
            json={
                "id": "cvm-789",
                "name": "instance-2",
                "resource": {"instance_type": "cpu-2"},
                "status": "provisioning",
            },
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(
        transport=transport, base_url="https://cloud-api.phala.com/api/v1"
    ) as raw:
        client = AsyncPhalaCloud(http_client=raw)
        result = await client.create_app_instance(
            {
                "app_id": "app-123",
                "name": "worker-0",
                "node_id": 3,
                "pre_launch_script": "#!/bin/sh\necho hello",
            }
        )
        assert isinstance(result, CvmInfoV20260522)
        assert result.id == "cvm-789"
        assert result.status == "provisioning"


def test_safe_create_app_instance_sync() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "id": "cvm-000",
                "name": "safe-instance",
                "resource": {},
                "status": "running",
            },
        )

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport, base_url="https://cloud-api.phala.com/api/v1") as raw:
        client = PhalaCloud(http_client=raw)
        result = client.safe_create_app_instance({"appId": "app-123"})
        assert result.ok
        assert result.data.id == "cvm-000"
