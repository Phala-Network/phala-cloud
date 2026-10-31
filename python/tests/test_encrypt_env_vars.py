import json

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dstack_sdk import EnvVar

import phala_cloud


def decrypt(private_key: X25519PrivateKey, encrypted: str) -> object:
    data = bytes.fromhex(encrypted)
    shared = private_key.exchange(X25519PublicKey.from_public_bytes(data[:32]))
    return json.loads(AESGCM(shared).decrypt(data[32:44], data[44:], None))


def public_key(private_key: X25519PrivateKey) -> str:
    return (
        private_key.public_key()
        .public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
        .hex()
    )


def test_sync_encrypt_accepts_parsed_and_upstream_envs() -> None:
    private_key = X25519PrivateKey.generate()
    envs = [*phala_cloud.parse_env_vars("FOO=bar"), EnvVar("HELLO", "world")]
    encrypted = phala_cloud.encrypt_env_vars(envs, public_key(private_key))
    assert decrypt(private_key, encrypted) == {
        "env": [{"key": "FOO", "value": "bar"}, {"key": "HELLO", "value": "world"}]
    }


@pytest.mark.asyncio
async def test_async_encrypt_accepts_parsed_and_upstream_envs() -> None:
    private_key = X25519PrivateKey.generate()
    envs = [*phala_cloud.parse_env_vars("FOO=bar"), EnvVar("HELLO", "world")]
    encrypted = await phala_cloud.async_encrypt_env_vars(envs, public_key(private_key))
    assert decrypt(private_key, encrypted) == {
        "env": [{"key": "FOO", "value": "bar"}, {"key": "HELLO", "value": "world"}]
    }
