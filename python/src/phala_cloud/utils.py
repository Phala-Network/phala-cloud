from __future__ import annotations

from typing import Any


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


from typing import Literal

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


def verify_mr_config_id(
    mr_config_id_hex: str,
    compose_hash_hex: str,
    app_id_hex: str,
    key_provider_type: KeyProviderKind,
    key_provider_id_hex: str = "",
) -> bool:
    """Verify a mr_config_id against the expected value."""
    expected = get_mr_config_id_hex(
        compose_hash_hex, app_id_hex, key_provider_type, key_provider_id_hex
    )
    return expected.lower() == mr_config_id_hex.lower()
