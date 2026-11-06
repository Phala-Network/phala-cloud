"""Wire contract of the CVM update actions against PATCH /cvms/{cvm_id}."""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest
from pydantic import ValidationError

from phala_cloud import AsyncPhalaCloud, PhalaCloud

_BASE_URL = "https://cloud-api.phala.com/api/v1"
_ACCEPTED = {"message": "CVM update initiated", "correlation_id": "corr-1", "status": "in_progress"}
_HASH_REQUIRED = {
    "error_code": "ERR-01-005",
    "message": "Compose hash registration required",
    "details": [
        {"field": "compose_hash", "value": "abc123"},
        {"field": "app_id", "value": "app-1"},
        {"field": "device_id", "value": "dev-1"},
        {"field": "kms_info", "value": {"chain_id": 8453}},
        {"field": "commit_token", "value": "token-1"},
        {"field": "commit_url", "value": "https://cloud.phala.com/commit/token-1"},
        {"field": "api_commit_url", "value": "https://cloud-api.phala.com/api/v1/commit/token-1"},
        {
            "field": "onchain_status",
            "value": {
                "compose_hash_allowed": False,
                "device_id_allowed": True,
                "is_allowed": False,
            },
        },
    ],
}

_GPUS = {
    "gpus": [{"slot": "0000:18:00.0", "product_id": "10de:2335"}, {"slot": "0000:2a:00.0"}],
    "attach_mode": "listed",
}


class _Recorder:
    def __init__(self, status: int = 202, payload: dict[str, Any] | None = None) -> None:
        self.status = status
        self.payload = payload if payload is not None else _ACCEPTED
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return httpx.Response(self.status, json=self.payload)

    @property
    def last(self) -> tuple[str, str, dict[str, Any], httpx.Headers]:
        req = self.requests[-1]
        return req.method, req.url.path, json.loads(req.content), req.headers


def _sync_client(recorder: _Recorder) -> PhalaCloud:
    raw = httpx.Client(transport=httpx.MockTransport(recorder), base_url=_BASE_URL)
    return PhalaCloud(http_client=raw)


def _async_client(recorder: _Recorder) -> AsyncPhalaCloud:
    raw = httpx.AsyncClient(transport=httpx.MockTransport(recorder), base_url=_BASE_URL)
    return AsyncPhalaCloud(http_client=raw)


def test_patch_cvm_sends_instance_type_and_gpu_config_sync() -> None:
    recorder = _Recorder()
    result = _sync_client(recorder).patch_cvm(
        {"id": "cvm-1", "instance_type": "h200.small", "gpus": _GPUS}
    )

    method, path, body, headers = recorder.last
    assert (method, path) == ("PATCH", "/api/v1/cvms/cvm-1")
    assert body == {"instance_type": "h200.small", "gpus": _GPUS}
    assert "x-prepare-only" not in headers
    assert result == {"requires_on_chain_hash": False, "correlation_id": "corr-1"}


@pytest.mark.asyncio
async def test_patch_cvm_sends_instance_type_and_gpu_config_async() -> None:
    recorder = _Recorder()
    await _async_client(recorder).patch_cvm(
        {"id": "cvm-1", "instance_type": "h200.small", "gpus": _GPUS}
    )

    method, path, body, _ = recorder.last
    assert (method, path) == ("PATCH", "/api/v1/cvms/cvm-1")
    assert body == {"instance_type": "h200.small", "gpus": _GPUS}


def test_patch_cvm_rejects_a_gpu_config_the_api_does_not_accept() -> None:
    recorder = _Recorder()
    with pytest.raises(ValidationError):
        _sync_client(recorder).patch_cvm({"id": "cvm-1", "gpus": {"count": 1}})
    assert recorder.requests == []


def test_patch_cvm_prepare_only_sends_header_and_returns_commit_token_sync() -> None:
    recorder = _Recorder(status=465, payload=_HASH_REQUIRED)
    result = _sync_client(recorder).patch_cvm(
        {"id": "cvm-1", "public_logs": True, "prepare_only": True}
    )

    _, _, body, headers = recorder.last
    assert headers["x-prepare-only"] == "true"
    assert body == {"public_logs": True}
    assert result["requires_on_chain_hash"] is True
    assert result["compose_hash"] == "abc123"
    assert result["commit_token"] == "token-1"
    assert result["commit_url"] == "https://cloud.phala.com/commit/token-1"
    assert result["api_commit_url"] == "https://cloud-api.phala.com/api/v1/commit/token-1"
    assert result["onchain_status"] == {
        "compose_hash_allowed": False,
        "device_id_allowed": True,
        "is_allowed": False,
    }


@pytest.mark.asyncio
async def test_patch_cvm_prepare_only_sends_header_and_returns_commit_token_async() -> None:
    recorder = _Recorder(status=465, payload=_HASH_REQUIRED)
    result = await _async_client(recorder).patch_cvm(
        {"id": "cvm-1", "public_logs": True, "prepareOnly": True}
    )

    _, _, body, headers = recorder.last
    assert headers["x-prepare-only"] == "true"
    assert body == {"public_logs": True}
    assert result["commit_token"] == "token-1"


def test_update_cvm_resources_does_not_send_allow_restart_sync() -> None:
    recorder = _Recorder()
    _sync_client(recorder).update_cvm_resources(
        {"id": "cvm-1", "vcpu": 4, "instance_type": "tdx.medium", "allow_restart": True}
    )

    method, path, body, _ = recorder.last
    assert (method, path) == ("PATCH", "/api/v1/cvms/cvm-1")
    assert body == {"vcpu": 4, "instance_type": "tdx.medium"}


@pytest.mark.asyncio
async def test_update_cvm_resources_does_not_send_allow_restart_async() -> None:
    recorder = _Recorder()
    await _async_client(recorder).update_cvm_resources(
        {"id": "cvm-1", "vcpu": 4, "allow_restart": True}
    )

    _, _, body, _ = recorder.last
    assert body == {"vcpu": 4}


def test_update_cvm_visibility_uses_the_unified_patch_endpoint_sync() -> None:
    recorder = _Recorder()
    result = _sync_client(recorder).update_cvm_visibility(
        {"id": "cvm-1", "public_sysinfo": True, "public_logs": False}
    )

    method, path, body, _ = recorder.last
    assert (method, path) == ("PATCH", "/api/v1/cvms/cvm-1")
    assert body == {"public_sysinfo": True, "public_logs": False}
    assert result.correlation_id == "corr-1"


@pytest.mark.asyncio
async def test_update_cvm_visibility_uses_the_unified_patch_endpoint_async() -> None:
    recorder = _Recorder()
    result = await _async_client(recorder).update_cvm_visibility(
        {"id": "cvm-1", "public_sysinfo": True, "public_logs": False, "public_tcbinfo": True}
    )

    method, path, body, _ = recorder.last
    assert (method, path) == ("PATCH", "/api/v1/cvms/cvm-1")
    assert body == {"public_sysinfo": True, "public_logs": False, "public_tcbinfo": True}
    assert result.correlation_id == "corr-1"


def test_patch_cvm_hash_required_returns_empty_app_id_when_payload_has_none() -> None:
    payload = {
        **_HASH_REQUIRED,
        "details": [
            {"field": "compose_hash", "value": "abc123"},
            {"field": "app_id", "value": None},
        ],
    }
    result = _sync_client(_Recorder(status=465, payload=payload)).patch_cvm(
        {"id": "cvm-1", "public_logs": True, "prepare_only": True}
    )

    assert result["requires_on_chain_hash"] is True
    assert result["compose_hash"] == "abc123"
    assert result["app_id"] == ""


_COMPOSE_PATCH = {
    "secure_time": True,
    "swap_size": None,
    "gateway_enabled": False,
    "port_policy": {"ports": [{"port": 443, "pp": True}], "restrict_mode": True},
    "event_log_version": 2,
    "requirements": {
        "ephemeral_data_disk": True,
        "health_check": False,
        "platforms": None,
    },
}


@pytest.mark.parametrize("use_async", [False, True])
@pytest.mark.asyncio
async def test_patch_cvm_sends_compose_merge_patch_with_nulls(use_async: bool) -> None:
    recorder = _Recorder()
    request = {
        "id": "cvm-1",
        "compose": _COMPOSE_PATCH,
        "init_scripts": ["docker_cleanup"],
        "confirm_data_wipe": True,
    }
    if use_async:
        await _async_client(recorder).patch_cvm(request)
    else:
        _sync_client(recorder).patch_cvm(request)

    method, path, body, _ = recorder.last
    assert (method, path) == ("PATCH", "/api/v1/cvms/cvm-1")
    # Sent nulls remove keys; unsent keys stay absent; explicit defaults are kept.
    assert body == {
        "compose": _COMPOSE_PATCH,
        "init_scripts": ["docker_cleanup"],
        "confirm_data_wipe": True,
    }


def test_patch_cvm_sends_an_empty_init_script_set() -> None:
    recorder = _Recorder()
    _sync_client(recorder).patch_cvm({"id": "cvm-1", "init_scripts": []})

    _, _, body, _ = recorder.last
    assert body == {"init_scripts": []}


def test_patch_cvm_sends_the_bash_script() -> None:
    recorder = _Recorder()
    _sync_client(recorder).patch_cvm({"id": "cvm-1", "compose": {"bash_script": "echo hi"}})

    _, _, body, _ = recorder.last
    assert body == {"compose": {"bash_script": "echo hi"}}


def test_patch_cvm_rejects_gpu_policy_in_the_compose_patch() -> None:
    recorder = _Recorder()
    with pytest.raises(ValidationError):
        _sync_client(recorder).patch_cvm(
            {"id": "cvm-1", "compose": {"requirements": {"gpu_policy": {}}}}
        )
    assert recorder.requests == []


@pytest.mark.parametrize("use_async", [False, True])
@pytest.mark.asyncio
async def test_patch_cvm_does_not_coerce_a_bool_event_log_version(use_async: bool) -> None:
    # True == 1 in Python; the API rejects a boolean, so it must not go out as 1.
    recorder = _Recorder()
    request = {"id": "cvm-1", "compose": {"event_log_version": True}}
    with pytest.raises(ValidationError):
        if use_async:
            await _async_client(recorder).patch_cvm(request)
        else:
            _sync_client(recorder).patch_cvm(request)
    assert recorder.requests == []
