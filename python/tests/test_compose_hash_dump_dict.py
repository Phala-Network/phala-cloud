"""get_compose_hash against hashes produced by the backend's AppComposeV2.dump_dict.

Each input is the backend's ``AppComposeV2.model_dump()``; the expected hash is
``sha256(dump_string(os_image_version))`` from teehouse.
"""

from __future__ import annotations

from typing import Any

import pytest

from phala_cloud.utils import get_compose_hash

_BACKEND_MODEL_DUMP: dict[str, Any] = {
    "allowed_envs": [],
    "bash_script": None,
    "default_gateway_domain": None,
    "docker_compose_file": "services:\n  app:\n    image: nginx:latest\n",
    "init_script": [],
    "key_provider": None,
    "key_provider_id": None,
    "kms_enabled": True,
    "local_key_provider_enabled": False,
    "manifest_version": 2,
    "no_instance_id": False,
    "port_policy": None,
    "pre_launch_script": None,
    "public_logs": True,
    "public_sysinfo": True,
    "public_tcbinfo": True,
    "runner": "docker-compose",
    "requirements": None,
    "storage_discard": None,
    "event_log_version": None,
    "snapshotter": None,
    "verity_volumes": None,
    "gateway_enabled": True,
    "features": ["kms", "tproxy-net"],
    "salt": None,
    "secure_time": False,
    "storage_fs": "zfs",
    "swap_size": None,
    "tproxy_enabled": True,
}


def _compose(**fields: Any) -> dict[str, Any]:
    return {**_BACKEND_MODEL_DUMP, **fields}


_CASES = [
    (
        "null_06_fields_dropped",
        "0.6.0",
        _compose(name="n06"),
        "9b01dbd4ac096f647c1a709707b7454a30575122259077911ab02a19d24743fa",
    ),
    (
        "dstack_06_fields_sent",
        "0.6.0",
        _compose(name="n06s", storage_discard=False, event_log_version=2, verity_volumes=[]),
        "acdd7633bd55ccd8721218b7c7a85be2cde7a92f08543d0367e909b4b5a662bb",
    ),
    (
        "requirements_explicit_defaults",
        "0.6.3",
        _compose(
            name="req",
            requirements={
                "ephemeral_data_disk": False,
                "health_check": False,
                "launch_token_hash": "ab" * 32,
            },
        ),
        "9965034b23da36a324e507e37e591e595e744e632e1483a3d1a6fd10ef9f47c7",
    ),
    (
        "os_055_single_init_script",
        "0.5.5",
        _compose(name="old", init_script=["echo hi"]),
        "331eadc105c565b0cd6837eb9e5984a7f51764760d373d0c94e8849eb781a5ae",
    ),
    (
        "os_055_no_init_script",
        "0.5.5",
        _compose(name="old0"),
        "5d94cf4591624d38539546c0f63aebe32c4076c44c4036868a0b446dc3fa079d",
    ),
    (
        "os_060_init_script_string",
        "0.6.0",
        _compose(name="new1", init_script="echo hi"),
        "7c4e0234412fdc856d851b283c763d748fefbd20bb1f086d74b0d99848dcdb85",
    ),
    (
        "gateway_disabled_keeps_tproxy_enabled",
        "0.6.0",
        _compose(name="gw", gateway_enabled=False),
        "d65292cd5e6616a1acf49b308fc51394441f101b6a52aa3f21f9097ba86f745f",
    ),
]


@pytest.mark.parametrize(
    ("os_image_version", "compose", "expected"),
    [case[1:] for case in _CASES],
    ids=[case[0] for case in _CASES],
)
def test_get_compose_hash_matches_backend_dump_dict(
    os_image_version: str, compose: dict[str, Any], expected: str
) -> None:
    assert get_compose_hash(compose, os_image_version=os_image_version) == expected


def test_pre_06_wire_format_rejects_several_init_scripts() -> None:
    with pytest.raises(ValueError, match="at most one init_script"):
        get_compose_hash(_compose(name="old2", init_script=["a", "b"]), os_image_version="0.5.9")


def test_missing_tproxy_enabled_defaults_to_gateway_enabled() -> None:
    """SDK behavior for a partial compose, not a backend-produced vector."""
    without = {
        k: v for k, v in _compose(name="gw", gateway_enabled=False).items() if k != "tproxy_enabled"
    }
    explicit = _compose(name="gw", gateway_enabled=False, tproxy_enabled=False)
    assert get_compose_hash(without, os_image_version="0.6.0") == get_compose_hash(
        explicit, os_image_version="0.6.0"
    )
