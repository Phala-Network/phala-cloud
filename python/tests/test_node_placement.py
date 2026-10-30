import json

import httpx
import pytest
from pydantic import ValidationError

from phala_cloud import (
    AsyncPhalaCloud,
    CheckAppIsAllowedRequest,
    CheckCvmIsAllowedRequest,
    CreateAppInstanceRequest,
    PhalaCloud,
    ReplicateCvmRequest,
)

CASES = [
    ("replicate_cvm", ReplicateCvmRequest, {"cvm_id": "cvm-1"}, "/cvms/cvm-1/replicas"),
    (
        "create_app_instance",
        CreateAppInstanceRequest,
        {"appId": "app-1"},
        "/apps/app-1/instances",
    ),
    (
        "check_cvm_is_allowed",
        CheckCvmIsAllowedRequest,
        {"cvmId": "cvm-1", "device_id": "device-1"},
        "/cvms/cvm-1/is-allowed",
    ),
    (
        "check_app_is_allowed",
        CheckAppIsAllowedRequest,
        {"appId": "app-1", "compose_hash": "hash", "device_id": "device-1"},
        "/apps/app-1/is-allowed",
    ),
]


def response(path: str) -> dict:
    if path.endswith("is-allowed"):
        return {
            "app_contract_address": "0x123",
            "compose_hash": "hash",
            "device_id": "device-1",
            "compose_hash_allowed": True,
            "allow_any_device": True,
            "is_allowed": True,
        }
    return {"id": "cvm-1", "name": "test", "status": "running", "resource": {}}


@pytest.mark.parametrize("method,model,payload,path", CASES)
def test_placement_model_roundtrip(method, model, payload, path) -> None:
    request = model.model_validate({**payload, "node": "usw5"})
    assert model.model_validate_json(request.model_dump_json()).node == "usw5"
    with pytest.raises(ValidationError):
        model.model_validate({**payload, "node": ""})
    for key in ("node_id", "teepod_id"):
        for value in (None, 7):
            with pytest.raises(ValidationError, match="Use node instead"):
                model.model_validate({**payload, key: value})


@pytest.mark.parametrize("method,model,payload,path", CASES)
def test_placement_sync(method, model, payload, path) -> None:
    bodies = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1" + path
        bodies.append(json.loads(request.content))
        return httpx.Response(200, json=response(path))

    with httpx.Client(
        transport=httpx.MockTransport(handler), base_url="https://example.com/api/v1"
    ) as raw:
        call = getattr(PhalaCloud(http_client=raw), method)
        call(model.model_validate({**payload, "node": "usw5"}))
        call(payload)
        for key in ("node_id", "teepod_id"):
            with pytest.raises(ValidationError):
                call({**payload, key: None})
        with pytest.raises(ValidationError):
            call({**payload, "node": ""})
    assert len(bodies) == 2
    assert bodies[0]["node"] == "usw5"
    assert "node" not in bodies[1]
    assert all("node_id" not in body and "teepod_id" not in body for body in bodies)
    if "device_id" in payload:
        assert all(body["device_id"] == "device-1" for body in bodies)


@pytest.mark.asyncio
@pytest.mark.parametrize("method,model,payload,path", CASES)
async def test_placement_async(method, model, payload, path) -> None:
    bodies = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1" + path
        bodies.append(json.loads(request.content))
        return httpx.Response(200, json=response(path))

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://example.com/api/v1"
    ) as raw:
        call = getattr(AsyncPhalaCloud(http_client=raw), method)
        await call(model.model_validate({**payload, "node": "usw5"}))
        await call(payload)
        for key in ("node_id", "teepod_id"):
            with pytest.raises(ValidationError):
                await call({**payload, key: None})
        with pytest.raises(ValidationError):
            await call({**payload, "node": ""})
    assert len(bodies) == 2
    assert bodies[0]["node"] == "usw5"
    assert "node" not in bodies[1]
    assert all("node_id" not in body and "teepod_id" not in body for body in bodies)
    if "device_id" in payload:
        assert all(body["device_id"] == "device-1" for body in bodies)
