import httpx
import pytest

from phala_cloud import (
    ApiError,
    AsyncPhalaCloud,
    CvmIdRequest,
    CvmInfoDetailV20261111,
    GetCvmInfoRequest,
    PhalaCloud,
    get_cvm_gpu_status,
    safe_get_cvm_gpu_status,
)


def handler(request: httpx.Request) -> httpx.Response:
    if request.url.path.endswith("/gpu-status"):
        if "/cpu/" in request.url.path:
            return httpx.Response(404, json={"detail": "not found"})
        if "/unavailable/" in request.url.path:
            return httpx.Response(200, json={"observed": None})
        return httpx.Response(
            200, json={"observed": [{"slot": "0000:01:00.0", "cc_mode": "unknown"}]}
        )
    result = {
        "id": "cvm_1",
        "name": "example",
        "status": "running",
        "app_id": "app_1",
        "vm_uuid": "vm-uuid",
        "instance_id": "instance-1",
        "resource": {
            "instance_type": "tdx.medium",
            "vcpu": 4,
            "memory_in_gb": 12.055,
            "memory_in_mb": 12345,
            "disk_in_gb": 40,
            "gpus": 2,
        },
        "node_info": {"object_type": "node", "id": 7, "name": "node-1", "region": "us"},
        "os": {"name": "dstack", "version": "0.5.0", "is_dev": False},
        "kms_info": {"chain_id": 1, "dstack_kms_address": "0x123"},
        "progress": {"target": "running", "correlation_id": "request-1"},
        "gateway": {"base_domain": "example.com", "cname": "cvm.example.com"},
        "logs": {"serial": "https://example.com/serial", "stdout": None, "stderr": None},
        "workspace": {"object_type": "workspace", "id": "wks_1", "name": "workspace"},
        "creator": {"object_type": "user", "id": "usr_1", "username": "owner"},
        "services": [],
        "endpoints": [],
        "enabled_ssh_access": False,
        "created_at": "2026-11-11T00:00:00Z",
        "dapp_dashboard_url": None,
        "syslog_endpoint": None,
    }
    if "/gpu" in request.url.path:
        result["gpu"] = {"product_id": None, "gpus": 2, "cc_mode": {"expected": "devtools"}}
    if request.url.params.get("include_compose") == "true":
        result["compose_file"] = {"name": "test"}
    return httpx.Response(200, json=result)


def test_sync_detail_and_gpu_status() -> None:
    requests: list[httpx.Request] = []

    def record(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return handler(request)

    with httpx.Client(transport=httpx.MockTransport(record), base_url="https://example.com") as raw:
        client = PhalaCloud(http_client=raw)
        cpu = client.get_cvm_info(CvmIdRequest(id="cpu"))
        assert isinstance(cpu, CvmInfoDetailV20261111)
        assert cpu.resource.memory_in_mb == 12345
        assert cpu.node_info is not None and cpu.node_info.name == "node-1"
        assert cpu.os is not None and cpu.os.version == "0.5.0"
        assert cpu.kms_info is not None and cpu.kms_info.chain_id == 1
        assert cpu.gateway is not None and cpu.gateway.cname == "cvm.example.com"
        assert cpu.workspace is not None and cpu.workspace.id == "wks_1"
        assert cpu.logs.serial == "https://example.com/serial"
        assert "gpu" not in cpu.model_fields_set
        assert "compose_file" not in cpu.model_fields_set
        assert isinstance(client.safe_get_cvm_info({"id": "cpu"}).unwrap(), CvmInfoDetailV20261111)
        gpu = client.get_cvm_info(GetCvmInfoRequest(id="gpu", include_compose=True))
        assert gpu.gpu.product_id is None
        assert gpu.gpu.cc_mode.expected == "devtools"
        assert gpu.compose_file == {"name": "test"}
        client.get_cvm_info({"id": "cpu", "include_compose": False})
        assert requests[-1].url.params["include_compose"] == "false"
        assert all(r.headers["x-phala-version"] == "2026-11-11" for r in requests)
        assert get_cvm_gpu_status(client, {"id": "gpu"}).observed[0].cc_mode == "unknown"
        assert client.get_cvm_gpu_status({"id": "unavailable"}).observed is None
        with pytest.raises(ApiError) as exc:
            client.get_cvm_gpu_status({"id": "cpu"})
        assert exc.value.status_code == 404
        error = safe_get_cvm_gpu_status(client, {"id": "cpu"}).error
        assert isinstance(error, ApiError) and error.status_code == 404
        old_client = PhalaCloud(http_client=raw, version="2026-06-23")
        legacy = old_client.get_cvm_info({"id": "cpu"})
        assert not isinstance(legacy, CvmInfoDetailV20261111)
        assert isinstance(legacy.node_info, dict)
        assert requests[-1].headers["x-phala-version"] == "2026-06-23"


@pytest.mark.asyncio
async def test_async_detail_and_gpu_status() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://example.com"
    ) as raw:
        client = AsyncPhalaCloud(http_client=raw)
        detail = await client.get_cvm_info({"id": "gpu", "include_compose": True})
        assert isinstance(detail, CvmInfoDetailV20261111)
        assert detail.compose_file == {"name": "test"}
        assert detail.node_info is not None and detail.node_info.name == "node-1"
        safe_detail = await client.safe_get_cvm_info({"id": "cpu"})
        assert isinstance(safe_detail.unwrap(), CvmInfoDetailV20261111)
        status = await get_cvm_gpu_status(client, {"id": "gpu"})
        assert status.observed[0].cc_mode == "unknown"
        result = await safe_get_cvm_gpu_status(client, {"id": "cpu"})
        assert isinstance(result.error, ApiError) and result.error.status_code == 404
        with pytest.raises(ApiError) as exc:
            await client.get_cvm_gpu_status({"id": "cpu"})
        assert exc.value.status_code == 404
