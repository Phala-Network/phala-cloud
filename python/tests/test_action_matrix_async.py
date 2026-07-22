import httpx

from phala_cloud import AsyncPhalaCloud


def _mock_handler(request: httpx.Request) -> httpx.Response:
    path = request.url.path
    method = request.method

    if method == "GET" and path == "/api/v1/auth/me":
        return httpx.Response(
            200,
            json={
                "user": {
                    "username": "alice",
                    "email": "a@example.com",
                    "role": "user",
                    "avatar": "",
                    "email_verified": True,
                    "totp_enabled": False,
                    "has_backup_codes": False,
                    "flag_has_password": True,
                },
                "workspace": {"id": "w", "name": "n", "slug": "s", "tier": "free", "role": "owner"},
                "credits": {
                    "balance": "1",
                    "granted_balance": "0",
                    "is_post_paid": False,
                    "outstanding_amount": None,
                },
            },
        )

    if method == "GET" and path == "/api/v1/teepods/available":
        return httpx.Response(
            200, json={"tier": "free", "capacity": {}, "nodes": [], "kms_list": []}
        )
    if method == "GET" and path == "/api/v1/teepods/cvm-create-resources":
        return httpx.Response(
            200,
            json={
                "tier": "free",
                "capacity": {},
                "nodes": [],
                "kms_nodes": [
                    {
                        "id": "kms_201",
                        "slug": "kms-base",
                        "url": "https://kms-base.example.com",
                        "version": "0.5.0",
                        "kms_type": "BASE",
                        "chain_id": 8453,
                        "kms_contract_id": "kc_301",
                        "kms_contract_address": "0xbase",
                        "gateway_app_id": "0xgateway",
                        "supported_os_images": ["dstack-0.5.0"],
                    }
                ],
                "node_kms_relations": [
                    {
                        "teepod_id": 11,
                        "kms_id": "kms_201",
                        "kms_type": "BASE",
                        "kms_contract_id": "kc_301",
                        "kms_contract_address": "0xbase",
                        "supported_os_images": ["dstack-0.5.0"],
                    }
                ],
                "gateway_nodes": [
                    {
                        "id": "gn_401",
                        "teepod_id": 11,
                        "kms_contract_id": "kc_301",
                        "rpc_url": "https://gateway.example.com/rpc",
                        "domain_suffix": "example.app",
                        "enabled": True,
                    }
                ],
                "instance_types": [
                    {
                        "id": "tdx.small",
                        "name": "TDX Small",
                        "vcpu": 2,
                        "memory_mb": 4096,
                        "default_disk_size_gb": 40,
                        "requires_gpu": False,
                        "requires_gpu_count": 0,
                        "family": "cpu",
                        "display_order": 1,
                    }
                ],
                "gpu_availability": {
                    "has_reserved_gpus": False,
                    "reserved_gpu_count": 0,
                    "has_public_gpus": True,
                    "public_gpu_count": 1,
                },
            },
        )
    if method == "GET" and path == "/api/v1/kms":
        return httpx.Response(
            200,
            json={
                "items": [
                    {
                        "id": "k1",
                        "slug": "phala",
                        "url": "u",
                        "version": "1",
                        "chain_id": None,
                        "kms_contract_address": None,
                        "gateway_app_id": None,
                    }
                ],
                "total": 1,
                "page": 1,
                "page_size": 10,
                "pages": 1,
            },
        )
    if method == "GET" and path == "/api/v1/cvms/paginated":
        return httpx.Response(
            200,
            json={
                "items": [{"id": "1", "name": "n", "resource": {}, "status": "running"}],
                "total": 1,
                "page": 1,
                "page_size": 10,
                "pages": 1,
            },
        )
    if method == "POST" and path == "/api/v1/cvms/provision":
        return httpx.Response(200, json={"compose_hash": "h"})
    if method == "POST" and path == "/api/v1/cvms":
        return httpx.Response(200, json={"id": "cvm_1", "name": "n", "status": "running"})
    if method == "GET" and path.startswith("/api/v1/cvms/"):
        if path.endswith("/state"):
            return httpx.Response(200, json={"status": "running"})
        return httpx.Response(
            200, json={"id": "1", "name": "n", "status": "running", "resource": {}}
        )
    if method == "POST" and path.endswith("/start"):
        return httpx.Response(200, json={"id": "cvm_1", "name": "n", "status": "running"})
    if method == "DELETE" and path.startswith("/api/v1/cvms/"):
        return httpx.Response(204)
    if method == "PATCH" and path.endswith("/envs"):
        return httpx.Response(
            200, json={"status": "in_progress", "message": "ok", "correlation_id": "c"}
        )

    if method == "GET" and path == "/api/v1/apps":
        return httpx.Response(
            200, json={"items": [], "total": 0, "page": 1, "page_size": 10, "pages": 0}
        )
    if method == "GET" and path == "/api/v1/apps/filter-options":
        return httpx.Response(
            200,
            json={
                "statuses": [],
                "image_versions": [],
                "instance_types": [],
                "kms_slugs": [],
                "kms_types": [],
                "regions": [],
                "nodes": [],
            },
        )

    if method == "GET" and path == "/api/v1/user/ssh-keys":
        return httpx.Response(200, json=[{"id": "k", "name": "n", "public_key": "pk"}])

    if method == "POST" and path == "/api/v1/status/batch":
        return httpx.Response(
            200,
            json={
                "vm1": {
                    "vm_uuid": "vm1",
                    "status": "running",
                    "in_progress": False,
                    "events": [],
                    "resource_usage": {
                        "cpu_percent": 12.5,
                        "memory_used_bytes": 1073741824,
                        "memory_total_bytes": 2147483648,
                        "egress_bytes": 512000,
                    },
                }
            },
        )

    if method == "GET" and path.startswith("/api/v1/kms/on-chain/"):
        return httpx.Response(200, json={"chain_name": "base", "chain_id": 8453, "contracts": []})
    if method == "GET" and path == "/api/v1/os-images":
        return httpx.Response(
            200,
            json={
                "items": [
                    {
                        "name": "prod-0.3.0",
                        "slug": "prod",
                        "version": "0.3.0",
                        "os_image_hash": "abc",
                        "is_dev": False,
                        "requires_gpu": False,
                    }
                ],
                "total": 1,
                "page": 1,
                "page_size": 10,
                "pages": 1,
            },
        )
    if method == "GET" and path.endswith("/device-allowlist"):
        return httpx.Response(
            200, json={"is_onchain_kms": False, "allow_any_device": True, "devices": []}
        )

    return httpx.Response(200, json={})


async def test_async_action_matrix_and_safe() -> None:
    transport = httpx.MockTransport(_mock_handler)
    async with httpx.AsyncClient(
        transport=transport, base_url="https://cloud-api.phala.com/api/v1"
    ) as raw:
        c = AsyncPhalaCloud(http_client=raw)

        await c.get_current_user()
        await c.get_available_nodes()
        await c.get_cvm_create_resources()
        await c.get_cvm_list()
        await c.get_kms_list()
        await c.provision_cvm(
            {"name": "hello1", "compose_file": {"docker_compose_file": "services: {}"}}
        )
        await c.commit_cvm_provision({"app_id": "a", "compose_hash": "h"})
        await c.get_cvm_info({"id": "c1"})
        await c.start_cvm({"id": "c1"})
        await c.delete_cvm({"id": "c1"})
        await c.update_cvm_envs({"id": "c1", "encrypted_env": "x"})
        await c.get_app_list()
        await c.get_app_filter_options()
        await c.list_ssh_keys()
        await c.get_cvm_status_batch({"vmUuids": ["v1"]})
        await c.get_kms_on_chain_detail({"chain": "base"})
        await c.get_os_images()
        await c.get_app_device_allowlist({"appId": "a"})

        assert (await c.safe_get_current_user()).ok
        assert (await c.safe_get_available_nodes()).ok
        assert (await c.safe_get_cvm_create_resources()).ok
        assert (await c.safe_get_cvm_list()).ok
        assert (await c.safe_get_kms_list()).ok


async def test_465_precondition_async() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/envs"):
            return httpx.Response(
                465,
                json={
                    "message": "need hash",
                    "compose_hash": "h",
                    "app_id": "a",
                    "device_id": "d",
                    "kms_info": {},
                },
            )
        return _mock_handler(request)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(
        transport=transport, base_url="https://cloud-api.phala.com/api/v1"
    ) as raw:
        c = AsyncPhalaCloud(http_client=raw)
        out = await c.update_cvm_envs({"id": "c1", "encrypted_env": "x"})
        assert out.status == "precondition_required"


async def test_watch_cvm_state_sse_async() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if (
            request.url.path.endswith("/state")
            and request.headers.get("Accept") == "text/event-stream"
        ):
            body = "\n".join(
                [
                    "event: state",
                    'data: {"status":"starting"}',
                    "",
                    "event: complete",
                    'data: {"status":"running"}',
                    "",
                ]
            )
            return httpx.Response(200, text=body, headers={"Content-Type": "text/event-stream"})
        return _mock_handler(request)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(
        transport=transport, base_url="https://cloud-api.phala.com/api/v1"
    ) as raw:
        c = AsyncPhalaCloud(http_client=raw)
        state = await c.watch_cvm_state(
            {"id": "c1", "target": "running", "timeout": 30, "maxRetries": 0}
        )
        assert getattr(state, "status", None) == "running"
