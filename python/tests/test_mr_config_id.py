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

# Expected outputs (shared with JS/Go test vectors)
V2_KMS = (
    "02e472ed80a08042f044ba63b53b798e98e3ea5219"
    "cd078007b1ac8b3dfc762b94"
    "000000000000000000000000000000"
)
V2_NONE = (
    "02b21a3a65891c2c3955d82000b30fab13f4adc1a1"
    "2dc4a84793ea322b71f1882a"
    "000000000000000000000000000000"
)
V1_EXPECTED = (
    "01000102030405060708090a0b0c0d0e0f10111213"
    "1415161718191a1b1c1d1e1f"
    "000000000000000000000000000000"
)
KMS_CA_PUBKEY_VECTOR_KEY_PROVIDER_ID = (
    "3059301306072a8648ce3d020106082a8648ce3d030107034200048844eb42ccdf8c52"
    "fd4f174f362fcb9bbd19c45fd48f1edec2d8f1ca23536ec1a74021b4cee610c074f8294d"
    "431b2b7fee2c39e5333fdaf0a4522d43fb159d9f"
)
KMS_CA_PUBKEY_VECTOR_EXPECTED = (
    "02dd0db3893b8c47b5e4098d7630d22959a1423af536890d10aaf3f0a7b169921b"
    "000000000000000000000000000000"
)


def test_v2_kms_with_key_provider_id():
    result = get_mr_config_id(COMPOSE_HASH, APP_ID, "kms", bytes.fromhex("aabbccdd"))
    assert result.hex() == V2_KMS


def test_v2_none_empty_key_provider_id():
    result = get_mr_config_id(COMPOSE_HASH, APP_ID, "none", b"")
    assert result.hex() == V2_NONE


def test_v2_kms_ca_pubkey_vector():
    result = get_mr_config_id_hex(
        "4f475ed201ac079f2e4760fb7554763edcc97c48132d554666a2ec3fd2c9e099",
        "8d8f406cf93e1cf54207fbf99c9bc437dd4d6aef",
        "kms",
        KMS_CA_PUBKEY_VECTOR_KEY_PROVIDER_ID,
    )
    assert result == "0x" + KMS_CA_PUBKEY_VECTOR_EXPECTED


def test_v1():
    result = get_mr_config_id_v1(COMPOSE_HASH)
    assert result.hex() == V1_EXPECTED


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
    assert result == "0x" + V2_KMS


def test_verify_pass():
    assert verify_mr_config_id(
        "0x" + V2_KMS,
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
        r = get_mr_config_id(
            COMPOSE_HASH,
            APP_ID,
            kp,
            bytes.fromhex("aabb"),  # type: ignore[arg-type]
        )
        results.add(r)
    assert len(results) == 4
