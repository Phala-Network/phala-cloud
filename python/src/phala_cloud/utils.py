from __future__ import annotations

import hashlib
import json
from typing import Any, Literal, TypedDict


def parse_env_vars(content: str) -> list[dict[str, str]]:
    """Parse dotenv content into [{"key": ..., "value": ...}]."""
    result: list[dict[str, str]] = []
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        result.append({"key": key.strip(), "value": value.strip()})
    return result


def parse_env(path: str) -> list[dict[str, str]]:
    with open(path, encoding="utf-8") as f:
        return parse_env_vars(f.read())


def encrypt_env_vars(*args: Any, **kwargs: Any) -> Any:
    try:
        from dstack_sdk import encrypt_env_vars as _impl  # type: ignore

        return _impl(*args, **kwargs)
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("encrypt_env_vars requires dstack-sdk in Python environment") from exc


def get_compose_hash(*args: Any, **kwargs: Any) -> Any:
    try:
        from dstack_sdk import get_compose_hash as _impl  # type: ignore

        return _impl(*args, **kwargs)
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("get_compose_hash requires dstack-sdk in Python environment") from exc


def verify_env_encrypt_public_key(*args: Any, **kwargs: Any) -> Any:
    try:
        from dstack_sdk import verify_env_encrypt_public_key as _impl  # type: ignore

        return _impl(*args, **kwargs)
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "verify_env_encrypt_public_key requires dstack-sdk in Python environment"
        ) from exc


KeyProviderKind = Literal["none", "kms", "local", "tpm"]

_KEY_PROVIDER_BYTE: dict[str, int] = {
    "none": 0,
    "local": 1,
    "kms": 2,
    "tpm": 3,
}


def get_mr_config_id(
    compose_hash: bytes,
    app_id: bytes,
    key_provider_type: KeyProviderKind,
    key_provider_id: bytes,
) -> bytes:
    """Compute mr_config_id V2.

    Mirrors dstack-types/src/mr_config.rs MrConfig::V2::to_mr_config_id().

    LEGACY VMMs ONLY. dstack stopped generating V2 for new VMs: a TDX VM that
    declares ``key_provider_id`` now measures MrConfigV3, and V2 survives only
    as the fallback for VMs that predate the stored mr_config document
    (dstack/vmm/src/app/mr_config.rs). Keep it for verifying those quotes;
    never use it to describe a new deployment.

    Args:
        compose_hash: 32-byte SHA-256 compose hash.
        app_id: 20-byte application ID.
        key_provider_type: Key provider kind.
        key_provider_id: Key provider identity (variable length, can be empty).

    Returns:
        48-byte mr_config_id (0x02 || keccak256(...) || zero_pad).
    """
    import sha3  # type: ignore[import-untyped]

    kp_byte = _KEY_PROVIDER_BYTE[key_provider_type]
    payload = compose_hash + app_id + bytes([kp_byte]) + key_provider_id
    digest = sha3.keccak_256(payload).digest()
    result = bytearray(48)
    result[0] = 2
    result[1:33] = digest[:32]
    return bytes(result)


def get_mr_config_id_v1(compose_hash: bytes) -> bytes:
    """Compute mr_config_id V1 (compose_hash only, no key provider).

    Args:
        compose_hash: 32-byte SHA-256 compose hash.

    Returns:
        48-byte mr_config_id (0x01 || compose_hash || zero_pad).
    """
    result = bytearray(48)
    result[0] = 1
    result[1:33] = compose_hash
    return bytes(result)


def get_mr_config_id_hex(
    compose_hash_hex: str,
    app_id_hex: str,
    key_provider_type: KeyProviderKind,
    key_provider_id_hex: str = "",
) -> str:
    """Convenience wrapper accepting and returning hex strings."""
    compose_hash = bytes.fromhex(compose_hash_hex.removeprefix("0x"))
    app_id = bytes.fromhex(app_id_hex.removeprefix("0x"))
    kp_id = bytes.fromhex(key_provider_id_hex.removeprefix("0x")) if key_provider_id_hex else b""
    return "0x" + get_mr_config_id(compose_hash, app_id, key_provider_type, kp_id).hex()


MR_CONFIG_V3_DOMAIN = b"dstack-mr-config-v3:"

#: dstack refuses to bind more than this many init scripts.
MAX_INIT_SCRIPTS = 5


class MrConfigV3Document(TypedDict, total=False):
    """The MrConfigV3 document, field for field as dstack serializes it.

    Mirrors ``MrConfigV3`` in dstack-types/src/mr_config.rs. Byte fields carry
    the exact spelling the canonical JSON uses: lowercase hex, no ``0x``
    prefix. Optional fields are absent -- never None, never empty -- which is
    what ``#[skip_serializing_none]`` produces on the Rust side.
    """

    version: int
    app_id: str
    compose_hash: str
    gpu_policy_hash: str
    key_provider: KeyProviderKind
    key_provider_id: str
    instance_id: str
    init_script_hashes: list[str]


def _normalize_hex(value: str, field: str) -> str:
    bare = value.removeprefix("0x").removeprefix("0X").lower()
    if bare and not all(char in "0123456789abcdef" for char in bare):
        raise ValueError(f"{field} is not hex: {value}")
    if len(bare) % 2 != 0:
        raise ValueError(f"{field} has an odd hex length: {value}")
    return bare


def _expect_byte_length(bare: str, size: int, field: str) -> str:
    if len(bare) != size * 2:
        raise ValueError(f"{field} must be {size} bytes, got {len(bare) // 2}")
    return bare


def build_mr_config_v3_document(
    compose_hash: str,
    key_provider: KeyProviderKind,
    app_id: str = "",
    key_provider_id: str = "",
    instance_id: str = "",
    gpu_policy_hash: str = "",
    init_script_hashes: list[str] | None = None,
) -> MrConfigV3Document:
    """Build the MrConfigV3 document dstack would generate for these inputs.

    Mirrors ``VmWorkDir::prepare_mr_config_v3`` in dstack/vmm/src/app/mr_config.rs:
    empty optional byte fields are dropped rather than serialized as empty
    strings, so a ``no_instance_id`` compose yields a document with no
    ``instance_id`` key at all.

    Every hex argument accepts a ``0x`` prefix or none.
    """
    document: MrConfigV3Document = {
        "version": 3,
        "compose_hash": _expect_byte_length(
            _normalize_hex(compose_hash, "compose_hash"), 32, "compose_hash"
        ),
        "key_provider": key_provider,
    }

    bare_app_id = _normalize_hex(app_id, "app_id")
    if bare_app_id:
        document["app_id"] = _expect_byte_length(bare_app_id, 20, "app_id")

    bare_gpu_policy_hash = _normalize_hex(gpu_policy_hash, "gpu_policy_hash")
    if bare_gpu_policy_hash:
        document["gpu_policy_hash"] = _expect_byte_length(
            bare_gpu_policy_hash, 32, "gpu_policy_hash"
        )

    bare_key_provider_id = _normalize_hex(key_provider_id, "key_provider_id")
    if bare_key_provider_id:
        document["key_provider_id"] = bare_key_provider_id

    bare_instance_id = _normalize_hex(instance_id, "instance_id")
    if bare_instance_id:
        document["instance_id"] = _expect_byte_length(bare_instance_id, 20, "instance_id")

    if init_script_hashes is not None:
        if len(init_script_hashes) > MAX_INIT_SCRIPTS:
            raise ValueError(f"init_script_hashes supports at most {MAX_INIT_SCRIPTS} hashes")
        document["init_script_hashes"] = [
            _expect_byte_length(
                _normalize_hex(value, f"init_script_hashes[{index}]"),
                32,
                f"init_script_hashes[{index}]",
            )
            for index, value in enumerate(init_script_hashes)
        ]

    return document


def canonicalize_mr_config_v3_document(document: MrConfigV3Document) -> str:
    """RFC 8785 (JCS) serialization of an MrConfigV3 document.

    ``json.dumps(sort_keys=True, separators=(",", ":"), ensure_ascii=False)`` is
    JCS-equivalent *for this document shape*, and only for it. JCS additionally
    requires ES6 number formatting and UTF-16 code-unit key ordering, neither of
    which can bite here:

    * The only number is ``version``, always the integer 3, which Python and
      ES6 both print as ``3``.
    * Every key is ASCII (``[a-z_]``), so Python's byte-wise ``sort_keys``
      ordering and JCS's UTF-16 code-unit ordering agree.
    * Every string value is lowercase hex or one of ``none``/``kms``/``local``/
      ``tpm``, so no value needs escaping and ``ensure_ascii`` never applies.
    """
    return json.dumps(document, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _hash_mr_config_v3_document(document: MrConfigV3Document) -> bytes:
    payload = (
        MR_CONFIG_V3_DOMAIN + b"\x00" + canonicalize_mr_config_v3_document(document).encode("utf-8")
    )
    return hashlib.sha256(payload).digest()


def get_mr_config_id_v3(document: MrConfigV3Document) -> bytes:
    """Compute the TDX mr_config_id V3 for a document.

    Mirrors ``MrConfigV3::tdx_mr_config_id_from_document``.

    Returns:
        48-byte mr_config_id (0x03 || sha256(domain || 0x00 || JCS) || zero_pad).
    """
    result = bytearray(48)
    result[0] = 3
    result[1:33] = _hash_mr_config_v3_document(document)
    return bytes(result)


def get_snp_host_data_v3(document: MrConfigV3Document) -> bytes:
    """Compute the AMD SEV-SNP ``host_data`` for a document.

    The same 32-byte digest as :func:`get_mr_config_id_v3`, carried without the
    version byte or the padding.
    """
    return _hash_mr_config_v3_document(document)


def get_mr_config_id_v3_hex(document: MrConfigV3Document) -> str:
    """Convenience wrapper returning the V3 mr_config_id as ``0x``-prefixed hex."""
    return "0x" + get_mr_config_id_v3(document).hex()


def verify_mr_config_id(
    mr_config_id_hex: str,
    compose_hash_hex: str,
    app_id_hex: str,
    key_provider_type: KeyProviderKind,
    key_provider_id_hex: str = "",
    instance_id_hex: str = "",
    gpu_policy_hash_hex: str = "",
    init_script_hashes_hex: list[str] | None = None,
) -> bool:
    """Verify a mr_config_id against the inputs it should have been derived from.

    The version byte decides the layout, so a single call verifies quotes from
    legacy VMMs (V1 compose-hash-only, V2 keccak) and current ones (V3 document
    digest) alike. The V3-only arguments are ignored for V1 and V2.
    """
    bare = mr_config_id_hex.removeprefix("0x").removeprefix("0X").lower()
    if len(bare) != 96:
        return False

    version = bare[:2]
    if version == "01":
        expected = get_mr_config_id_v1(bytes.fromhex(compose_hash_hex.removeprefix("0x")))
    elif version == "02":
        expected = bytes.fromhex(
            get_mr_config_id_hex(
                compose_hash_hex, app_id_hex, key_provider_type, key_provider_id_hex
            ).removeprefix("0x")
        )
    elif version == "03":
        expected = get_mr_config_id_v3(
            build_mr_config_v3_document(
                compose_hash=compose_hash_hex,
                key_provider=key_provider_type,
                app_id=app_id_hex,
                key_provider_id=key_provider_id_hex,
                instance_id=instance_id_hex,
                gpu_policy_hash=gpu_policy_hash_hex,
                init_script_hashes=init_script_hashes_hex,
            )
        )
    else:
        return False

    return expected.hex() == bare
