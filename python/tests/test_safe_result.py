import pytest

from phala_cloud import SafeResult


def test_unwrap_successful_none() -> None:
    result: SafeResult[None] = SafeResult(ok=True, data=None)
    assert result.unwrap() is None


def test_unwrap_raises_error() -> None:
    error = ValueError("failure")
    with pytest.raises(ValueError, match="failure"):
        SafeResult[None](ok=False, error=error).unwrap()
