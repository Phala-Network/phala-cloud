from typing import Any

import httpx

from phala_cloud import PhalaCloud


def _json_response(data: Any, status: int = 200) -> httpx.Response:
    return httpx.Response(status, json=data)


def _mock_handler(request: httpx.Request) -> httpx.Response:
    path = request.url.path
    method = request.method

    # versioned/auth
    if method == "GET" and path == "/api/v1/auth/me":
        if request.headers.get("X-Phala-Version") == "2025-10-28":
            return _json_response(
                {
                    "username": "alice",
                    "email": "a@example.com",
                    "credits": 1,
                    "granted_credits": 0,
                    "avatar": "",
                    "team_name": "t",
                    "team_tier": "free",
                }
            )
        return _json_response(
            {
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
            }
        )

    # simple lists
    if method == "GET" and path == "/api/v1/teepods/available":
        return _json_response({"tier": "free", "capacity": {}, "nodes": [], "kms_list": []})
    if method == "GET" and path == "/api/v1/teepods/cvm-create-resources":
        return _json_response(
            {
                "tier": "free",
                "capacity": {},
                "nodes": [],
                "kms_nodes": [
                    {
                        "id": 201,
                        "slug": "kms-base",
                        "url": "https://kms-base.example.com",
                        "version": "0.5.0",
                        "kms_type": "BASE",
                        "chain_id": 8453,
                        "kms_contract_id": 301,
                        "kms_contract_address": "0xbase",
                        "gateway_app_id": "0xgateway",
                        "supported_os_images": ["dstack-0.5.0"],
                    }
                ],
                "node_kms_relations": [
                    {
                        "teepod_id": 11,
                        "kms_id": 201,
                        "kms_type": "BASE",
                        "kms_contract_id": 301,
                        "kms_contract_address": "0xbase",
                        "supported_os_images": ["dstack-0.5.0"],
                    }
                ],
                "gateway_nodes": [
                    {
                        "id": 401,
                        "teepod_id": 11,
                        "kms_contract_id": 301,
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
            }
        )
    if method == "GET" and path == "/api/v1/instance-types":
        return _json_response({"result": []})
    if method == "GET" and path.startswith("/api/v1/instance-types/"):
        return _json_response({"items": [], "total": 0, "family": "cpu"})
    if method == "GET" and path == "/api/v1/workspaces":
        return _json_response(
            {
                "data": [{"id": "w", "name": "n", "slug": "s", "tier": "free", "role": "owner"}],
                "pagination": {},
            }
        )
    if method == "GET" and path.endswith("/nodes"):
        return _json_response({"items": [], "total": 0, "page": 1, "page_size": 20, "pages": 0})
    if method == "GET" and path.endswith("/quotas"):
        return _json_response(
            {
                "team_slug": "s",
                "tier": "free",
                "quotas": {},
                "reserved_nodes": {},
                "reserved_gpu": {},
                "as_of": "now",
            }
        )
    if method == "GET" and path.startswith("/api/v1/workspaces/"):
        return _json_response(
            {"id": "w", "name": "n", "slug": "s", "tier": "free", "role": "owner"}
        )

    # kms
    if method == "GET" and path == "/api/v1/kms":
        return _json_response(
            {
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
            }
        )
    if method == "GET" and path.startswith("/api/v1/kms/on-chain/"):
        return _json_response({"chain_name": "base", "chain_id": 8453, "contracts": []})
    if method == "GET" and path.startswith("/api/v1/kms/") and "/pubkey/" in path:
        return _json_response({"public_key": "pk", "signature": "sig"})
    if method == "GET" and path == "/api/v1/kms/phala/next_app_id":
        return _json_response({"app_ids": [{"app_id": "a", "nonce": 1}]})
    if method == "GET" and path.startswith("/api/v1/kms/"):
        return _json_response(
            {
                "id": "k1",
                "slug": "phala",
                "url": "u",
                "version": "1",
                "chain_id": None,
                "kms_contract_address": None,
                "gateway_app_id": None,
            }
        )

    # cvm list/info
    if method == "GET" and path == "/api/v1/cvms/paginated":
        if request.headers.get("X-Phala-Version") == "2025-10-28":
            return _json_response(
                {
                    "items": [
                        {
                            "hosted": {
                                "id": "1",
                                "name": "n",
                                "status": "running",
                                "app_id": "a",
                                "instance_id": None,
                            },
                            "name": "n",
                            "status": "running",
                            "in_progress": False,
                            "kms_info": None,
                        }
                    ],
                    "total": 1,
                    "page": 1,
                    "page_size": 10,
                    "pages": 1,
                }
            )
        return _json_response(
            {
                "items": [{"id": "1", "name": "n", "resource": {}, "status": "running"}],
                "total": 1,
                "page": 1,
                "page_size": 10,
                "pages": 1,
            }
        )
    if method == "GET" and path.startswith("/api/v1/cvms/"):
        if path.endswith("/compose_file"):
            return _json_response({"name": "app", "docker_compose_file": "services: {}"})
        if path.endswith("/stats"):
            return _json_response({"status": "running"})
        if path.endswith("/network"):
            return _json_response({"is_online": True})
        if path.endswith("/docker-compose.yml"):
            return httpx.Response(200, text="services: {}")
        if path.endswith("/composition"):
            return _json_response({"is_online": True})
        if path.endswith("/attestation"):
            return _json_response({"is_online": True})
        if path.endswith("/available-os-images"):
            return _json_response([])
        if path.endswith("/state"):
            return _json_response({"status": "running", "name": "n"})
        if path.endswith("/pre-launch-script"):
            return httpx.Response(200, text="#!/bin/sh")
        if path.endswith("/user_config"):
            return _json_response({"hostname": "n", "ssh_authorized_keys": []})
        return _json_response({"id": "1", "name": "n", "status": "running", "resource": {}})

    # cvm mutations
    if method == "POST" and path == "/api/v1/cvms/provision":
        return _json_response({"compose_hash": "hash", "app_id": "app_1"})
    if method == "POST" and path == "/api/v1/cvms":
        return _json_response({"id": 1, "name": "n", "status": "running"})
    if method == "POST" and path.endswith("/compose_file/provision"):
        return _json_response({"compose_hash": "hash", "app_id": "app_1"})
    if method == "PATCH" and path.endswith("/compose_file"):
        return httpx.Response(202, json={})
    if method == "PATCH" and path.endswith("/envs"):
        return _json_response({"status": "in_progress", "message": "ok", "correlation_id": "c"})
    if method == "PATCH" and path.endswith("/docker-compose"):
        return _json_response({"status": "in_progress", "message": "ok", "correlation_id": "c"})
    if method == "PATCH" and path.endswith("/pre-launch-script"):
        return _json_response({"status": "in_progress", "message": "ok", "correlation_id": "c"})

    if method == "POST" and any(
        path.endswith(s) for s in ["/start", "/stop", "/shutdown", "/restart", "/replicas"]
    ):
        return _json_response({"id": 1, "name": "n", "status": "running"})
    if method == "DELETE" and path.startswith("/api/v1/cvms/"):
        return httpx.Response(204)
    if method == "PATCH" and any(path.endswith(s) for s in ["/resources", "/os-image"]):
        return httpx.Response(202)
    # patch_cvm / confirm_cvm_patch: PATCH /cvms/{cvm_id} (no sub-path)
    if (
        method == "PATCH"
        and "/cvms/" in path
        and not any(
            path.endswith(s)
            for s in [
                "/envs",
                "/docker-compose",
                "/pre-launch-script",
                "/visibility",
                "/instance-id",
                "/resources",
                "/os-image",
                "/compose_file",
                "/compose",
                "/name",
                "/listed",
                "/scheduled-delete",
            ]
        )
        and path != "/api/v1/cvms/instance-ids"
    ):
        return _json_response({"correlation_id": "corr-123"}, status=202)
    if method == "PATCH" and path.endswith("/visibility"):
        return _json_response({"status": "running"})
    if method == "PATCH" and path.endswith("/instance-id"):
        return _json_response({"status": "updated"})
    if method == "PATCH" and path == "/api/v1/cvms/instance-ids":
        return _json_response(
            {
                "total": 1,
                "scanned": 1,
                "updated": 1,
                "unchanged": 0,
                "skipped": 0,
                "conflicts": 0,
                "errors": 0,
                "items": [],
            }
        )

    # ssh
    if method == "GET" and path == "/api/v1/user/ssh-keys":
        return _json_response([{"id": "k", "name": "n", "public_key": "pk"}])
    if method == "POST" and path == "/api/v1/user/ssh-keys":
        return _json_response({"id": "k", "name": "n", "public_key": "pk"})
    if method == "DELETE" and path.startswith("/api/v1/user/ssh-keys/"):
        return httpx.Response(204)
    if method == "POST" and path.endswith("/github-profile"):
        return _json_response(
            {"github_username": "octo", "keys_added": 1, "keys_skipped": 0, "errors": []}
        )
    if method == "POST" and path.endswith("/github-sync"):
        return _json_response(
            {"synced_count": 1, "keys_added": 1, "keys_updated": 0, "keys_removed": 0, "errors": []}
        )

    # apps
    if method == "GET" and path == "/api/v1/apps":
        return _json_response({"items": [], "total": 0, "page": 1, "page_size": 10, "pages": 0})
    if method == "GET" and path.endswith("/filter-options"):
        return _json_response(
            {
                "statuses": [],
                "image_versions": [],
                "instance_types": [],
                "kms_slugs": [],
                "kms_types": [],
                "regions": [],
                "nodes": [],
            }
        )
    if method == "GET" and path.endswith("/attestations"):
        return _json_response({"instances": []})
    if method == "GET" and path.endswith("/device-allowlist"):
        return _json_response({"is_onchain_kms": False, "allow_any_device": True, "devices": []})
    if method == "GET" and path.endswith("/cvms") and path.startswith("/api/v1/apps/"):
        return _json_response([])
    if method == "GET" and path.endswith("/revisions"):
        return _json_response(
            {"revisions": [], "total": 0, "page": 1, "page_size": 10, "total_pages": 0}
        )
    if method == "GET" and "/revisions/" in path:
        return _json_response(
            {
                "revision_id": "rev_1",
                "app_id": "a",
                "vm_uuid": "u",
                "compose_hash": "h",
                "created_at": "2025-01-01T00:00:00Z",
                "operation_type": "deploy",
            }
        )
    if method == "GET" and path.startswith("/api/v1/apps/"):
        return _json_response({"id": "a", "name": "app"})

    if method == "POST" and path == "/api/v1/status/batch":
        return _json_response({"vm1": {"status": "running"}})

    if method == "GET" and path == "/api/v1/os-images":
        return _json_response(
            {
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
            }
        )

    raise AssertionError(f"Unhandled route: {method} {path}")


def test_sync_action_matrix_and_safe() -> None:
    transport = httpx.MockTransport(_mock_handler)
    with httpx.Client(transport=transport, base_url="https://cloud-api.phala.com/api/v1") as raw:
        c = PhalaCloud(http_client=raw)

        calls = [
            lambda: c.get_current_user(),
            lambda: c.get_available_nodes(),
            lambda: c.get_cvm_create_resources(),
            lambda: c.get_cvm_list(),
            lambda: c.get_kms_list(),
            lambda: c.list_all_instance_type_families(),
            lambda: c.list_family_instance_types({"family": "cpu"}),
            lambda: c.list_workspaces(),
            lambda: c.get_workspace("team"),
            lambda: c.get_workspace_nodes({"teamSlug": "team"}),
            lambda: c.get_workspace_quotas("team"),
            lambda: c.get_cvm_info({"id": "c1"}),
            lambda: c.provision_cvm(
                {"name": "hello1", "compose_file": {"docker_compose_file": "services: {}"}}
            ),
            lambda: c.commit_cvm_provision({"app_id": "a", "compose_hash": "h"}),
            lambda: c.get_cvm_compose_file({"id": "c1"}),
            lambda: c.provision_cvm_compose_file_update(
                {"id": "c1", "app_compose": {"docker_compose_file": "services: {}"}}
            ),
            lambda: c.commit_cvm_compose_file_update({"id": "c1", "compose_hash": "h"}),
            lambda: c.update_cvm_envs({"id": "c1", "encrypted_env": "x"}),
            lambda: c.update_docker_compose({"id": "c1", "docker_compose_file": "services: {}"}),
            lambda: c.update_pre_launch_script({"id": "c1", "pre_launch_script": "#!/bin/sh"}),
            lambda: c.get_cvm_pre_launch_script({"id": "c1"}),
            lambda: c.start_cvm({"id": "c1"}),
            lambda: c.stop_cvm({"id": "c1"}),
            lambda: c.shutdown_cvm({"id": "c1"}),
            lambda: c.restart_cvm({"id": "c1"}),
            lambda: c.delete_cvm({"id": "c1"}),
            lambda: c.get_cvm_stats({"id": "c1"}),
            lambda: c.get_cvm_network({"id": "c1"}),
            lambda: c.get_cvm_docker_compose({"id": "c1"}),
            lambda: c.get_cvm_containers_stats({"id": "c1"}),
            lambda: c.get_cvm_attestation({"id": "c1"}),
            lambda: c.update_cvm_resources({"id": "c1", "vcpu": 1}),
            lambda: c.update_cvm_visibility(
                {"id": "c1", "public_sysinfo": True, "public_logs": False}
            ),
            lambda: c.get_available_os_images({"id": "c1"}),
            lambda: c.update_os_image({"id": "c1", "os_image_name": "prod"}),
            lambda: c.get_cvm_state({"id": "c1"}),
            lambda: c.get_kms_info({"kms_id": "k1"}),
            lambda: c.get_app_env_encrypt_pub_key({"kms": "phala", "app_id": "a"}),
            lambda: c.next_app_ids(),
            lambda: c.list_ssh_keys(),
            lambda: c.import_github_profile_ssh_keys({"github_username": "octo"}),
            lambda: c.create_ssh_key({"name": "n", "public_key": "pk"}),
            lambda: c.delete_ssh_key({"keyId": "k"}),
            lambda: c.sync_github_ssh_keys(),
            lambda: c.get_cvm_status_batch({"vmUuids": ["v1"]}),
            lambda: c.get_cvm_user_config({"id": "c1"}),
            lambda: c.refresh_cvm_instance_id({"id": "c1"}),
            lambda: c.refresh_cvm_instance_ids({}),
            lambda: c.replicate_cvm({"id": "c1"}),
            lambda: c.patch_cvm({"id": "c1", "vcpu": 2}),
            lambda: c.confirm_cvm_patch(
                {"id": "c1", "compose_hash": "h", "transaction_hash": "tx"}
            ),
            lambda: c.get_app_list(),
            lambda: c.get_app_info({"appId": "a"}),
            lambda: c.get_app_cvms({"appId": "a"}),
            lambda: c.get_app_revisions({"appId": "a"}),
            lambda: c.get_app_revision_detail({"appId": "a", "revisionId": "r"}),
            lambda: c.get_app_filter_options(),
            lambda: c.get_app_attestation({"appId": "a"}),
            lambda: c.get_kms_on_chain_detail({"chain": "base"}),
            lambda: c.get_os_images(),
            lambda: c.get_app_device_allowlist({"appId": "a"}),
        ]

        for call in calls:
            call()

        assert c.safe_get_current_user().ok
        assert c.safe_get_available_nodes().ok
        assert c.safe_get_cvm_create_resources().ok
        assert c.safe_get_cvm_list().ok
        assert c.safe_get_kms_list().ok


def test_safe_matrix_sync_all_actions() -> None:
    transport = httpx.MockTransport(_mock_handler)
    with httpx.Client(transport=transport, base_url="https://cloud-api.phala.com/api/v1") as raw:
        c = PhalaCloud(http_client=raw)
        cases = {
            "safe_list_all_instance_type_families": (),
            "safe_get_cvm_create_resources": (),
            "safe_list_family_instance_types": ({"family": "cpu"},),
            "safe_list_workspaces": (),
            "safe_get_workspace": ("team",),
            "safe_get_workspace_nodes": ({"teamSlug": "team"},),
            "safe_get_workspace_quotas": ("team",),
            "safe_get_cvm_info": ({"id": "c1"},),
            "safe_provision_cvm": (
                {"name": "hello1", "compose_file": {"docker_compose_file": "services: {}"}},
            ),
            "safe_commit_cvm_provision": ({"app_id": "a", "compose_hash": "h"},),
            "safe_get_cvm_compose_file": ({"id": "c1"},),
            "safe_provision_cvm_compose_file_update": (
                {"id": "c1", "app_compose": {"docker_compose_file": "services: {}"}},
            ),
            "safe_commit_cvm_compose_file_update": ({"id": "c1", "compose_hash": "h"},),
            "safe_update_cvm_envs": ({"id": "c1", "encrypted_env": "x"},),
            "safe_update_docker_compose": ({"id": "c1", "docker_compose_file": "services: {}"},),
            "safe_update_pre_launch_script": ({"id": "c1", "pre_launch_script": "#!/bin/sh"},),
            "safe_get_cvm_pre_launch_script": ({"id": "c1"},),
            "safe_start_cvm": ({"id": "c1"},),
            "safe_stop_cvm": ({"id": "c1"},),
            "safe_shutdown_cvm": ({"id": "c1"},),
            "safe_restart_cvm": ({"id": "c1"},),
            "safe_delete_cvm": ({"id": "c1"},),
            "safe_get_cvm_stats": ({"id": "c1"},),
            "safe_get_cvm_network": ({"id": "c1"},),
            "safe_get_cvm_docker_compose": ({"id": "c1"},),
            "safe_get_cvm_containers_stats": ({"id": "c1"},),
            "safe_get_cvm_attestation": ({"id": "c1"},),
            "safe_update_cvm_resources": ({"id": "c1", "vcpu": 1},),
            "safe_update_cvm_visibility": (
                {"id": "c1", "public_sysinfo": True, "public_logs": False},
            ),
            "safe_get_available_os_images": ({"id": "c1"},),
            "safe_update_os_image": ({"id": "c1", "os_image_name": "prod"},),
            "safe_get_cvm_state": ({"id": "c1"},),
            "safe_get_kms_info": ({"kms_id": "k1"},),
            "safe_get_app_env_encrypt_pub_key": ({"kms": "phala", "app_id": "a"},),
            "safe_next_app_ids": (),
            "safe_list_ssh_keys": (),
            "safe_import_github_profile_ssh_keys": ({"github_username": "octo"},),
            "safe_create_ssh_key": ({"name": "n", "public_key": "pk"},),
            "safe_delete_ssh_key": ({"keyId": "k"},),
            "safe_sync_github_ssh_keys": (),
            "safe_get_cvm_status_batch": ({"vmUuids": ["v1"]},),
            "safe_get_cvm_user_config": ({"id": "c1"},),
            "safe_refresh_cvm_instance_id": ({"id": "c1"},),
            "safe_refresh_cvm_instance_ids": ({},),
            "safe_replicate_cvm": ({"id": "c1"},),
            "safe_patch_cvm": ({"id": "c1", "vcpu": 2},),
            "safe_confirm_cvm_patch": (
                {"id": "c1", "compose_hash": "h", "transaction_hash": "tx"},
            ),
            "safe_get_app_list": (),
            "safe_get_app_info": ({"appId": "a"},),
            "safe_get_app_cvms": ({"appId": "a"},),
            "safe_get_app_revisions": ({"appId": "a"},),
            "safe_get_app_revision_detail": ({"appId": "a", "revisionId": "r"},),
            "safe_get_app_filter_options": (),
            "safe_get_app_attestation": ({"appId": "a"},),
            "safe_get_kms_on_chain_detail": ({"chain": "base"},),
            "safe_get_os_images": (),
            "safe_get_app_device_allowlist": ({"appId": "a"},),
        }

        for method_name, args in cases.items():
            result = getattr(c, method_name)(*args)
            assert result.ok, method_name


def test_version_branch_legacy_sync() -> None:
    def legacy_handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/v1/auth/me":
            return httpx.Response(
                200,
                json={
                    "username": "alice",
                    "email": "a@example.com",
                    "credits": 1,
                    "granted_credits": 0,
                    "avatar": "",
                    "team_name": "t",
                    "team_tier": "free",
                },
            )
        if request.url.path == "/api/v1/cvms/paginated":
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "hosted": {
                                "id": "1",
                                "name": "n",
                                "status": "running",
                                "app_id": "a",
                                "instance_id": None,
                            },
                            "name": "n",
                            "status": "running",
                            "in_progress": False,
                            "kms_info": None,
                        }
                    ],
                    "total": 1,
                    "page": 1,
                    "page_size": 10,
                    "pages": 1,
                },
            )
        return _mock_handler(request)

    transport = httpx.MockTransport(legacy_handler)
    with httpx.Client(transport=transport, base_url="https://cloud-api.phala.com/api/v1") as raw:
        c = PhalaCloud(http_client=raw, version="2025-10-28")
        me = c.get_current_user()
        assert hasattr(me, "username")
        cvms = c.get_cvm_list()
        assert cvms.items


def test_465_precondition_sync() -> None:
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
    with httpx.Client(transport=transport, base_url="https://cloud-api.phala.com/api/v1") as raw:
        c = PhalaCloud(http_client=raw)
        out = c.update_cvm_envs({"id": "c1", "encrypted_env": "x"})
        assert out.status == "precondition_required"


def test_watch_cvm_state_sse_sync() -> None:
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
    with httpx.Client(transport=transport, base_url="https://cloud-api.phala.com/api/v1") as raw:
        c = PhalaCloud(http_client=raw)
        state = c.watch_cvm_state({"id": "c1", "target": "running", "timeout": 30, "maxRetries": 0})
        assert getattr(state, "status", None) == "running"
