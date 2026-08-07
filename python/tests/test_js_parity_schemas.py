"""Schema parity checks against the JS SDK.

Each test pins a field the JS SDK exposes so the Python models cannot silently
drift from the wire contract again.
"""

from __future__ import annotations

from phala_cloud.action_responses import WorkspaceResponse
from phala_cloud.models.cvms import CvmInfoV20260121, CvmInfoV20260522, CvmResourceUsage
from phala_cloud.models.nodes import DeviceIdEntry


def _cvm_info(**overrides: object) -> dict:
    payload: dict = {
        "id": "cvm_ykL5lbAn",
        "name": "cvm-1",
        "resource": {"instance_type": "tdx.small", "vcpu": 1, "memory_in_gb": 1},
        "status": "running",
    }
    payload.update(overrides)
    return payload


class TestManagedEnv:
    def test_is_a_declared_field(self) -> None:
        # CloudModel allows extra keys, so attribute access alone would pass
        # even if the field were missing from the model.
        assert "managed_env" in CvmInfoV20260121.model_fields
        assert "managed_env" in CvmInfoV20260522.model_fields

    def test_defaults_to_false_when_absent(self) -> None:
        assert CvmInfoV20260121.model_validate(_cvm_info()).managed_env is False
        assert CvmInfoV20260522.model_validate(_cvm_info()).managed_env is False

    def test_reads_wire_value(self) -> None:
        payload = _cvm_info(managed_env=True)
        assert CvmInfoV20260121.model_validate(payload).managed_env is True
        assert CvmInfoV20260522.model_validate(payload).managed_env is True


class TestCvmResourceUsageDisk:
    def test_disk_fields_are_declared(self) -> None:
        assert "disk_used_bytes" in CvmResourceUsage.model_fields
        assert "disk_total_bytes" in CvmResourceUsage.model_fields

    def test_reads_wire_values(self) -> None:
        usage = CvmResourceUsage.model_validate({"disk_used_bytes": 1024, "disk_total_bytes": 8192})
        assert usage.disk_used_bytes == 1024
        assert usage.disk_total_bytes == 8192

    def test_defaults_to_none_when_absent(self) -> None:
        usage = CvmResourceUsage.model_validate({"cpu_percent": 1.5})
        assert usage.disk_used_bytes is None
        assert usage.disk_total_bytes is None


class TestWorkspaceResponse:
    def test_declares_the_full_js_field_set(self) -> None:
        expected = {
            "avatar_url",
            "description",
            "is_default",
            "created_at",
            "confidential_models_enabled",
            "billing_status",
            "suspended_at",
        }
        assert expected <= set(WorkspaceResponse.model_fields)

    def test_billing_status_defaults_to_active(self) -> None:
        workspace = WorkspaceResponse.model_validate({"id": "wks_1", "name": "acme"})
        assert workspace.billing_status == "active"
        assert workspace.suspended_at is None

    def test_reads_suspended_state(self) -> None:
        workspace = WorkspaceResponse.model_validate(
            {
                "id": "wks_1",
                "name": "acme",
                "avatar_url": "https://example.test/a.png",
                "billing_status": "suspended",
                "suspended_at": "2026-08-01T00:00:00Z",
            }
        )
        assert workspace.billing_status == "suspended"
        assert workspace.suspended_at == "2026-08-01T00:00:00Z"
        assert workspace.avatar_url == "https://example.test/a.png"


class TestDeviceIdEntry:
    def test_no_longer_declares_os_image_ids(self) -> None:
        # device_id is keyed by (physical node, KMS algorithm version) alone;
        # the OS image list was dropped from the wire contract.
        assert "os_image_ids" not in DeviceIdEntry.model_fields

    def test_decodes_the_current_wire_shape(self) -> None:
        entry = DeviceIdEntry.model_validate(
            {"device_id": "0xdev", "algorithm_version": "v1", "enabled": True}
        )
        assert entry.device_id == "0xdev"
        assert entry.algorithm_version == "v1"
        assert entry.enabled is True
