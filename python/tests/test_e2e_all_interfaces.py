from __future__ import annotations

import asyncio
import os
import time
import uuid
from typing import Any

import pytest

from phala_cloud import create_async_client, create_client

# ---------------------------------------------------------------------------
# Docker Compose for test CVM
# ---------------------------------------------------------------------------

TEST_COMPOSE = """\
services:
  app:
    image: ghcr.io/phala-network/phala-cloud-bun-starter:latest
    restart: unless-stopped
    ports:
      - "80:3000"
    volumes:
      - /var/run/tappd.sock:/var/run/tappd.sock
      - /var/run/dstack.sock:/var/run/dstack.sock
"""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _must_env(name: str, default: str | None = None) -> str:
    value = os.getenv(name)
    if not value or not value.strip():
        if default is not None:
            return default
        pytest.skip(f"Missing env: {name}")
    cleaned = value.strip().strip('"').strip("'")
    if name == "PHALA_CLOUD_E2E_BASE_URL" and not cleaned.startswith(("http://", "https://")):
        cleaned = f"https://{cleaned}"
    return cleaned


def _gen_cvm_name() -> str:
    return f"e2e-test-{uuid.uuid4().hex[:8]}"


def _attr(obj: Any, key: str, default: Any = None) -> Any:
    val = getattr(obj, key, None)
    if val is None and isinstance(obj, dict):
        val = obj.get(key)
    return val if val is not None else default


# ---------------------------------------------------------------------------
# CVM state
# ---------------------------------------------------------------------------

_TRANSIENT = {
    "starting",
    "stopping",
    "restarting",
    "shutting_down",
    "provisioning",
    "in_progress",
    "updating",
}


def _get_detail(client: Any, cvm_id: str) -> dict[str, Any]:
    info = client.get_cvm_info({"id": cvm_id})
    status = str(_attr(info, "status", "unknown")).lower()
    progress = _attr(info, "progress")
    p_target = _attr(progress, "target") if progress else None
    return {
        "status": status,
        "app_id": _attr(info, "app_id"),
        "has_progress": p_target is not None,
        "progress_target": p_target,
        "progress_started": _attr(progress, "started_at") if progress else None,
    }


async def _get_detail_async(client: Any, cvm_id: str) -> dict[str, Any]:
    info = await client.get_cvm_info({"id": cvm_id})
    status = str(_attr(info, "status", "unknown")).lower()
    progress = _attr(info, "progress")
    p_target = _attr(progress, "target") if progress else None
    return {
        "status": status,
        "app_id": _attr(info, "app_id"),
        "has_progress": p_target is not None,
        "progress_target": p_target,
        "progress_started": _attr(progress, "started_at") if progress else None,
    }


def _log_state(label: str, d: dict[str, Any]) -> None:
    extra = (
        f" progress.target={d['progress_target']} since={d['progress_started']}"
        if d["has_progress"]
        else ""
    )
    print(f"  [{label}] status={d['status']}{extra}", flush=True)


def _is_idle(d: dict[str, Any]) -> bool:
    return not d["has_progress"] and d["status"] not in _TRANSIENT


def _wait_idle(client: Any, cvm_id: str, timeout: int = 600) -> dict[str, Any]:
    deadline = time.time() + timeout
    last_log = 0.0
    d: dict[str, Any] = {}
    while time.time() < deadline:
        d = _get_detail(client, cvm_id)
        now = time.time()
        if now - last_log >= 30:
            _log_state(f"waiting {int(deadline - now)}s left", d)
            last_log = now
        if _is_idle(d):
            return d
        time.sleep(5)
    _log_state("timeout", d)
    raise AssertionError(f"CVM {cvm_id} not idle within {timeout}s: {d['status']}")


async def _wait_idle_async(client: Any, cvm_id: str, timeout: int = 600) -> dict[str, Any]:
    deadline = time.time() + timeout
    last_log = 0.0
    d: dict[str, Any] = {}
    while time.time() < deadline:
        d = await _get_detail_async(client, cvm_id)
        now = time.time()
        if now - last_log >= 30:
            _log_state(f"waiting {int(deadline - now)}s left", d)
            last_log = now
        if _is_idle(d):
            return d
        await asyncio.sleep(5)
    _log_state("timeout", d)
    raise AssertionError(f"CVM {cvm_id} not idle within {timeout}s: {d['status']}")


def _assert_idle(client: Any, cvm_id: str, label: str) -> dict[str, Any]:
    d = _get_detail(client, cvm_id)
    _log_state(f"before {label}", d)
    assert _is_idle(d), f"CVM not idle before {label}: status={d['status']}"
    return d


async def _assert_idle_async(client: Any, cvm_id: str, label: str) -> dict[str, Any]:
    d = await _get_detail_async(client, cvm_id)
    _log_state(f"before {label}", d)
    assert _is_idle(d), f"CVM not idle before {label}: status={d['status']}"
    return d


# ---------------------------------------------------------------------------
# Encrypt helper
# ---------------------------------------------------------------------------


async def _encrypt_envs(pubkey_hex: str) -> str:
    from dstack_sdk import encrypt_env_vars
    from dstack_sdk.encrypt_env_vars import EnvVar

    envs = [EnvVar(key="E2E_TEST", value="1")]
    return await encrypt_env_vars(envs, pubkey_hex)


# ---------------------------------------------------------------------------
# Deploy & cleanup
# ---------------------------------------------------------------------------


def _deploy(client: Any) -> tuple[str, str | None, str | None]:
    """Deploy test CVM. Returns (cvm_id, app_id, encrypt_pubkey)."""
    name = _gen_cvm_name()
    print(f"deploy: provisioning {name} ...", flush=True)

    provision = client.provision_cvm(
        {
            "name": name,
            "instance_type": "tdx.small",
            "compose_file": {
                "docker_compose_file": TEST_COMPOSE,
                "gateway_enabled": True,
            },
        }
    )
    app_id = _attr(provision, "app_id")
    compose_hash = _attr(provision, "compose_hash")
    encrypt_pubkey = _attr(provision, "app_env_encrypt_pubkey")
    assert app_id, f"missing app_id: {provision}"
    assert compose_hash, f"missing compose_hash: {provision}"
    print(f"deploy: app_id={app_id} encrypt_pubkey={'yes' if encrypt_pubkey else 'no'}", flush=True)

    print("deploy: committing ...", flush=True)
    commit = client.commit_cvm_provision({"app_id": app_id, "compose_hash": compose_hash})
    cvm_id = str(_attr(commit, "id") or _attr(commit, "cvm_id") or app_id)

    print(f"deploy: cvm_id={cvm_id}, waiting for idle ...", flush=True)
    d = _wait_idle(client, cvm_id)
    _log_state("deployed", d)
    return cvm_id, d.get("app_id") or app_id, encrypt_pubkey


async def _deploy_async(client: Any) -> tuple[str, str | None, str | None]:
    name = _gen_cvm_name()
    print(f"deploy(async): provisioning {name} ...", flush=True)

    provision = await client.provision_cvm(
        {
            "name": name,
            "instance_type": "tdx.small",
            "compose_file": {
                "docker_compose_file": TEST_COMPOSE,
                "gateway_enabled": True,
            },
        }
    )
    app_id = _attr(provision, "app_id")
    compose_hash = _attr(provision, "compose_hash")
    encrypt_pubkey = _attr(provision, "app_env_encrypt_pubkey")
    assert app_id, f"missing app_id: {provision}"
    assert compose_hash, f"missing compose_hash: {provision}"

    print(f"deploy(async): committing app_id={app_id} ...", flush=True)
    commit = await client.commit_cvm_provision({"app_id": app_id, "compose_hash": compose_hash})
    cvm_id = str(_attr(commit, "id") or _attr(commit, "cvm_id") or app_id)

    print(f"deploy(async): cvm_id={cvm_id}, waiting for idle ...", flush=True)
    d = await _wait_idle_async(client, cvm_id)
    _log_state("deployed", d)
    return cvm_id, d.get("app_id") or app_id, encrypt_pubkey


def _cleanup(client: Any, cvm_id: str) -> None:
    print(f"cleanup: deleting {cvm_id} ...", flush=True)
    r = client.safe_delete_cvm({"id": cvm_id})
    print(f"cleanup: {'ok' if getattr(r, 'ok', True) else getattr(r, 'error', '?')}", flush=True)


async def _cleanup_async(client: Any, cvm_id: str) -> None:
    print(f"cleanup(async): deleting {cvm_id} ...", flush=True)
    r = await client.safe_delete_cvm({"id": cvm_id})
    print(
        f"cleanup(async): {'ok' if getattr(r, 'ok', True) else getattr(r, 'error', '?')}",
        flush=True,
    )


# ---------------------------------------------------------------------------
# ID pickers
# ---------------------------------------------------------------------------


def _pick_kms_id(kms_list: Any) -> str:
    items = getattr(kms_list, "items", None) or []
    assert items, "Need at least one KMS"
    return str(items[0].id)


def _pick_workspace_slug(workspaces: Any) -> str:
    data = getattr(workspaces, "data", None) or []
    assert data, "Need at least one workspace"
    return str(data[0].slug)


# ---------------------------------------------------------------------------
# Sync E2E
# ---------------------------------------------------------------------------


@pytest.mark.e2e
def test_e2e_sync_all_interfaces() -> None:
    base_url = _must_env("PHALA_CLOUD_E2E_BASE_URL", "https://cloud-api.phala.com/api/v1")
    api_key = _must_env("PHALA_CLOUD_E2E_API_KEY")
    client = create_client(api_key=api_key, base_url=base_url)
    cvm_id: str | None = None

    print(f"\n=== E2E sync ({base_url}) ===", flush=True)

    try:
        # ================================================================
        # 1. Read-only APIs (no CVM)
        # ================================================================

        # generic request styles
        print("generic requests ...", flush=True)
        client.request("GET", "/kms")
        assert client.safe_request_method("GET", "/kms").ok
        assert client.request_full("GET", "/kms")["status"] >= 200
        assert client.safe_request_full("GET", "/kms").ok

        # user
        print("user ...", flush=True)
        client.get_current_user()
        assert client.safe_get_current_user().ok

        # nodes
        print("nodes ...", flush=True)
        client.get_available_nodes()
        assert client.safe_get_available_nodes().ok

        # cvm list
        print("cvm list ...", flush=True)
        client.get_cvm_list()
        assert client.safe_get_cvm_list().ok

        # kms list
        print("kms list ...", flush=True)
        kms_list = client.get_kms_list()
        assert client.safe_get_kms_list().ok
        kms_id = _pick_kms_id(kms_list)

        # kms info
        print("kms info ...", flush=True)
        client.get_kms_info({"kms_id": kms_id})
        assert client.safe_get_kms_info({"kms_id": kms_id}).ok

        # next_app_ids
        print("next_app_ids ...", flush=True)
        client.next_app_ids()
        assert client.safe_next_app_ids().ok

        # kms on-chain (may not exist, safe call only)
        print("kms on-chain ...", flush=True)
        client.safe_get_kms_on_chain_detail({"chain": "base"})

        # workspaces
        print("workspaces ...", flush=True)
        workspaces = client.list_workspaces()
        workspace_slug = _pick_workspace_slug(workspaces)
        assert client.safe_get_workspace(workspace_slug).ok
        assert client.safe_get_workspace_nodes({"teamSlug": workspace_slug}).ok
        assert client.safe_get_workspace_quotas(workspace_slug).ok

        # instance types
        print("instance types ...", flush=True)
        assert client.safe_list_all_instance_type_families().ok
        assert client.safe_list_family_instance_types({"family": "cpu"}).ok

        # ssh keys (list, create, delete)
        print("ssh keys ...", flush=True)
        assert client.safe_list_ssh_keys().ok
        client.safe_sync_github_ssh_keys()

        ssh_result = client.safe_create_ssh_key(
            {
                "name": f"e2e-test-{uuid.uuid4().hex[:8]}",
                "public_key": (
                    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITestKeyForE2E"
                    "000000000000000000000000000000 e2e@test"
                ),
            }
        )
        if ssh_result.ok and ssh_result.data:
            key_id = _attr(ssh_result.data, "id") or _attr(ssh_result.data, "key_id")
            if key_id:
                client.safe_delete_ssh_key({"keyId": str(key_id)})

        # os images
        print("os images ...", flush=True)
        client.get_os_images()
        assert client.safe_get_os_images().ok

        # app list & filter options
        print("app list ...", flush=True)
        client.get_app_list()
        assert client.safe_get_app_list().ok
        client.get_app_filter_options()
        client.safe_get_app_filter_options()

        # ================================================================
        # 2. Deploy test CVM
        # ================================================================

        cvm_id, app_id, encrypt_pubkey = _deploy(client)
        req = {"id": cvm_id}

        # ================================================================
        # 3. CVM read APIs
        # ================================================================

        print("cvm reads ...", flush=True)
        d = _get_detail(client, cvm_id)
        _log_state("reads", d)

        assert client.safe_get_cvm_info(req).ok
        assert client.safe_get_cvm_compose_file(req).ok
        assert client.safe_get_cvm_pre_launch_script(req).ok
        assert client.safe_get_cvm_state(req).ok
        assert client.safe_get_cvm_stats(req).ok
        assert client.safe_get_cvm_network(req).ok
        assert client.safe_get_cvm_docker_compose(req).ok
        assert client.safe_get_cvm_containers_stats(req).ok
        assert client.safe_get_cvm_attestation(req).ok
        assert client.safe_get_cvm_user_config(req).ok
        assert client.safe_get_available_os_images(req).ok
        assert client.safe_get_cvm_status_batch({"vmUuids": [cvm_id]}).ok

        # ================================================================
        # 4. App read APIs
        # ================================================================

        if app_id:
            print(f"app reads ({app_id}) ...", flush=True)
            client.safe_get_app_info({"appId": app_id})
            client.safe_get_app_cvms({"appId": app_id})

            revisions_result = client.safe_get_app_revisions({"appId": app_id})
            if revisions_result.ok and revisions_result.data:
                items = _attr(revisions_result.data, "items") or []
                if items:
                    rev_id = _attr(items[0], "id")
                    if rev_id:
                        client.safe_get_app_revision_detail(
                            {
                                "appId": app_id,
                                "revisionId": str(rev_id),
                            }
                        )

            client.safe_get_app_attestation({"appId": app_id})
            client.safe_get_app_device_allowlist({"appId": app_id})

        # kms pubkey for the app
        if app_id:
            print("kms pubkey ...", flush=True)
            client.safe_get_app_env_encrypt_pub_key({"kms": "phala", "app_id": app_id})

        # ================================================================
        # 5. Watch SSE
        # ================================================================

        print("watch cvm state ...", flush=True)
        state = client.get_cvm_state(req)
        target = str(_attr(state, "status", "running"))
        client.watch_cvm_state({"id": cvm_id, "target": target, "timeout": 20, "maxRetries": 0})

        # ================================================================
        # 6. CVM mutations (check idle → mutate → wait idle)
        # ================================================================

        # -- update_cvm_visibility --
        _assert_idle(client, cvm_id, "update_cvm_visibility")
        print("  update_cvm_visibility ...", flush=True)
        r = client.safe_update_cvm_visibility(
            {"id": cvm_id, "public_sysinfo": True, "public_logs": True}
        )
        assert r.ok, r.error
        print("  [ok]", flush=True)
        _wait_idle(client, cvm_id)

        # -- update_cvm_envs (with proper encryption) --
        if encrypt_pubkey:
            _assert_idle(client, cvm_id, "update_cvm_envs")
            print("  update_cvm_envs (encrypted) ...", flush=True)
            encrypted = asyncio.run(_encrypt_envs(encrypt_pubkey))
            r = client.safe_update_cvm_envs({"id": cvm_id, "encrypted_env": encrypted})
            assert r.ok, r.error
            print("  [ok]", flush=True)
            _wait_idle(client, cvm_id)
        else:
            print("  [skip] update_cvm_envs: no encrypt_pubkey from provision", flush=True)

        # -- update_docker_compose --
        _assert_idle(client, cvm_id, "update_docker_compose")
        print("  update_docker_compose ...", flush=True)
        r = client.safe_update_docker_compose({"id": cvm_id, "docker_compose_file": TEST_COMPOSE})
        assert r.ok, r.error
        print("  [ok]", flush=True)
        _wait_idle(client, cvm_id)

        # -- update_pre_launch_script --
        _assert_idle(client, cvm_id, "update_pre_launch_script")
        print("  update_pre_launch_script ...", flush=True)
        r = client.safe_update_pre_launch_script(
            {"id": cvm_id, "pre_launch_script": "#!/bin/sh\ntrue"}
        )
        assert r.ok, r.error
        print("  [ok]", flush=True)
        _wait_idle(client, cvm_id)

        # -- refresh_cvm_instance_id --
        _assert_idle(client, cvm_id, "refresh_cvm_instance_id")
        print("  refresh_cvm_instance_id ...", flush=True)
        r = client.safe_refresh_cvm_instance_id(req)
        assert r.ok, r.error
        print("  [ok]", flush=True)
        _wait_idle(client, cvm_id)

        # -- refresh_cvm_instance_ids (global, no cvm_id needed) --
        print("  refresh_cvm_instance_ids ...", flush=True)
        r = client.safe_refresh_cvm_instance_ids({})
        assert r.ok, r.error
        print("  [ok]", flush=True)

        # ================================================================
        # 7. Lifecycle: restart → stop → start
        # ================================================================

        # restart
        _assert_idle(client, cvm_id, "restart_cvm")
        print("  restart_cvm ...", flush=True)
        r = client.safe_restart_cvm(req)
        assert r.ok, r.error
        print("  [ok]", flush=True)
        d = _wait_idle(client, cvm_id)
        _log_state("after restart", d)
        assert d["status"] == "running"

        # stop
        _assert_idle(client, cvm_id, "stop_cvm")
        print("  stop_cvm ...", flush=True)
        r = client.safe_stop_cvm(req)
        assert r.ok, r.error
        print("  [ok]", flush=True)
        d = _wait_idle(client, cvm_id)
        _log_state("after stop", d)

        # start
        _assert_idle(client, cvm_id, "start_cvm")
        print("  start_cvm ...", flush=True)
        r = client.safe_start_cvm(req)
        assert r.ok, r.error
        print("  [ok]", flush=True)
        d = _wait_idle(client, cvm_id)
        _log_state("after start", d)
        assert d["status"] == "running"

        # shutdown (coverage call, then start again for cleanup)
        _assert_idle(client, cvm_id, "shutdown_cvm")
        print("  shutdown_cvm ...", flush=True)
        r = client.safe_shutdown_cvm(req)
        assert r.ok, r.error
        print("  [ok]", flush=True)
        _wait_idle(client, cvm_id)

        # ================================================================
        # 8. Delete (tested via cleanup in finally)
        # ================================================================

        print("=== sync test done ===", flush=True)

    finally:
        if cvm_id:
            _cleanup(client, cvm_id)


# ---------------------------------------------------------------------------
# Async E2E
# ---------------------------------------------------------------------------


@pytest.mark.e2e
@pytest.mark.asyncio
async def test_e2e_async_all_interfaces() -> None:
    base_url = _must_env("PHALA_CLOUD_E2E_BASE_URL", "https://cloud-api.phala.com/api/v1")
    api_key = _must_env("PHALA_CLOUD_E2E_API_KEY")
    client = create_async_client(api_key=api_key, base_url=base_url)
    cvm_id: str | None = None

    print(f"\n=== E2E async ({base_url}) ===", flush=True)

    try:
        # ---- Read-only ----

        print("generic requests ...", flush=True)
        await client.request("GET", "/kms")
        assert (await client.safe_request_method("GET", "/kms")).ok
        assert (await client.request_full("GET", "/kms"))["status"] >= 200
        assert (await client.safe_request_full("GET", "/kms")).ok

        print("user ...", flush=True)
        assert (await client.safe_get_current_user()).ok

        print("nodes ...", flush=True)
        assert (await client.safe_get_available_nodes()).ok

        print("cvm list ...", flush=True)
        assert (await client.safe_get_cvm_list()).ok

        print("kms ...", flush=True)
        kms_list = await client.get_kms_list()
        kms_id = _pick_kms_id(kms_list)
        assert (await client.safe_get_kms_info({"kms_id": kms_id})).ok
        assert (await client.safe_next_app_ids()).ok
        await client.safe_get_kms_on_chain_detail({"chain": "base"})

        print("workspaces ...", flush=True)
        workspaces = await client.list_workspaces()
        ws = _pick_workspace_slug(workspaces)
        assert (await client.safe_get_workspace(ws)).ok
        assert (await client.safe_get_workspace_nodes({"teamSlug": ws})).ok
        assert (await client.safe_get_workspace_quotas(ws)).ok

        print("instance types ...", flush=True)
        assert (await client.safe_list_all_instance_type_families()).ok
        assert (await client.safe_list_family_instance_types({"family": "cpu"})).ok

        print("ssh keys ...", flush=True)
        assert (await client.safe_list_ssh_keys()).ok
        await client.safe_sync_github_ssh_keys()

        print("os images ...", flush=True)
        assert (await client.safe_get_os_images()).ok

        print("app list ...", flush=True)
        assert (await client.safe_get_app_list()).ok
        await client.get_app_filter_options()

        # ---- Deploy ----

        cvm_id, app_id, encrypt_pubkey = await _deploy_async(client)
        req = {"id": cvm_id}

        # ---- CVM reads ----

        print("cvm reads ...", flush=True)
        d = await _get_detail_async(client, cvm_id)
        _log_state("reads", d)

        assert (await client.safe_get_cvm_info(req)).ok
        assert (await client.safe_get_cvm_compose_file(req)).ok
        assert (await client.safe_get_cvm_pre_launch_script(req)).ok
        assert (await client.safe_get_cvm_state(req)).ok
        assert (await client.safe_get_cvm_stats(req)).ok
        assert (await client.safe_get_cvm_network(req)).ok
        assert (await client.safe_get_cvm_docker_compose(req)).ok
        assert (await client.safe_get_cvm_containers_stats(req)).ok
        assert (await client.safe_get_cvm_attestation(req)).ok
        assert (await client.safe_get_cvm_user_config(req)).ok
        assert (await client.safe_get_available_os_images(req)).ok
        assert (await client.safe_get_cvm_status_batch({"vmUuids": [cvm_id]})).ok

        # ---- App reads ----

        if app_id:
            print(f"app reads ({app_id}) ...", flush=True)
            await client.safe_get_app_info({"appId": app_id})
            await client.safe_get_app_cvms({"appId": app_id})
            await client.safe_get_app_revisions({"appId": app_id})
            await client.safe_get_app_attestation({"appId": app_id})
            await client.safe_get_app_device_allowlist({"appId": app_id})
            await client.safe_get_app_env_encrypt_pub_key({"kms": "phala", "app_id": app_id})

        # ---- Watch SSE ----

        print("watch cvm state ...", flush=True)
        state = await client.get_cvm_state(req)
        target = str(_attr(state, "status", "running"))
        await client.watch_cvm_state(
            {"id": cvm_id, "target": target, "timeout": 20, "maxRetries": 0}
        )

        # ---- Mutations ----

        # update_cvm_visibility
        await _assert_idle_async(client, cvm_id, "update_cvm_visibility")
        print("  update_cvm_visibility ...", flush=True)
        r = await client.safe_update_cvm_visibility(
            {"id": cvm_id, "public_sysinfo": True, "public_logs": True}
        )
        assert r.ok, r.error
        print("  [ok]", flush=True)
        await _wait_idle_async(client, cvm_id)

        # update_cvm_envs
        if encrypt_pubkey:
            await _assert_idle_async(client, cvm_id, "update_cvm_envs")
            print("  update_cvm_envs (encrypted) ...", flush=True)
            encrypted = await _encrypt_envs(encrypt_pubkey)
            r = await client.safe_update_cvm_envs({"id": cvm_id, "encrypted_env": encrypted})
            assert r.ok, r.error
            print("  [ok]", flush=True)
            await _wait_idle_async(client, cvm_id)
        else:
            print("  [skip] update_cvm_envs: no encrypt_pubkey", flush=True)

        # update_docker_compose
        await _assert_idle_async(client, cvm_id, "update_docker_compose")
        print("  update_docker_compose ...", flush=True)
        r = await client.safe_update_docker_compose(
            {"id": cvm_id, "docker_compose_file": TEST_COMPOSE}
        )
        assert r.ok, r.error
        print("  [ok]", flush=True)
        await _wait_idle_async(client, cvm_id)

        # update_pre_launch_script
        await _assert_idle_async(client, cvm_id, "update_pre_launch_script")
        print("  update_pre_launch_script ...", flush=True)
        r = await client.safe_update_pre_launch_script(
            {"id": cvm_id, "pre_launch_script": "#!/bin/sh\ntrue"}
        )
        assert r.ok, r.error
        print("  [ok]", flush=True)
        await _wait_idle_async(client, cvm_id)

        # ---- Lifecycle ----

        await _assert_idle_async(client, cvm_id, "restart_cvm")
        print("  restart_cvm ...", flush=True)
        r = await client.safe_restart_cvm(req)
        assert r.ok, r.error
        print("  [ok]", flush=True)
        d = await _wait_idle_async(client, cvm_id)
        assert d["status"] == "running"

        await _assert_idle_async(client, cvm_id, "stop_cvm")
        print("  stop_cvm ...", flush=True)
        r = await client.safe_stop_cvm(req)
        assert r.ok, r.error
        print("  [ok]", flush=True)
        await _wait_idle_async(client, cvm_id)

        await _assert_idle_async(client, cvm_id, "start_cvm")
        print("  start_cvm ...", flush=True)
        r = await client.safe_start_cvm(req)
        assert r.ok, r.error
        print("  [ok]", flush=True)
        d = await _wait_idle_async(client, cvm_id)
        assert d["status"] == "running"

        print("=== async test done ===", flush=True)

    finally:
        if cvm_id:
            await _cleanup_async(client, cvm_id)
        await client.aclose()


# ---------------------------------------------------------------------------
# patch_cvm E2E — deploy → patch (various combos) → verify → cleanup
# ---------------------------------------------------------------------------


@pytest.mark.e2e
def test_e2e_patch_cvm() -> None:
    base_url = _must_env("PHALA_CLOUD_E2E_BASE_URL", "https://cloud-api.phala.com/api/v1")
    api_key = _must_env("PHALA_CLOUD_E2E_API_KEY")
    client = create_client(api_key=api_key, base_url=base_url)
    cvm_id: str | None = None

    print(f"\n=== E2E patch_cvm ({base_url}) ===", flush=True)

    try:
        # Deploy
        cvm_id, app_id, encrypt_pubkey = _deploy(client)
        req = {"id": cvm_id}

        # 1. Visibility-only patch
        _assert_idle(client, cvm_id, "patch: visibility")
        print("  patch: visibility ...", flush=True)
        result = client.patch_cvm(
            {
                "id": cvm_id,
                "public_logs": True,
                "public_sysinfo": True,
            }
        )
        assert not result["requires_on_chain_hash"]
        assert result["correlation_id"]
        print(f"  [ok] correlation_id={result['correlation_id']}", flush=True)
        _wait_idle(client, cvm_id)

        # Verify visibility was applied
        info = client.get_cvm_info(req)
        assert getattr(info, "public_logs", None) is True
        assert getattr(info, "public_sysinfo", None) is True
        print("  [verified] visibility applied", flush=True)

        # 2. Docker compose patch
        _assert_idle(client, cvm_id, "patch: docker_compose")
        print("  patch: docker_compose ...", flush=True)
        result = client.patch_cvm(
            {
                "id": cvm_id,
                "docker_compose_file": TEST_COMPOSE,
            }
        )
        assert not result["requires_on_chain_hash"]
        assert result["correlation_id"]
        print(f"  [ok] correlation_id={result['correlation_id']}", flush=True)
        _wait_idle(client, cvm_id)

        # 3. Pre-launch script patch
        _assert_idle(client, cvm_id, "patch: pre_launch_script")
        print("  patch: pre_launch_script ...", flush=True)
        result = client.patch_cvm(
            {
                "id": cvm_id,
                "pre_launch_script": "#!/bin/sh\necho patched",
            }
        )
        assert not result["requires_on_chain_hash"]
        assert result["correlation_id"]
        print(f"  [ok] correlation_id={result['correlation_id']}", flush=True)
        _wait_idle(client, cvm_id)

        # 4. Encrypted env patch
        if encrypt_pubkey:
            _assert_idle(client, cvm_id, "patch: encrypted_env")
            print("  patch: encrypted_env ...", flush=True)
            encrypted = asyncio.run(_encrypt_envs(encrypt_pubkey))
            result = client.patch_cvm(
                {
                    "id": cvm_id,
                    "encrypted_env": encrypted,
                }
            )
            assert not result["requires_on_chain_hash"]
            assert result["correlation_id"]
            print(f"  [ok] correlation_id={result['correlation_id']}", flush=True)
            _wait_idle(client, cvm_id)

        # 5. Multi-field patch (visibility + compose together)
        _assert_idle(client, cvm_id, "patch: multi-field")
        print("  patch: multi-field (visibility + compose) ...", flush=True)
        result = client.patch_cvm(
            {
                "id": cvm_id,
                "public_logs": False,
                "docker_compose_file": TEST_COMPOSE,
            }
        )
        assert not result["requires_on_chain_hash"]
        assert result["correlation_id"]
        print(f"  [ok] correlation_id={result['correlation_id']}", flush=True)
        _wait_idle(client, cvm_id)

        # Verify multi-field was applied
        info = client.get_cvm_info(req)
        assert getattr(info, "public_logs", None) is False
        print("  [verified] multi-field applied", flush=True)

        # 6. safe_patch_cvm
        _assert_idle(client, cvm_id, "safe_patch_cvm")
        print("  safe_patch_cvm ...", flush=True)
        r = client.safe_patch_cvm({"id": cvm_id, "public_sysinfo": False})
        assert r.ok, r.error
        print("  [ok]", flush=True)
        _wait_idle(client, cvm_id)

        print("=== patch_cvm test done ===", flush=True)

    finally:
        if cvm_id:
            _cleanup(client, cvm_id)
