"""Schema parity checks against the JS SDK.

Each test pins a field the JS SDK exposes so the Python models cannot silently
drift from the wire contract again.
"""

from __future__ import annotations

from phala_cloud.models.cvms import CvmInfoV20260121, CvmInfoV20260522


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
