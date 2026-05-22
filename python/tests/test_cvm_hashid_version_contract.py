from __future__ import annotations

import pytest
from pydantic import ValidationError

from phala_cloud.action_responses import (
    CommitCvmProvisionResponse,
    CommitCvmProvisionResponseV20260121,
    CommitCvmProvisionResponseV20260522,
    CvmActionResponse,
    CvmActionResponseV20260121,
    CvmActionResponseV20260522,
    RefreshInstanceIdResponse,
    RefreshInstanceIdResponseV20260121,
    RefreshInstanceIdResponseV20260522,
    RefreshInstanceIdsResponse,
    RefreshInstanceIdsResponseV20260121,
    RefreshInstanceIdsResponseV20260522,
)
from phala_cloud.models.apps import (
    DeviceAllowlistResponse,
    DeviceAllowlistResponseV20260121,
    DeviceAllowlistResponseV20260522,
)
from phala_cloud.models.cvms import (
    AppCvmsBatchIsAllowedResponse,
    AppCvmsBatchIsAllowedResponseV20260121,
    AppCvmsBatchIsAllowedResponseV20260522,
    CvmInfoV20260121,
    CvmInfoV20260522,
    IsAllowedResult,
    IsAllowedResultV20260121,
    IsAllowedResultV20260522,
    PaginatedCvmInfos,
    PaginatedCvmInfosV20260121,
    PaginatedCvmInfosV20260522,
)


def _cvm_info(cvm_id: int | str) -> dict:
    return {
        "id": cvm_id,
        "name": "cvm-1",
        "app_id": "app-1",
        "resource": {"instance_type": "tdx.small", "vcpu": 1, "memory_in_gb": 1},
        "status": "running",
    }


def _is_allowed(cvm_id: int | str) -> dict:
    return {
        "cvm_id": cvm_id,
        "app_contract_address": "0x123",
        "compose_hash": "compose-hash",
        "device_id": "dev-1",
        "compose_hash_allowed": True,
        "allow_any_device": False,
        "device_id_allowed": True,
        "is_allowed": True,
    }


def _refresh_result(cvm_id: int | str | None) -> dict:
    return {
        "cvm_id": cvm_id,
        "identifier": "cvm-1",
        "status": "updated",
        "old_instance_id": None,
        "new_instance_id": "inst-1",
        "source": "teepod_state",
        "verified_with_gateway": False,
    }


def test_cvm_info_models_keep_old_and_latest_id_shapes():
    assert CvmInfoV20260121.model_validate(_cvm_info(123)).id == 123
    assert CvmInfoV20260522.model_validate(_cvm_info("cvm_ykL5lbAn")).id == "cvm_ykL5lbAn"

    with pytest.raises(ValidationError):
        CvmInfoV20260522.model_validate(_cvm_info(123))


def test_paginated_cvm_info_models_keep_old_and_latest_id_shapes():
    old_payload = {"items": [_cvm_info(123)], "total": 1, "page": 1, "page_size": 20, "pages": 1}
    new_payload = {
        "items": [_cvm_info("cvm_ykL5lbAn")],
        "total": 1,
        "page": 1,
        "page_size": 20,
        "pages": 1,
    }

    assert PaginatedCvmInfosV20260121.model_validate(old_payload).items[0].id == 123
    assert PaginatedCvmInfosV20260522.model_validate(new_payload).items[0].id == "cvm_ykL5lbAn"
    assert PaginatedCvmInfos.model_validate(new_payload).items[0].id == "cvm_ykL5lbAn"

    with pytest.raises(ValidationError):
        PaginatedCvmInfos.model_validate(old_payload)


def test_cvm_action_response_models_keep_old_and_latest_id_shapes():
    assert (
        CommitCvmProvisionResponseV20260121.model_validate(
            {"id": 123, "name": "cvm-1", "status": "running"}
        ).id
        == 123
    )
    assert (
        CommitCvmProvisionResponseV20260522.model_validate(
            {"id": "cvm_ykL5lbAn", "name": "cvm-1", "status": "running"}
        ).id
        == "cvm_ykL5lbAn"
    )
    assert (
        CommitCvmProvisionResponse.model_validate(
            {"id": "cvm_ykL5lbAn", "name": "cvm-1", "status": "running"}
        ).id
        == "cvm_ykL5lbAn"
    )

    assert CvmActionResponseV20260121.model_validate({"id": 123, "status": "running"}).id == 123
    assert (
        CvmActionResponseV20260522.model_validate({"id": "cvm_ykL5lbAn", "status": "running"}).id
        == "cvm_ykL5lbAn"
    )
    assert (
        CvmActionResponse.model_validate({"id": "cvm_ykL5lbAn", "status": "running"}).id
        == "cvm_ykL5lbAn"
    )

    with pytest.raises(ValidationError):
        CommitCvmProvisionResponse.model_validate({"id": 123, "name": "cvm-1", "status": "running"})
    with pytest.raises(ValidationError):
        CvmActionResponse.model_validate({"id": 123, "status": "running"})


def test_allowance_models_keep_old_and_latest_id_shapes():
    assert IsAllowedResultV20260121.model_validate(_is_allowed(123)).cvm_id == 123
    assert (
        IsAllowedResultV20260522.model_validate(_is_allowed("cvm_ykL5lbAn")).cvm_id
        == "cvm_ykL5lbAn"
    )
    assert IsAllowedResult.model_validate(_is_allowed("cvm_ykL5lbAn")).cvm_id == "cvm_ykL5lbAn"

    old_batch = {"is_onchain": True, "results": [_is_allowed(123)], "skipped_cvm_ids": [456]}
    new_batch = {
        "is_onchain": True,
        "results": [_is_allowed("cvm_ykL5lbAn")],
        "skipped_cvm_ids": ["cvm_ykL5lbAn"],
    }
    assert AppCvmsBatchIsAllowedResponseV20260121.model_validate(old_batch).results[0].cvm_id == 123
    assert (
        AppCvmsBatchIsAllowedResponseV20260522.model_validate(new_batch).results[0].cvm_id
        == "cvm_ykL5lbAn"
    )
    assert (
        AppCvmsBatchIsAllowedResponse.model_validate(new_batch).results[0].cvm_id == "cvm_ykL5lbAn"
    )

    with pytest.raises(ValidationError):
        IsAllowedResult.model_validate(_is_allowed(123))
    with pytest.raises(ValidationError):
        AppCvmsBatchIsAllowedResponse.model_validate(old_batch)


def test_device_allowlist_models_keep_old_and_latest_id_shapes():
    old_payload = {
        "is_onchain_kms": True,
        "devices": [
            {"device_id": "dev-1", "allowed_onchain": True, "status": "allowed", "cvm_ids": [123]}
        ],
    }
    new_payload = {
        "is_onchain_kms": True,
        "devices": [
            {
                "device_id": "dev-1",
                "allowed_onchain": True,
                "status": "allowed",
                "cvm_ids": ["cvm_ykL5lbAn"],
            }
        ],
    }

    assert DeviceAllowlistResponseV20260121.model_validate(old_payload).devices[0].cvm_ids == [123]
    assert DeviceAllowlistResponseV20260522.model_validate(new_payload).devices[0].cvm_ids == [
        "cvm_ykL5lbAn"
    ]
    assert DeviceAllowlistResponse.model_validate(new_payload).devices[0].cvm_ids == [
        "cvm_ykL5lbAn"
    ]

    with pytest.raises(ValidationError):
        DeviceAllowlistResponse.model_validate(old_payload)


def test_refresh_instance_id_models_keep_old_and_latest_id_shapes():
    assert RefreshInstanceIdResponseV20260121.model_validate(_refresh_result(123)).cvm_id == 123
    assert (
        RefreshInstanceIdResponseV20260522.model_validate(_refresh_result("cvm_ykL5lbAn")).cvm_id
        == "cvm_ykL5lbAn"
    )
    assert (
        RefreshInstanceIdResponse.model_validate(_refresh_result("cvm_ykL5lbAn")).cvm_id
        == "cvm_ykL5lbAn"
    )
    assert RefreshInstanceIdResponse.model_validate(_refresh_result(None)).cvm_id is None

    old_batch = {
        "total": 1,
        "scanned": 1,
        "updated": 1,
        "unchanged": 0,
        "skipped": 0,
        "conflicts": 0,
        "errors": 0,
        "items": [_refresh_result(123)],
    }
    new_batch = {**old_batch, "items": [_refresh_result("cvm_ykL5lbAn")]}

    assert RefreshInstanceIdsResponseV20260121.model_validate(old_batch).items[0].cvm_id == 123
    assert (
        RefreshInstanceIdsResponseV20260522.model_validate(new_batch).items[0].cvm_id
        == "cvm_ykL5lbAn"
    )
    assert RefreshInstanceIdsResponse.model_validate(new_batch).items[0].cvm_id == "cvm_ykL5lbAn"

    with pytest.raises(ValidationError):
        RefreshInstanceIdResponse.model_validate(_refresh_result(123))
    with pytest.raises(ValidationError):
        RefreshInstanceIdsResponse.model_validate(old_batch)
