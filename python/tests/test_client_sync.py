import httpx
import pytest

from phala_cloud import PhalaCloud
from phala_cloud.models import GetCvmListRequest


def test_get_app_attestation_decodes_typed_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/apps/app-123/attestations"
        return httpx.Response(
            200,
            json={
                "app_id": "app-123",
                "contract_address": "",
                "kms_info": {
                    "contract_address": "",
                    "chain_id": None,
                    "version": "v0.5.8",
                    "url": "https://kms.example.com",
                    "gateway_app_id": None,
                    "gateway_app_url": "https://gateway.example.com",
                    "kms_type": "phala",
                },
                "instances": [
                    {
                        "vm_uuid": "vm-1",
                        "name": "cvm-1",
                        "mr_config_id": "0xmrconfigid",
                        "tcb_info": {
                            "mrtd": "mrtd",
                            "rtmr0": "rtmr0",
                            "rtmr1": "rtmr1",
                            "rtmr2": "rtmr2",
                            "rtmr3": "rtmr3",
                            "event_log": [],
                            "app_compose": "{}",
                        },
                    }
                ],
                "kms_guest_agent_info": None,
                "gateway_guest_agent_info": None,
                "qemu_version": None,
            },
        )

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport, base_url="https://cloud-api.phala.com/api/v1") as raw:
        client = PhalaCloud(http_client=raw)
        attestation = client.get_app_attestation({"app_id": "app-123"})
        assert attestation.app_id == "app-123"
        assert len(attestation.instances) == 1
        assert attestation.instances[0].mr_config_id == "0xmrconfigid"
        assert attestation.instances[0].tcb_info is not None
        assert attestation.instances[0].tcb_info.rtmr3 == "rtmr3"


@pytest.mark.parametrize("filter_name", ["user_id", "teepod_id", "node_id"])
def test_get_cvm_list_rejects_removed_filters(filter_name: str) -> None:
    with pytest.raises(ValueError, match=f"Unsupported CVM list filters: {filter_name}"):
        GetCvmListRequest.model_validate({filter_name: "deprecated"})


def test_get_cvm_list_preserves_unknown_filters() -> None:
    request = GetCvmListRequest.model_validate({"future_filter": "value"})

    assert request.model_dump(exclude_none=True) == {"future_filter": "value"}


def test_get_current_user_sync() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/auth/me"
        return httpx.Response(
            200,
            json={
                "user": {
                    "username": "alice",
                    "email": "alice@example.com",
                    "role": "user",
                    "avatar": "",
                    "email_verified": True,
                    "totp_enabled": False,
                    "has_backup_codes": False,
                    "flag_has_password": True,
                },
                "workspace": {
                    "id": "w_1",
                    "name": "Demo",
                    "slug": "demo",
                    "tier": "free",
                    "role": "owner",
                },
                "credits": {
                    "balance": "100",
                    "granted_balance": "0",
                    "is_post_paid": False,
                    "outstanding_amount": None,
                },
            },
        )

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport, base_url="https://cloud-api.phala.com/api/v1") as raw:
        client = PhalaCloud(http_client=raw)
        me = client.get_current_user()
        assert me.user.username == "alice"
