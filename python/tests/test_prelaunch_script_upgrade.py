from __future__ import annotations

import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, PhalaCloud
from phala_cloud.action_responses import InProgressResponse, PreLaunchScriptUpgradeStatus

_STATUS_PAYLOAD = {
    "current_hash": "aaa",
    "latest_official_hash": "bbb",
    "is_official": True,
    "is_latest": False,
    "can_upgrade": True,
}

_UPGRADE_PATH = "/api/v1/cvms/cvm-123/pre-launch-script/upgrade-to-latest-official"


def test_get_upgrade_status_sync() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/cvms/cvm-123/pre-launch-script/upgrade-status"
        return httpx.Response(200, json=_STATUS_PAYLOAD)

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport, base_url="https://cloud-api.phala.com/api/v1") as raw:
        client = PhalaCloud(http_client=raw)
        status = client.get_pre_launch_script_upgrade_status({"cvm_id": "cvm-123"})

    assert isinstance(status, PreLaunchScriptUpgradeStatus)
    assert status.can_upgrade is True
    assert status.is_latest is False
    assert status.latest_official_hash == "bbb"


@pytest.mark.asyncio
async def test_get_upgrade_status_async() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/cvms/cvm-123/pre-launch-script/upgrade-status"
        return httpx.Response(200, json=_STATUS_PAYLOAD)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(
        transport=transport, base_url="https://cloud-api.phala.com/api/v1"
    ) as raw:
        client = AsyncPhalaCloud(http_client=raw)
        status = await client.get_pre_launch_script_upgrade_status({"cvm_id": "cvm-123"})

    assert isinstance(status, PreLaunchScriptUpgradeStatus)
    assert status.can_upgrade is True


def test_upgrade_phase_one_sends_no_verification_headers() -> None:
    seen: list[httpx.Headers] = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == _UPGRADE_PATH
        seen.append(request.headers)
        return httpx.Response(
            202, json={"status": "in_progress", "message": "queued", "correlation_id": "corr-1"}
        )

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport, base_url="https://cloud-api.phala.com/api/v1") as raw:
        client = PhalaCloud(http_client=raw)
        result = client.upgrade_pre_launch_script({"cvm_id": "cvm-123"})

    assert isinstance(result, InProgressResponse)
    assert result.correlation_id == "corr-1"
    assert "X-Compose-Hash" not in seen[0]
    assert "X-Transaction-Hash" not in seen[0]


def test_upgrade_phase_two_forwards_verification_headers() -> None:
    seen: list[httpx.Headers] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.headers)
        return httpx.Response(
            202, json={"status": "in_progress", "message": "queued", "correlation_id": "corr-2"}
        )

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport, base_url="https://cloud-api.phala.com/api/v1") as raw:
        client = PhalaCloud(http_client=raw)
        client.upgrade_pre_launch_script(
            {"cvm_id": "cvm-123", "compose_hash": "hash-1", "transaction_hash": "0xtx"}
        )

    assert seen[0]["X-Compose-Hash"] == "hash-1"
    assert seen[0]["X-Transaction-Hash"] == "0xtx"


def test_upgrade_maps_465_to_precondition_required() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            465,
            json={
                "message": "Compose hash verification required",
                "details": [
                    {"field": "compose_hash", "value": "hash-1"},
                    {"field": "app_id", "value": "app-1"},
                    {"field": "device_id", "value": "device-1"},
                    {"field": "kms_info", "value": {"id": "kms-1"}},
                ],
            },
        )

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport, base_url="https://cloud-api.phala.com/api/v1") as raw:
        client = PhalaCloud(http_client=raw)
        result = client.upgrade_pre_launch_script({"cvm_id": "cvm-123"})

    # Mirrors update_cvm_envs / update_docker_compose: the synthesised 465 body
    # comes back as a loose model, discriminated by status.
    assert result.status == "precondition_required"
    assert result.compose_hash == "hash-1"
    assert result.app_id == "app-1"
    assert result.device_id == "device-1"


@pytest.mark.asyncio
async def test_upgrade_maps_465_to_precondition_required_async() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            465,
            json={
                "message": "Compose hash verification required",
                "details": [
                    {"field": "compose_hash", "value": "hash-1"},
                    {"field": "app_id", "value": "app-1"},
                ],
            },
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(
        transport=transport, base_url="https://cloud-api.phala.com/api/v1"
    ) as raw:
        client = AsyncPhalaCloud(http_client=raw)
        result = await client.upgrade_pre_launch_script({"cvm_id": "cvm-123"})

    assert result.status == "precondition_required"
    assert result.compose_hash == "hash-1"
