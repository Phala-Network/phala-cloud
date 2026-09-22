"""Tests for mr_config_id computation.

Test vectors match dstack-types/src/mr_config.rs and the JS/Go SDK tests.
"""

import pytest

from phala_cloud.utils import (
    build_mr_config_v3_document,
    canonicalize_mr_config_v3_document,
    get_mr_config_id,
    get_mr_config_id_hex,
    get_mr_config_id_v1,
    get_mr_config_id_v3,
    get_snp_host_data_v3,
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


# ---------------------------------------------------------------------------
# MrConfigV3
#
# Every vector below was printed by dstack itself, not by this implementation:
# a scratch crate with a path dependency on dstack/dstack-types (at
# origin/next) built each document with MrConfigV3::new(...) and printed
# to_canonical_json(), to_tdx_mr_config_id() and to_snp_host_data().
# The same six vectors are pinned in the JS and Go suites.
# ---------------------------------------------------------------------------

V3_APP_ID = "11" * 20
V3_COMPOSE_HASH = "22" * 32
V3_KMS_KEY_PROVIDER_ID = "33" * 32
V3_INSTANCE_ID = "44" * 20
# sha256(JCS({})) -- dstack's gpu_policy_hash for a compose with no policy.
V3_DEFAULT_GPU_POLICY_HASH = "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"

V3_A_ID = "0350fc88d0a462b6a0b06ba25859abc02e98c2a8d9bd000b7dc0d8bae65e71ecbb" + "00" * 15


def test_v3_a_kms_with_instance_id():
    document = build_mr_config_v3_document(
        compose_hash=V3_COMPOSE_HASH,
        key_provider="kms",
        app_id=V3_APP_ID,
        key_provider_id=V3_KMS_KEY_PROVIDER_ID,
        instance_id=V3_INSTANCE_ID,
    )
    assert canonicalize_mr_config_v3_document(document) == (
        '{"app_id":"1111111111111111111111111111111111111111",'
        '"compose_hash":"2222222222222222222222222222222222222222222222222222222222222222",'
        '"instance_id":"4444444444444444444444444444444444444444",'
        '"key_provider":"kms",'
        '"key_provider_id":"3333333333333333333333333333333333333333333333333333333333333333",'
        '"version":3}'
    )
    assert get_mr_config_id_v3(document).hex() == V3_A_ID
    assert (
        get_snp_host_data_v3(document).hex()
        == "50fc88d0a462b6a0b06ba25859abc02e98c2a8d9bd000b7dc0d8bae65e71ecbb"
    )


def test_v3_b_gpu_policy_hash():
    document = build_mr_config_v3_document(
        compose_hash=V3_COMPOSE_HASH,
        key_provider="kms",
        app_id=V3_APP_ID,
        key_provider_id=V3_KMS_KEY_PROVIDER_ID,
        instance_id=V3_INSTANCE_ID,
        gpu_policy_hash=V3_DEFAULT_GPU_POLICY_HASH,
    )
    assert canonicalize_mr_config_v3_document(document) == (
        '{"app_id":"1111111111111111111111111111111111111111",'
        '"compose_hash":"2222222222222222222222222222222222222222222222222222222222222222",'
        '"gpu_policy_hash":"44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",'
        '"instance_id":"4444444444444444444444444444444444444444",'
        '"key_provider":"kms",'
        '"key_provider_id":"3333333333333333333333333333333333333333333333333333333333333333",'
        '"version":3}'
    )
    assert (
        get_mr_config_id_v3(document).hex()
        == "03893655c09844af05adb4d67af5917998038afe711bdcd3a3ec1dbd94ad272b85" + "00" * 15
    )
    assert (
        get_snp_host_data_v3(document).hex()
        == "893655c09844af05adb4d67af5917998038afe711bdcd3a3ec1dbd94ad272b85"
    )


def test_v3_c_ordered_init_script_hashes():
    document = build_mr_config_v3_document(
        compose_hash=V3_COMPOSE_HASH,
        key_provider="local",
        app_id=V3_APP_ID,
        key_provider_id="55" * 20,
        instance_id=V3_INSTANCE_ID,
        init_script_hashes=["aa" * 32, "bb" * 32],
    )
    assert canonicalize_mr_config_v3_document(document) == (
        '{"app_id":"1111111111111111111111111111111111111111",'
        '"compose_hash":"2222222222222222222222222222222222222222222222222222222222222222",'
        '"init_script_hashes":["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",'
        '"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],'
        '"instance_id":"4444444444444444444444444444444444444444",'
        '"key_provider":"local",'
        '"key_provider_id":"5555555555555555555555555555555555555555",'
        '"version":3}'
    )
    assert (
        get_mr_config_id_v3(document).hex()
        == "039af46bdc5deb1ea74f2c77b4f83165f1f3e4e37e3ce15462b5fee0d235912390" + "00" * 15
    )
    assert (
        get_snp_host_data_v3(document).hex()
        == "9af46bdc5deb1ea74f2c77b4f83165f1f3e4e37e3ce15462b5fee0d235912390"
    )


def test_v3_c2_empty_init_script_hashes_is_not_omitted():
    with_empty_list = build_mr_config_v3_document(
        compose_hash=V3_COMPOSE_HASH,
        key_provider="kms",
        app_id=V3_APP_ID,
        key_provider_id=V3_KMS_KEY_PROVIDER_ID,
        instance_id=V3_INSTANCE_ID,
        init_script_hashes=[],
    )
    assert '"init_script_hashes":[]' in canonicalize_mr_config_v3_document(with_empty_list)
    assert (
        get_mr_config_id_v3(with_empty_list).hex()
        == "03ce2f8b8e4aa4cccdae73fb3a118047726b77d70b1e47bb0e3e48600603fd612c" + "00" * 15
    )
    assert (
        get_snp_host_data_v3(with_empty_list).hex()
        == "ce2f8b8e4aa4cccdae73fb3a118047726b77d70b1e47bb0e3e48600603fd612c"
    )

    omitted = build_mr_config_v3_document(
        compose_hash=V3_COMPOSE_HASH,
        key_provider="kms",
        app_id=V3_APP_ID,
        key_provider_id=V3_KMS_KEY_PROVIDER_ID,
        instance_id=V3_INSTANCE_ID,
    )
    assert get_mr_config_id_v3(omitted) != get_mr_config_id_v3(with_empty_list)


def test_v3_d_no_instance_id_and_no_key_provider_id():
    document = build_mr_config_v3_document(
        compose_hash=V3_COMPOSE_HASH,
        key_provider="none",
        app_id=V3_APP_ID,
    )
    assert canonicalize_mr_config_v3_document(document) == (
        '{"app_id":"1111111111111111111111111111111111111111",'
        '"compose_hash":"2222222222222222222222222222222222222222222222222222222222222222",'
        '"key_provider":"none",'
        '"version":3}'
    )
    assert (
        get_mr_config_id_v3(document).hex()
        == "0301d4d7e6ca2922bb80683c27fe1f4da318cf14d1c38db97563c2b6209af7dba5" + "00" * 15
    )
    assert (
        get_snp_host_data_v3(document).hex()
        == "01d4d7e6ca2922bb80683c27fe1f4da318cf14d1c38db97563c2b6209af7dba5"
    )


def test_v3_e_every_optional_field_on_tpm():
    document = build_mr_config_v3_document(
        compose_hash=V3_COMPOSE_HASH,
        key_provider="tpm",
        app_id=V3_APP_ID,
        key_provider_id="66" * 16,
        instance_id=V3_INSTANCE_ID,
        gpu_policy_hash="55" * 32,
        init_script_hashes=["cc" * 32],
    )
    assert (
        get_mr_config_id_v3(document).hex()
        == "03633f5444c26877f68c293d90a6feef58064e1e57367ac55c94b255cf3bdf8885" + "00" * 15
    )
    assert (
        get_snp_host_data_v3(document).hex()
        == "633f5444c26877f68c293d90a6feef58064e1e57367ac55c94b255cf3bdf8885"
    )


def test_v3_accepts_prefixed_and_bare_hex():
    prefixed = build_mr_config_v3_document(
        compose_hash="0x" + V3_COMPOSE_HASH, key_provider="none", app_id="0x" + V3_APP_ID
    )
    bare = build_mr_config_v3_document(
        compose_hash=V3_COMPOSE_HASH, key_provider="none", app_id=V3_APP_ID
    )
    assert prefixed == bare


def test_v3_rejects_wrong_byte_lengths():
    with pytest.raises(ValueError, match="compose_hash must be 32 bytes"):
        build_mr_config_v3_document(compose_hash="2222", key_provider="none")
    with pytest.raises(ValueError, match="app_id must be 20 bytes"):
        build_mr_config_v3_document(
            compose_hash=V3_COMPOSE_HASH, key_provider="none", app_id="11" * 32
        )


def test_v3_rejects_too_many_init_scripts():
    with pytest.raises(ValueError, match="at most 5"):
        build_mr_config_v3_document(
            compose_hash=V3_COMPOSE_HASH,
            key_provider="none",
            init_script_hashes=["aa" * 32] * 6,
        )


def test_verify_dispatches_on_version_byte():
    assert verify_mr_config_id(
        "0x" + V1_EXPECTED,
        "0x" + COMPOSE_HASH.hex(),
        "0x" + APP_ID.hex(),
        "kms",
        "aabbccdd",
    )
    assert verify_mr_config_id(
        "0x" + V2_KMS,
        "0x" + COMPOSE_HASH.hex(),
        "0x" + APP_ID.hex(),
        "kms",
        "aabbccdd",
    )
    assert verify_mr_config_id(
        "0x" + V3_A_ID,
        V3_COMPOSE_HASH,
        V3_APP_ID,
        "kms",
        V3_KMS_KEY_PROVIDER_ID,
        instance_id_hex=V3_INSTANCE_ID,
    )


def test_verify_v3_rejects_a_different_instance_id():
    assert not verify_mr_config_id(
        "0x" + V3_A_ID,
        V3_COMPOSE_HASH,
        V3_APP_ID,
        "kms",
        V3_KMS_KEY_PROVIDER_ID,
        instance_id_hex="45" * 20,
    )


def test_verify_rejects_unknown_version_byte():
    assert not verify_mr_config_id(
        "0x04" + V3_A_ID[2:],
        V3_COMPOSE_HASH,
        V3_APP_ID,
        "kms",
        V3_KMS_KEY_PROVIDER_ID,
        instance_id_hex=V3_INSTANCE_ID,
    )
