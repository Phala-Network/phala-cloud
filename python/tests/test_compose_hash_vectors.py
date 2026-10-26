"""Assert get_compose_hash against the vectors shared with the JS and Go SDKs."""

import json
from pathlib import Path

import pytest

from phala_cloud.utils import get_compose_hash

VECTORS = json.loads(
    (Path(__file__).resolve().parents[2] / "test-vectors" / "app_compose_hash.json").read_text(
        encoding="utf-8"
    )
)["cases"]


@pytest.mark.parametrize("vector", VECTORS, ids=[v["name"] for v in VECTORS])
def test_get_compose_hash_matches_backend(vector: dict) -> None:
    assert get_compose_hash(vector["input"]) == vector["hash"]
