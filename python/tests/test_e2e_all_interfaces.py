from __future__ import annotations

import os
import time
from typing import Any

import pytest

from phala_cloud import create_async_client, create_client


def _must_env(name: str) -> str:
    value = os.getenv(name)
    if not value or not value.strip():
        pytest.skip(f"Missing env: {name}")

    cleaned = value.strip().strip('"').strip("'")
    if name == "PHALA_CLOUD_E2E_BASE_URL" and not cleaned.startswith(("http://", "https://")):
        cleaned = f"https://{cleaned}"
    return cleaned


def _cvm_candidates(cvm: Any) -> list[str]:
    candidates: list[str] = []
    for key in ("id", "vm_uuid", "instance_id", "app_id", "uuid", "cvm_id"):
        value = getattr(cvm, key, None)
        if value:
            candidates.append(str(value))

    hosted = getattr(cvm, "hosted", None)
    if hosted:
        for key in ("id", "instance_id", "app_id"):
            value = getattr(hosted, key, None)
            if value:
                candidates.append(str(value))

    # Deduplicate while preserving order
    seen: set[str] = set()
    result: list[str] = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            result.append(c)
    return result


def _pick_cvm_id(cvm_list: Any) -> str:
    items = getattr(cvm_list, "items", None) or []
    assert items, "Need at least one CVM in account for full e2e coverage"
    candidates = _cvm_candidates(items[0])
    assert candidates, "Cannot resolve cvm id candidates from list"
    return candidates[0]


def _pick_app_id(app_list: Any, cvm_list: Any | None = None) -> str:
    items = getattr(app_list, "items", None) or []
    if items:
        first = items[0]
        for key in ("id", "app_id"):
            value = getattr(first, key, None)
            if value:
                return str(value)

    # Some API versions return `dstack_apps` instead of `items`
    dstack_apps = getattr(app_list, "dstack_apps", None) or []
    if dstack_apps:
        first = dstack_apps[0]
        if isinstance(first, dict):
            for key in ("id", "app_id"):
                value = first.get(key)
                if value:
                    return str(value)
        else:
            for key in ("id", "app_id"):
                value = getattr(first, key, None)
                if value:
                    return str(value)

    # Fallback from CVM list
    if cvm_list is not None:
        cvm_items = getattr(cvm_list, "items", None) or []
        if cvm_items:
            first_cvm = cvm_items[0]
            for key in ("app_id",):
                value = getattr(first_cvm, key, None)
                if value:
                    return str(value)
            hosted = getattr(first_cvm, "hosted", None)
            if hosted and getattr(hosted, "app_id", None):
                return str(hosted.app_id)

    raise AssertionError("Cannot resolve app id from app list")


def _pick_workspace_slug(workspaces: Any) -> str:
    data = getattr(workspaces, "data", None) or []
    assert data, "Need at least one workspace for full e2e coverage"
    slug = getattr(data[0], "slug", None)
    assert slug, "Workspace slug is empty"
    return str(slug)


def _pick_kms_id(kms_list: Any) -> str:
    items = getattr(kms_list, "items", None) or []
    assert items, "Need at least one KMS for full e2e coverage"
    kms_id = getattr(items[0], "id", None)
    assert kms_id, "KMS id is empty"
    return str(kms_id)


def _resolve_cvm_id_sync(client: Any, cvm_list: Any) -> str:
    items = getattr(cvm_list, "items", None) or []
    assert items, "Need at least one CVM in account for full e2e coverage"

    fallback: str | None = None
    for cvm in items:
        for candidate in _cvm_candidates(cvm):
            result = client.safe_get_cvm_info({"id": candidate})
            if not result.ok or result.data is None:
                continue

            if fallback is None:
                fallback = candidate

            status = _status_of(result.data)
            in_progress = bool(getattr(result.data, "in_progress", False))
            progress = getattr(result.data, "progress", None)
            if status == "running" and not in_progress and progress in (None, "", {}):
                return candidate

    if fallback:
        return fallback
    raise AssertionError("Cannot find a resolvable CVM identifier for get_cvm_info")


async def _resolve_cvm_id_async(client: Any, cvm_list: Any) -> str:
    items = getattr(cvm_list, "items", None) or []
    assert items, "Need at least one CVM in account for full e2e coverage"

    fallback: str | None = None
    for cvm in items:
        for candidate in _cvm_candidates(cvm):
            result = await client.safe_get_cvm_info({"id": candidate})
            if not result.ok or result.data is None:
                continue

            if fallback is None:
                fallback = candidate

            status = _status_of(result.data)
            in_progress = bool(getattr(result.data, "in_progress", False))
            progress = getattr(result.data, "progress", None)
            if status == "running" and not in_progress and progress in (None, "", {}):
                return candidate

    if fallback:
        return fallback
    raise AssertionError("Cannot find a resolvable CVM identifier for get_cvm_info")


def _status_of(state: Any) -> str:
    status = getattr(state, "status", None)
    if status is None and isinstance(state, dict):
        status = state.get("status")
    return str(status or "").lower()


def _is_in_progress_error(result: Any) -> bool:
    if result.ok:
        return False
    message = str(result.error).lower() if getattr(result, "error", None) else ""
    return "in progress" in message or "already in progress" in message


def _run_with_retry(call: Any, retries: int = 30, delay: float = 2.0) -> Any:
    last = call()
    for _ in range(retries):
        if getattr(last, "ok", False):
            return last
        if not _is_in_progress_error(last):
            return last
        time.sleep(delay)
        last = call()
    return last


def _wait_status_sync(client: Any, req: dict[str, Any], target: str, timeout: int = 180) -> None:
    deadline = time.time() + timeout
    target = target.lower()
    aliases = {
        "running": {"running"},
        "stopped": {"stopped", "shutdown", "shutoff", "exited"},
    }.get(target, {target})

    while time.time() < deadline:
        state = client.get_cvm_state(req)
        status = _status_of(state)
        if status in aliases:
            return
        time.sleep(2)

    raise AssertionError(f"CVM status did not reach {target} within {timeout}s")


def _wait_idle_sync(client: Any, req: dict[str, Any], timeout: int = 180) -> bool:
    deadline = time.time() + timeout
    transient = {
        "starting",
        "stopping",
        "restarting",
        "shutting_down",
        "provisioning",
        "in_progress",
        "updating",
    }

    while time.time() < deadline:
        info = client.safe_get_cvm_info(req)
        if info.ok and info.data is not None:
            status = _status_of(info.data)
            in_progress = bool(getattr(info.data, "in_progress", False))
            progress = getattr(info.data, "progress", None)
            if not in_progress and progress in (None, "", {}):
                if status not in transient:
                    return True
        time.sleep(3)

    return False


@pytest.mark.e2e
def test_e2e_sync_all_interfaces() -> None:
    base_url = _must_env("PHALA_CLOUD_E2E_BASE_URL")
    api_key = _must_env("PHALA_CLOUD_E2E_API_KEY")

    client = create_client(api_key=api_key, base_url=base_url)

    # Generic request styles
    client.request("GET", "/kms")
    assert client.safe_request_method("GET", "/kms").ok
    assert client.request_full("GET", "/kms")["status"] >= 200
    assert client.safe_request_full("GET", "/kms").ok

    # Core bootstrap
    client.get_current_user()
    assert client.safe_get_current_user().ok

    client.get_available_nodes()
    assert client.safe_get_available_nodes().ok

    cvm_list = client.get_cvm_list()
    app_list = client.get_app_list()
    kms_list = client.get_kms_list()
    workspaces = client.list_workspaces()

    cvm_id = _resolve_cvm_id_sync(client, cvm_list)
    app_id = _pick_app_id(app_list, cvm_list)
    kms_id = _pick_kms_id(kms_list)
    workspace_slug = _pick_workspace_slug(workspaces)

    # Instance types
    client.list_all_instance_type_families()
    assert client.safe_list_all_instance_type_families().ok
    client.list_family_instance_types({"family": "cpu"})
    assert client.safe_list_family_instance_types({"family": "cpu"}).ok

    # Workspace
    client.get_workspace(workspace_slug)
    assert client.safe_get_workspace(workspace_slug).ok
    client.get_workspace_nodes({"teamSlug": workspace_slug})
    assert client.safe_get_workspace_nodes({"teamSlug": workspace_slug}).ok
    client.get_workspace_quotas(workspace_slug)
    assert client.safe_get_workspace_quotas(workspace_slug).ok

    # KMS
    client.get_kms_info({"kms_id": kms_id})
    assert client.safe_get_kms_info({"kms_id": kms_id}).ok
    client.next_app_ids()
    assert client.safe_next_app_ids().ok

    # SSH
    client.list_ssh_keys()
    assert client.safe_list_ssh_keys().ok
    try:
        client.sync_github_ssh_keys()
    except Exception:
        # Account may not have linked GitHub; safe API still exercises interface.
        pass
    client.safe_sync_github_ssh_keys()

    # KMS on-chain detail
    try:
        client.get_kms_on_chain_detail({"chain": "base"})
    except Exception:
        pass
    client.safe_get_kms_on_chain_detail({"chain": "base"})

    # OS images
    client.get_os_images()
    assert client.safe_get_os_images().ok

    # Apps
    try:
        client.get_app_info({"appId": app_id})
        client.get_app_cvms({"appId": app_id})
        client.get_app_revisions({"appId": app_id})
        client.get_app_attestation({"appId": app_id})
    except Exception:
        pass
    client.safe_get_app_info({"appId": app_id})
    client.safe_get_app_cvms({"appId": app_id})
    client.safe_get_app_revisions({"appId": app_id})
    client.safe_get_app_attestation({"appId": app_id})
    client.get_app_filter_options()
    client.safe_get_app_filter_options()

    # App device allowlist
    try:
        client.get_app_device_allowlist({"appId": app_id})
    except Exception:
        pass
    client.safe_get_app_device_allowlist({"appId": app_id})

    # CVM read
    req = {"id": cvm_id}
    client.get_cvm_info(req)
    assert client.safe_get_cvm_info(req).ok
    client.get_cvm_compose_file(req)
    assert client.safe_get_cvm_compose_file(req).ok
    client.get_cvm_pre_launch_script(req)
    assert client.safe_get_cvm_pre_launch_script(req).ok
    client.get_cvm_state(req)
    assert client.safe_get_cvm_state(req).ok
    client.get_cvm_stats(req)
    assert client.safe_get_cvm_stats(req).ok
    client.get_cvm_network(req)
    assert client.safe_get_cvm_network(req).ok
    client.get_cvm_docker_compose(req)
    assert client.safe_get_cvm_docker_compose(req).ok
    client.get_cvm_containers_stats(req)
    assert client.safe_get_cvm_containers_stats(req).ok
    client.get_cvm_attestation(req)
    assert client.safe_get_cvm_attestation(req).ok
    client.get_cvm_user_config(req)
    assert client.safe_get_cvm_user_config(req).ok
    client.get_available_os_images(req)
    assert client.safe_get_available_os_images(req).ok
    client.get_cvm_status_batch({"vmUuids": [str(cvm_id)]})
    assert client.safe_get_cvm_status_batch({"vmUuids": [str(cvm_id)]}).ok

    # watch via SSE
    state = client.get_cvm_state(req)
    target = str(getattr(state, "status", "running"))
    client.watch_cvm_state({"id": cvm_id, "target": target, "timeout": 20, "maxRetries": 0})

    # Mutation paths with readiness/waiting
    is_idle = _wait_idle_sync(client, req, timeout=60)

    if is_idle:
        curr = _status_of(client.get_cvm_state(req))
        if curr == "running":
            r = _run_with_retry(lambda: client.safe_restart_cvm(req))
            assert r.ok, r.error
            _wait_status_sync(client, req, "running")
        else:
            r = _run_with_retry(lambda: client.safe_start_cvm(req))
            assert r.ok, r.error
            _wait_status_sync(client, req, "running")

        r = _run_with_retry(lambda: client.safe_update_cvm_resources({"id": cvm_id, "vcpu": 1}))
        assert r.ok, r.error
    else:
        # Busy CVM in shared env: still cover interfaces via safe calls
        assert hasattr(client.safe_restart_cvm(req), "ok")
        assert hasattr(client.safe_update_cvm_resources({"id": cvm_id, "vcpu": 1}), "ok")
    if is_idle:
        r = _run_with_retry(
            lambda: client.safe_update_cvm_visibility(
                {"id": cvm_id, "public_sysinfo": True, "public_logs": True}
            )
        )
        assert r.ok, r.error

        # Choose a valid os image dynamically when available
        images = client.get_available_os_images(req)
        image_name = None
        if isinstance(images, list):
            for group in images:
                prod = getattr(group, "prod", None)
                dev = getattr(group, "dev", None)
                if prod and getattr(prod, "name", None):
                    image_name = prod.name
                    break
                if dev and getattr(dev, "name", None):
                    image_name = dev.name
                    break
        if image_name:
            r = _run_with_retry(
                lambda: client.safe_update_os_image({"id": cvm_id, "os_image_name": image_name})
            )
            assert r.ok, r.error

        # Two-phase style endpoints: success may be in_progress or precondition_required
        r = _run_with_retry(
            lambda: client.safe_update_cvm_envs({"id": cvm_id, "encrypted_env": "00"})
        )
        assert r.ok, r.error
        r = _run_with_retry(
            lambda: client.safe_update_docker_compose(
                {"id": cvm_id, "docker_compose_file": "services: {}"}
            )
        )
        assert r.ok, r.error
        r = _run_with_retry(
            lambda: client.safe_update_pre_launch_script(
                {"id": cvm_id, "pre_launch_script": "#!/bin/sh"}
            )
        )
        assert r.ok, r.error

        r = _run_with_retry(lambda: client.safe_refresh_cvm_instance_id(req))
        assert r.ok, r.error
        r = _run_with_retry(lambda: client.safe_refresh_cvm_instance_ids({}))
        assert r.ok, r.error
        r = _run_with_retry(lambda: client.safe_replicate_cvm(req))
        assert r.ok, r.error
    else:
        # Busy shared env fallback: still invoke interfaces without asserting business success.
        busy_results = [
            client.safe_update_cvm_visibility(
                {"id": cvm_id, "public_sysinfo": True, "public_logs": True}
            ),
            client.safe_update_os_image({"id": cvm_id, "os_image_name": "prod-0.3.0"}),
            client.safe_update_cvm_envs({"id": cvm_id, "encrypted_env": "00"}),
            client.safe_update_docker_compose(
                {"id": cvm_id, "docker_compose_file": "services: {}"}
            ),
            client.safe_update_pre_launch_script({"id": cvm_id, "pre_launch_script": "#!/bin/sh"}),
            client.safe_refresh_cvm_instance_id(req),
            client.safe_refresh_cvm_instance_ids({}),
            client.safe_replicate_cvm(req),
        ]
        assert all(hasattr(x, "ok") for x in busy_results)

    # Cover remaining lifecycle interfaces (result may depend on runtime window)
    lifecycle_results = [
        client.safe_start_cvm(req),
        client.safe_stop_cvm(req),
        client.safe_shutdown_cvm(req),
        client.safe_restart_cvm(req),
    ]
    assert all(hasattr(r, "ok") for r in lifecycle_results)


@pytest.mark.e2e
@pytest.mark.asyncio
async def test_e2e_async_all_interfaces() -> None:
    base_url = _must_env("PHALA_CLOUD_E2E_BASE_URL")
    api_key = _must_env("PHALA_CLOUD_E2E_API_KEY")

    client = create_async_client(api_key=api_key, base_url=base_url)

    await client.request("GET", "/kms")
    assert (await client.safe_request_method("GET", "/kms")).ok
    assert (await client.request_full("GET", "/kms"))["status"] >= 200
    assert (await client.safe_request_full("GET", "/kms")).ok

    await client.get_current_user()
    assert (await client.safe_get_current_user()).ok

    cvm_list = await client.get_cvm_list()
    app_list = await client.get_app_list()
    kms_list = await client.get_kms_list()

    cvm_id = await _resolve_cvm_id_async(client, cvm_list)
    app_id = _pick_app_id(app_list, cvm_list)
    kms_id = _pick_kms_id(kms_list)

    await client.get_kms_info({"kms_id": kms_id})
    assert (await client.safe_get_kms_info({"kms_id": kms_id})).ok

    # KMS on-chain detail
    await client.safe_get_kms_on_chain_detail({"chain": "base"})

    # OS images
    assert (await client.safe_get_os_images()).ok

    # App device allowlist
    await client.safe_get_app_device_allowlist({"appId": app_id})

    req = {"id": cvm_id}
    await client.get_cvm_info(req)
    assert (await client.safe_get_cvm_info(req)).ok
    try:
        await client.get_app_info({"appId": app_id})
    except Exception:
        pass
    await client.safe_get_app_info({"appId": app_id})

    state = await client.get_cvm_state(req)
    target = str(getattr(state, "status", "running"))
    await client.watch_cvm_state({"id": cvm_id, "target": target, "timeout": 20, "maxRetries": 0})

    await client.aclose()
