"""Wire contract of the CVM create fields added with the compose field rules."""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest
from pydantic import ValidationError

from phala_cloud import AsyncPhalaCloud, PhalaCloud

_BASE_URL = "https://cloud-api.phala.com/api/v1"
_PROVISIONED = {"app_id": "app-1", "compose_hash": "abc", "token": "tok-1"}
_RAW_COMPOSE = json.dumps({"name": "raw", "runner": "bash", "bash_script": "echo hi"})


class _Recorder:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload
        self.bodies: list[dict[str, Any]] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.bodies.append(json.loads(request.content))
        return httpx.Response(200, json=self.payload)


@pytest.mark.parametrize("use_async", [False, True])
@pytest.mark.asyncio
async def test_provision_cvm_sends_the_new_create_fields(use_async: bool) -> None:
    recorder = _Recorder(_PROVISIONED)
    request = {
        "name": "my-app",
        "compose_file_raw": _RAW_COMPOSE,
        "init_scripts": ["docker_cleanup", "env_merge"],
        "generate_launch_token": True,
        "annotations": {"memory_tier": "fast"},
    }
    transport = httpx.MockTransport(recorder)
    if use_async:
        async with httpx.AsyncClient(transport=transport, base_url=_BASE_URL) as raw:
            await AsyncPhalaCloud(http_client=raw).provision_cvm(request)
    else:
        with httpx.Client(transport=transport, base_url=_BASE_URL) as raw:
            PhalaCloud(http_client=raw).provision_cvm(request)

    assert recorder.bodies == [request]


def test_provision_cvm_sends_a_caller_launch_token() -> None:
    recorder = _Recorder(_PROVISIONED)
    request = {
        "name": "my-app",
        "compose_file": {"name": "my-app", "docker_compose_file": "services: {}"},
        "launch_token": "t" * 32,
    }
    with httpx.Client(transport=httpx.MockTransport(recorder), base_url=_BASE_URL) as raw:
        PhalaCloud(http_client=raw).provision_cvm(request)

    assert recorder.bodies == [request]


@pytest.mark.parametrize(
    "field",
    [
        {"init_scripts": ["unknown_script"]},
        {"annotations": {"memory_tier": 1}},
        {"generate_launch_token": "yes please"},
    ],
)
def test_provision_cvm_rejects_mistyped_create_fields(field: dict[str, Any]) -> None:
    recorder = _Recorder(_PROVISIONED)
    with httpx.Client(transport=httpx.MockTransport(recorder), base_url=_BASE_URL) as raw:
        with pytest.raises(ValidationError):
            PhalaCloud(http_client=raw).provision_cvm({"name": "my-app", **field})
    assert recorder.bodies == []


@pytest.mark.parametrize("use_async", [False, True])
@pytest.mark.asyncio
async def test_commit_cvm_provision_returns_the_issued_launch_token(use_async: bool) -> None:
    recorder = _Recorder(
        {"id": "cvm_1", "name": "my-app", "status": "starting", "launch_token": "lt"}
    )
    transport = httpx.MockTransport(recorder)
    if use_async:
        async with httpx.AsyncClient(transport=transport, base_url=_BASE_URL) as raw:
            result = await AsyncPhalaCloud(http_client=raw).commit_cvm_provision({"token": "tok-1"})
    else:
        with httpx.Client(transport=transport, base_url=_BASE_URL) as raw:
            result = PhalaCloud(http_client=raw).commit_cvm_provision({"token": "tok-1"})

    assert result.launch_token == "lt"
    assert "launch_token" in type(result).model_fields
