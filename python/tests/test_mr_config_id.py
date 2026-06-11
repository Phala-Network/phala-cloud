"""Tests for mr_config_id computation.

Test vectors match dstack-types/src/mr_config.rs and the JS/Go SDK tests.
"""

from phala_cloud.utils import (
    get_mr_config_id,
    get_mr_config_id_hex,
    get_mr_config_id_v1,
    verify_mr_config_id,
)

COMPOSE_HASH = bytes(range(32))
APP_ID = bytes(range(20))


def test_v2_kms_with_key_provider_id():
    result = get_mr_config_id(COMPOSE_HASH, APP_ID, "kms", bytes.fromhex("aabbccdd"))
    assert (
        result.hex()
        == "02e472ed80a08042f044ba63b53b798e98e3ea5219cd078007b1ac8b3dfc762b94000000000000000000000000000000"
    )


def test_v2_none_empty_key_provider_id():
    result = get_mr_config_id(COMPOSE_HASH, APP_ID, "none", b"")
    assert (
        result.hex()
        == "02b21a3a65891c2c3955d82000b30fab13f4adc1a12dc4a84793ea322b71f1882a000000000000000000000000000000"
    )


def test_v1():
    result = get_mr_config_id_v1(COMPOSE_HASH)
    assert (
        result.hex()
        == "01000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f000000000000000000000000000000"
    )


def test_length_48():
    result = get_mr_config_id(COMPOSE_HASH, APP_ID, "kms", bytes.fromhex("aabbccdd"))
    assert len(result) == 48


def test_version_byte():
    v2 = get_mr_config_id(COMPOSE_HASH, APP_ID, "kms", b"")
    assert v2[0] == 2
    v1 = get_mr_config_id_v1(COMPOSE_HASH)
    assert v1[0] == 1


def test_zero_padding():
    result = get_mr_config_id(COMPOSE_HASH, APP_ID, "kms", bytes.fromhex("aabbccdd"))
    assert result[33:] == bytes(15)


def test_hex_wrapper():
    result = get_mr_config_id_hex(
        "0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
        "0x000102030405060708090a0b0c0d0e0f10111213",
        "kms",
        "aabbccdd",
    )
    assert (
        result
        == "0x02e472ed80a08042f044ba63b53b798e98e3ea5219cd078007b1ac8b3dfc762b94000000000000000000000000000000"
    )


def test_verify_pass():
    assert verify_mr_config_id(
        "0x02e472ed80a08042f044ba63b53b798e98e3ea5219cd078007b1ac8b3dfc762b94000000000000000000000000000000",
        "0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
        "0x000102030405060708090a0b0c0d0e0f10111213",
        "kms",
        "aabbccdd",
    )


def test_verify_fail():
    assert not verify_mr_config_id(
        "0x" + "00" * 48,
        "0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
        "0x000102030405060708090a0b0c0d0e0f10111213",
        "kms",
        "aabbccdd",
    )


def test_different_key_provider_types():
    results = set()
    for kp in ("none", "local", "kms", "tpm"):
        r = get_mr_config_id(COMPOSE_HASH, APP_ID, kp, bytes.fromhex("aabb"))  # type: ignore[arg-type]
        results.add(r)
    assert len(results) == 4
