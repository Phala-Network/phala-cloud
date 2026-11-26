from __future__ import annotations

import json

import httpx

from phala_cloud import PhalaCloud
from phala_cloud.action_responses import WorkspaceResponse
from phala_cloud.models.apps import AppRevisionResponse, DstackAppListResponseV20260522
from phala_cloud.models.auth import CurrentUserV20260121
from phala_cloud.models.cvms import (
    ComposePatch,
    CvmInfoDetailV20261111,
    GetCvmListRequest,
    ReplicaVM,
)


def test_get_app_list_reads_dstack_apps() -> None:
    payload = {
        "dstack_apps": [
            {
                "id": "app_1",
                "name": "web",
                "app_id": "abc",
                "created_at": "2026-01-01T00:00:00Z",
                "kms_type": "phala",
                "cvm_count": 1,
            }
        ],
        "page": 1,
        "page_size": 20,
        "total": 1,
        "total_pages": 1,
    }

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/apps"
        return httpx.Response(200, json=payload)

    with httpx.Client(
        transport=httpx.MockTransport(handler), base_url="https://cloud-api.phala.com/api/v1"
    ) as raw:
        result = PhalaCloud(http_client=raw).get_app_list()
    assert isinstance(result, DstackAppListResponseV20260522)
    assert result.dstack_apps[0].name == "web"


def test_cvm_detail_types_finality_and_node_id() -> None:
    detail = CvmInfoDetailV20261111.model_validate(
        {
            "id": "cvm-1",
            "name": "app",
            "status": "running",
            "resource": {"vcpu": 1, "memory_in_mb": 1024},
            "enabled_ssh_access": True,
            "node_info": {"object_type": "node", "id": 7, "node_id": 42},
            "kms_info": {"block_tag": "finalized", "finality_eta_seconds": 12},
            "finality_wait": {
                "operation": "update",
                "correlation_id": "corr-2",
                "phase": "applying",
                "stage": "applying",
                "transaction": None,
                "finality": {},
            },
            "finality_failure": {
                "operation": "update",
                "correlation_id": "corr-old",
                "failure_reason": "timeout",
                "failed_at": "2026-01-02T00:00:00Z",
            },
        }
    )
    assert detail.enabled_ssh_access is True
    assert detail.node_info is not None and detail.node_info.node_id == 42
    assert detail.kms_info is not None and detail.kms_info.block_tag == "finalized"
    assert detail.finality_wait is not None
    assert detail.finality_failure is not None


def test_auth_me_types_user_id_and_features() -> None:
    user = CurrentUserV20260121.model_validate(
        {
            "user": {
                "id": "usr_1",
                "username": "ada",
                "email": "a@b.c",
                "role": "user",
                "avatar": "",
                "email_verified": True,
                "totp_enabled": False,
                "has_backup_codes": False,
                "flag_has_password": True,
            },
            "workspace": {"id": "wks_1", "name": "acme", "tier": "level_1", "role": "owner"},
            "credits": {
                "balance": "0",
                "granted_balance": "0",
                "is_post_paid": False,
                "outstanding_amount": None,
            },
            "features": [{"name": "can_create_cvm", "enabled": True}],
        }
    )
    assert user.user.id == "usr_1"
    assert user.features is not None and user.features[0].name == "can_create_cvm"


def test_workspace_types_viewer() -> None:
    workspace = WorkspaceResponse.model_validate(
        {"id": "wks_1", "name": "acme", "viewer": {"user": {"username": "ada"}, "features": []}}
    )
    assert workspace.viewer is not None


def test_revision_types_oidc_provenance() -> None:
    rev = AppRevisionResponse.model_validate(
        {
            "revision_id": "rev_1",
            "app_id": "abc",
            "vm_uuid": "u",
            "compose_hash": "h",
            "created_at": "2026-01-01T00:00:00Z",
            "operation_type": "deploy",
            "oidc_provenance": {
                "repository": "org/repo",
                "ref": "refs/heads/main",
                "sha": "deadbeef",
                "actor": "ada",
                "workflow_ref": "org/repo/.github/workflows/deploy.yml@refs/heads/main",
            },
        }
    )
    assert rev.oidc_provenance is not None
    assert rev.oidc_provenance.repository == "org/repo"


def test_compose_patch_allows_unknown_keys() -> None:
    patch = ComposePatch.model_validate({"future_compose_key": True, "secure_time": True})
    assert patch.secure_time is True
    assert patch.model_extra is not None
    assert "future_compose_key" in patch.model_extra


def test_cvm_list_request_types_filters() -> None:
    req = GetCvmListRequest.model_validate(
        {"search": "web", "status": ["running"], "kms_type": "PHALA", "node": "usw5"}
    )
    dumped = req.model_dump(exclude_none=True)
    assert dumped["search"] == "web"
    assert dumped["status"] == ["running"]
    assert dumped["node"] == "usw5"


def test_patch_cvm_sends_null_shutdown_timeout() -> None:
    seen: list[object] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(
            202, json={"message": "ok", "correlation_id": "c", "status": "in_progress"}
        )

    with httpx.Client(
        transport=httpx.MockTransport(handler), base_url="https://cloud-api.phala.com/api/v1"
    ) as raw:
        PhalaCloud(http_client=raw).patch_cvm({"id": "cvm-1", "shutdown_timeout": None})
    assert seen == [{"shutdown_timeout": None}]


def test_patch_cvm_returns_finality_wait() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            202,
            json={
                "status": "in_progress",
                "correlation_id": "corr-3",
                "finality_wait": {
                    "operation": "update",
                    "correlation_id": "corr-3",
                    "phase": "awaiting_finality",
                    "stage": "submitted",
                    "transaction": None,
                    "finality": {},
                },
            },
        )

    with httpx.Client(
        transport=httpx.MockTransport(handler), base_url="https://cloud-api.phala.com/api/v1"
    ) as raw:
        result = PhalaCloud(http_client=raw).patch_cvm({"id": "cvm-1", "public_logs": True})
    assert result["status"] == "in_progress"
    assert result["finality_wait"]["correlation_id"] == "corr-3"


def test_commit_sends_kms_fields() -> None:
    seen: list[object] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "id": "cvm-1",
                "name": "n",
                "status": "creating",
                "app_id": "a",
                "cvm_id": "cvm-1",
            },
        )

    with httpx.Client(
        transport=httpx.MockTransport(handler), base_url="https://cloud-api.phala.com/api/v1"
    ) as raw:
        PhalaCloud(http_client=raw).commit_cvm_provision(
            {
                "app_id": "a",
                "compose_hash": "h",
                "kms_id": "kms_1",
                "contract_address": "0xabc",
                "deployer_address": "0xdef",
            }
        )
    assert seen == [
        {
            "app_id": "a",
            "compose_hash": "h",
            "kms_id": "kms_1",
            "contract_address": "0xabc",
            "deployer_address": "0xdef",
        }
    ]


def test_replica_vm_does_not_require_resource() -> None:
    ReplicaVM.model_validate(
        {
            "id": "cvm-1",
            "name": "n",
            "status": "starting",
            "teepod_id": 1,
            "app_id": "a",
            "vcpu": 1,
            "memory": 1,
            "disk_size": 1,
            "created_at": "2026-01-01T00:00:00Z",
        }
    )
