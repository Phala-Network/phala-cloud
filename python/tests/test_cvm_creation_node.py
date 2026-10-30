import json

import httpx
import pytest
from pydantic import ValidationError

from phala_cloud import AsyncPhalaCloud, PhalaCloud
from phala_cloud.full_client import CvmCreationRequest
from phala_cloud.models.nodes import TeepodCapacity


def test_catalog_physical_node_name() -> None:
    capacity = TeepodCapacity.model_validate(
        {
            "teepod_id": 1,
            "name": "teepod-name",
            "node": "usw5",
            "listed": True,
            "resource_score": 1,
            "remaining_vcpu": 1,
            "remaining_memory": 1,
            "remaining_cvm_slots": 1,
            "images": [],
        }
    )
    assert capacity.node == "usw5"
    assert capacity.name == "teepod-name"


def test_catalog_requires_physical_node_name() -> None:
    data = {
        "teepod_id": 1,
        "name": "teepod-name",
        "listed": True,
        "resource_score": 1,
        "remaining_vcpu": 1,
        "remaining_memory": 1,
        "remaining_cvm_slots": 1,
        "images": [],
    }
    with pytest.raises(ValidationError):
        TeepodCapacity.model_validate({**data, "node": None})
    with pytest.raises(ValidationError):
        TeepodCapacity.model_validate(data)


def test_creation_rejects_empty_node() -> None:
    with pytest.raises(ValidationError):
        CvmCreationRequest.model_validate({"node": ""})


def test_creation_model_without_node() -> None:
    assert CvmCreationRequest(name="test").model_dump(exclude_unset=True) == {"name": "test"}


@pytest.mark.parametrize("key", ["node_id", "teepod_id"])
@pytest.mark.parametrize("value", [None, 0, 12, "legacy"])
def test_creation_model_rejects_legacy_selection(key: str, value: object) -> None:
    with pytest.raises(ValidationError, match="Use node instead"):
        CvmCreationRequest.model_validate({key: value})


def test_creation_sync() -> None:
    bodies = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/cvms"
        body = json.loads(request.content)
        bodies.append(body)
        if len(bodies) == 1:
            return httpx.Response(200, json={"compose_hash": "hash", "token": "token-1"})
        return httpx.Response(200, json={"id": "cvm-1", "name": "test", "status": "creating"})

    with httpx.Client(
        transport=httpx.MockTransport(handler), base_url="https://example.com/api/v1"
    ) as raw:
        client = PhalaCloud(http_client=raw)
        provision = client.provision_cvm(CvmCreationRequest(node="usw5", name="test"))
        client.commit_cvm_provision({"token": provision.token})
        with pytest.raises(ValidationError):
            client.provision_cvm({"node": ""})
        with pytest.raises(ValidationError):
            client.provision_cvm({"node_id": None})
        with pytest.raises(ValidationError):
            client.commit_cvm_provision({"token": "token-1", "teepod_id": None})
    assert bodies == [{"node": "usw5", "name": "test"}, {"token": "token-1"}]


@pytest.mark.anyio
async def test_creation_async() -> None:
    bodies = []

    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/cvms"
        body = json.loads(request.content)
        bodies.append(body)
        if len(bodies) == 1:
            return httpx.Response(200, json={"compose_hash": "hash", "token": "token-2"})
        return httpx.Response(200, json={"id": "cvm-2", "name": "test", "status": "creating"})

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://example.com/api/v1"
    ) as raw:
        client = AsyncPhalaCloud(http_client=raw)
        provision = await client.provision_cvm({"node": "prod9", "name": "test"})
        await client.commit_cvm_provision({"token": provision.token})
        with pytest.raises(ValidationError):
            await client.provision_cvm({"node": ""})
        with pytest.raises(ValidationError):
            await client.provision_cvm({"teepod_id": 0})
        with pytest.raises(ValidationError):
            await client.commit_cvm_provision({"token": "token-2", "node_id": None})
    assert bodies == [{"node": "prod9", "name": "test"}, {"token": "token-2"}]
