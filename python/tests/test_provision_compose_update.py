import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, PhalaCloud
from phala_cloud.action_responses import ProvisionCvmComposeFileUpdateResult


def test_provision_cvm_compose_file_update_result_defaults() -> None:
    result = ProvisionCvmComposeFileUpdateResult.model_validate(
        {
            "app_id": "app-123",
            "device_id": "device-456",
            "compose_hash": "abc123",
        }
    )
    assert result.app_id == "app-123"
    assert result.device_id == "device-456"
    assert result.compose_hash == "abc123"
    assert result.compose_hash_registered is False


def test_provision_cvm_compose_file_update_result_parses_field() -> None:
    result = ProvisionCvmComposeFileUpdateResult.model_validate(
        {
            "app_id": "app-123",
            "compose_hash": "abc123",
            "compose_hash_registered": True,
            "kms_info": {"id": "kms-1"},
        }
    )
    assert result.compose_hash_registered is True
    assert result.kms_info is not None
    assert result.kms_info.id == "kms-1"


def test_provision_cvm_compose_file_update_sync() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/cvms/cvm-123/compose_file/provision"
        return httpx.Response(
            200,
            json={
                "app_id": "app-123",
                "device_id": "device-456",
                "compose_hash": "abc123",
                "compose_hash_registered": True,
                "kms_info": {"id": "kms-1", "slug": "test"},
            },
        )

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport, base_url="https://cloud-api.phala.com/api/v1") as raw:
        client = PhalaCloud(http_client=raw)
        result = client.provision_cvm_compose_file_update(
            {"cvm_id": "cvm-123", "app_compose": {"name": "test"}}
        )
        assert isinstance(result, ProvisionCvmComposeFileUpdateResult)
        assert result.compose_hash_registered is True
        assert result.app_id == "app-123"


@pytest.mark.anyio
async def test_provision_cvm_compose_file_update_async() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/cvms/cvm-123/compose_file/provision"
        return httpx.Response(
            200,
            json={
                "app_id": "app-123",
                "device_id": None,
                "compose_hash": "abc123",
                "compose_hash_registered": False,
            },
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(
        transport=transport, base_url="https://cloud-api.phala.com/api/v1"
    ) as raw:
        client = AsyncPhalaCloud(http_client=raw)
        result = await client.provision_cvm_compose_file_update(
            {"cvm_id": "cvm-123", "app_compose": {"name": "test"}}
        )
        assert isinstance(result, ProvisionCvmComposeFileUpdateResult)
        assert result.compose_hash_registered is False
        assert result.device_id is None
